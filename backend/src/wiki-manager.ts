import { Router } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { KnowledgeBaseService } from './knowledge-base/knowledge-base-service.js';
import type { WikiCard } from './knowledge-base/types.js';
import fs from 'fs-extra';
import path from 'path';

export function createWikiRoutes(getService: () => KnowledgeBaseService, io: SocketServer): Router {
  const router = Router();

  const service = new Proxy({} as KnowledgeBaseService, {
    get(target, prop, _receiver) {
      const actualService = getService();
      const value = Reflect.get(actualService, prop, actualService);
      if (typeof value === 'function') {
        return value.bind(actualService);
      }
      return value;
    }
  });

  // =========================================================================
  // Wiki 2D Graph topology calculation
  // =========================================================================
  router.get('/graph', async (_req, res) => {
    try {
      const cards = await service.listCards();
      const cardMap = new Map<string, WikiCard>();

      // Index cards by lowercase title and filename (without .md) for fast lookup
      for (const card of cards) {
        cardMap.set(card.title.toLowerCase(), card);
        const nameWithoutExt = card.filename.replace(/\.md$/, '').toLowerCase();
        cardMap.set(nameWithoutExt, card);
      }

      const nodes = cards.map(c => ({
        id: c.id,
        label: c.title,
        size: Buffer.byteLength(c.body, 'utf8'),
        confidence: c.effective_confidence,
        lifecycle: c.lifecycle,
        directory: c.directory,
        filename: c.filename
      }));

      const edges: { source: string; target: string }[] = [];
      const edgeSet = new Set<string>();

      for (const c of cards) {
        const links = c.body.match(/\[\[(.*?)\]\]/g);
        if (links) {
          for (const link of links) {
            const targetName = link.slice(2, -2).trim().toLowerCase();
            const targetCard = cardMap.get(targetName);
            if (targetCard && targetCard.id !== c.id) {
              const edgeKey = `${c.id}->${targetCard.id}`;
              if (!edgeSet.has(edgeKey)) {
                edgeSet.add(edgeKey);
                edges.push({ source: c.id, target: targetCard.id });
              }
            }
          }
        }
      }

      res.json({ nodes, edges });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // Veto candidates list from archive_review.md
  // =========================================================================
  router.get('/veto', async (_req, res) => {
    try {
      const reviewPath = path.join(service.inboxDir, 'archive_review.md');
      if (!(await fs.pathExists(reviewPath))) {
        return res.json({ candidates: [], raw_markdown: '' });
      }

      const content = await fs.readFile(reviewPath, 'utf-8');
      const lines = content.split('\n');
      const candidates: { filename: string; title: string }[] = [];

      for (const line of lines) {
        const match = line.match(/^-\s*\[\s*\]\s*([^\s(]+)/);
        if (match) {
          const filename = match[1].trim();
          const title = filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
          candidates.push({ filename, title });
        }
      }

      res.json({ candidates, raw_markdown: content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // Override lifecycle to immortal (Veto a card)
  // =========================================================================
  router.post('/veto/override', async (req, res) => {
    try {
      const { filename, id } = req.body;
      let card = null;

      if (id) {
        card = await service.getCard(id);
      } else if (filename) {
        const cards = await service.listCards();
        card = cards.find(c => c.filename === filename);
      }

      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      const updated = await service.updateCard(card.id, { lifecycle: 'immortal' });
      
      // Update active archive_review.md to remove overridden card
      const reviewPath = path.join(service.inboxDir, 'archive_review.md');
      if (await fs.pathExists(reviewPath)) {
        let content = await fs.readFile(reviewPath, 'utf-8');
        const lines = content.split('\n');
        const updatedLines = lines.filter(line => {
          const match = line.match(/^-\s*\[\s*\]\s*([^\s(]+)/);
          return !(match && match[1].trim() === card!.filename);
        });
        await fs.writeFile(reviewPath, updatedLines.join('\n'), 'utf-8');
      }

      res.json({ success: true, card: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // Execute archive migration with veto list (derived from review changes)
  // =========================================================================
  router.post('/veto/execute', async (req, res) => {
    try {
      const cards = await service.listCards();
      const lowConfidenceCards = cards.filter(c => c.effective_confidence < 0.15);

      const reviewPath = path.join(service.inboxDir, 'archive_review.md');
      const vetoList: string[] = [];

      if (await fs.pathExists(reviewPath)) {
        const content = await fs.readFile(reviewPath, 'utf-8');
        const lines = content.split('\n');
        const remainingFilenames = new Set<string>();

        for (const line of lines) {
          const match = line.match(/^-\s*\[\s*\]\s*([^\s(]+)/);
          if (match) {
            remainingFilenames.add(match[1].trim());
          }
        }

        for (const card of lowConfidenceCards) {
          if (!remainingFilenames.has(card.filename)) {
            vetoList.push(card.filename);
          }
        }
      }

      const result = await service.executeArchive(vetoList);

      if (await fs.pathExists(reviewPath)) {
        await fs.remove(reviewPath);
      }

      io.emit('knowledge:archive-done', { moved: result.moved });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // Wiki Stats endpoint
  // =========================================================================
  router.get('/stats', async (_req, res) => {
    try {
      const stats = await service.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
