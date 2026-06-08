import { KnowledgeBaseService } from "./knowledge-base-service.js";
import type { CuratedNote, WikiCard } from "./types.js";

export interface AgentKnowledgeReference {
  id: string;
  title: string;
  tags: string[];
  sourceType: "card" | "note";
  directory?: WikiCard["directory"];
  confidence: number;
}

export interface AgentKnowledgeContext {
  promptPrefix: string;
  references: AgentKnowledgeReference[];
}

const MAX_REFERENCES = 5;
const MAX_CARD_CHARS = 900;
const MAX_CONTEXT_CHARS = 6000;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "what",
  "when",
  "where",
  "why",
  "how",
  "are",
  "你",
  "我",
  "他",
  "她",
  "它",
  "我们",
  "你们",
  "他们",
  "这个",
  "那个",
  "什么",
  "怎么",
  "为什么",
  "请问",
  "解释",
  "一下",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

type KnowledgeCandidate =
  | {
      sourceType: "card";
      item: WikiCard;
    }
  | {
      sourceType: "note";
      item: CuratedNote;
    };

function extractTerms(query: string): string[] {
  const normalized = normalizeText(query);
  const asciiTerms = normalized.match(/[a-z0-9_+-]{2,}/g) || [];
  const cjkTerms = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkPairs = cjkTerms.flatMap((term) => {
    if (term.length <= 4) return [term];
    const pairs: string[] = [];
    for (let i = 0; i < term.length - 1; i += 1) {
      pairs.push(term.slice(i, i + 2));
    }
    return pairs;
  });

  return Array.from(new Set([...asciiTerms, ...cjkTerms, ...cjkPairs]))
    .filter((term) => !STOP_WORDS.has(term));
}

function getConfidence(candidate: KnowledgeCandidate): number {
  if (candidate.sourceType === "card") {
    return candidate.item.effective_confidence || candidate.item.confidence_score || 0;
  }

  const repsBonus = Math.min(candidate.item.reps || 0, 5) * 0.04;
  const stabilityBonus = Math.min(candidate.item.stability || 0, 10) * 0.02;
  return Math.min(1, 0.45 + repsBonus + stabilityBonus);
}

function scoreCandidate(candidate: KnowledgeCandidate, terms: string[], fullQuery: string): number {
  if (candidate.sourceType === "card" && candidate.item.directory === "archive") return 0;

  const title = normalizeText(candidate.item.title);
  const body = normalizeText(candidate.item.body);
  const tags = candidate.item.tags.map(normalizeText);
  const haystack = `${title}\n${tags.join(" ")}\n${body}`;
  let matchScore = 0;

  if (fullQuery && haystack.includes(fullQuery)) matchScore += 12;

  for (const term of terms) {
    if (title.includes(term)) matchScore += 8;
    if (tags.some((tag) => tag.includes(term))) matchScore += 6;
    if (body.includes(term)) matchScore += 2;
  }

  if (matchScore === 0) return 0;

  const confidenceBonus = Math.max(0, getConfidence(candidate)) * 2;
  return matchScore + confidenceBonus;
}

function excerpt(text: string, terms: string[]): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_CARD_CHARS) return clean;

  const lower = clean.toLowerCase();
  const hit = terms.find((term) => lower.includes(term));
  if (!hit) return `${clean.slice(0, MAX_CARD_CHARS)}...`;

  const index = lower.indexOf(hit);
  const start = Math.max(0, index - 220);
  const end = Math.min(clean.length, start + MAX_CARD_CHARS);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < clean.length ? "..." : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

function formatContext(candidates: KnowledgeCandidate[], terms: string[]): string {
  const sections: string[] = [
    "[知识库检索上下文]",
    "以下内容来自本地知识库。回答时优先参考这些内容；如果上下文不足，请明确说明不确定，不要编造来源。",
  ];

  for (const [index, candidate] of candidates.entries()) {
    const item = candidate.item;
    sections.push(
      [
        `\n[${index + 1}] ${item.title}`,
        `source_type: ${candidate.sourceType === "card" ? "知识卡片" : "整理笔记"}`,
        `id: ${item.id}`,
        `tags: ${item.tags.length ? item.tags.join(", ") : "无"}`,
        `confidence: ${Number(getConfidence(candidate)).toFixed(2)}`,
        `content: ${excerpt(item.body, terms)}`,
      ].join("\n")
    );
  }

  return sections.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

export async function buildAgentKnowledgeContext(
  kbService: KnowledgeBaseService,
  query: string
): Promise<AgentKnowledgeContext | null> {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;

  const terms = extractTerms(query);
  const cards = await kbService.listCards();
  const notes = await kbService.listNotes();
  const candidates: KnowledgeCandidate[] = [
    ...cards.map((item) => ({ sourceType: "card" as const, item })),
    ...notes.map((item) => ({ sourceType: "note" as const, item })),
  ];

  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, terms, normalizedQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_REFERENCES)
    .map((item) => item.candidate);

  if (!ranked.length) return null;

  return {
    promptPrefix: formatContext(ranked, terms),
    references: ranked.map((candidate) => ({
      id: candidate.item.id,
      title: candidate.item.title,
      tags: candidate.item.tags,
      sourceType: candidate.sourceType,
      directory: candidate.sourceType === "card" ? candidate.item.directory : undefined,
      confidence: getConfidence(candidate),
    })),
  };
}
