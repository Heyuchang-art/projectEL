import { Edge, Node } from '@xyflow/react';
import { WorkflowNodeType } from './nodeRegistry';

export interface WorkflowTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

const node = (
  id: string,
  type: WorkflowNodeType,
  x: number,
  y: number,
  data: Record<string, string | number>
): Node => ({
  id,
  type,
  position: { x, y },
  data
});

const edge = (
  source: string,
  target: string,
  sourceHandle = 'next',
  mode = 'sequence',
  label = '顺序'
): Edge => ({
  id: `e-${source}-${sourceHandle}-${target}`,
  source,
  target,
  sourceHandle,
  type: 'smoothstep',
  label,
  data: { mode, note: '' }
});

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'blank-workflow',
    name: '空白工作流',
    tagline: '从零开始拖拽节点，自由搭建自己的自动化流程',
    description: '适合新建流程：先从左侧节点库拖入起点，再逐步连接 LLM、MCP、知识库和 QQ 推送等节点。',
    nodes: [],
    edges: []
  },
  {
    id: 'course-group-todo',
    name: '群消息变待办',
    tagline: '从课程群里提取 deadline、地点、附件和待办',
    description: '适合展示 QQ Bot + 知识库：不用翻群，自动整理本周要做什么。',
    nodes: [
      node('todo-qq', 'qq_message', 120, 80, {
        source: '课程群最近 24 小时消息',
        outputKey: 'qq_messages'
      }),
      node('todo-extract', 'llm', 120, 230, {
        prompt: '从课程群消息中提取 deadline、地点、附件、作业要求和需要追问的信息，输出结构化待办清单。',
        model: '',
        outputKey: 'todo_items'
      }),
      node('todo-knowledge', 'knowledge_write', 120, 390, {
        collection: 'wiki_core/temporary',
        title: '课程群待办清单',
        format: 'task_list'
      }),
      node('todo-push', 'qq_push', 120, 550, {
        target: '个人私聊',
        messageTemplate: '今日课程待办：\\n{{content}}'
      })
    ],
    edges: [
      edge('todo-qq', 'todo-extract'),
      edge('todo-extract', 'todo-knowledge'),
      edge('todo-knowledge', 'todo-push')
    ]
  },
  {
    id: 'courseware-card',
    name: '课件变知识卡片',
    tagline: '把课件、笔记或 README 自动变成可复习知识卡片',
    description: '适合展示知识库价值：资料不是存起来，而是变成可查询、可复习的学习记忆。',
    nodes: [
      node('card-read', 'read_file', 120, 80, {
        path: './README.md',
        outputKey: 'course_material'
      }),
      node('card-summary', 'llm', 120, 230, {
        prompt: '提取材料中的核心概念、关键定义、例子和易混淆点，整理成知识卡片草稿。',
        model: '',
        outputKey: 'concept_card'
      }),
      node('card-socratic', 'socratic', 120, 390, {
        goal: '围绕知识卡片生成 5 个由浅入深的苏格拉底式追问，帮助学生确认自己是否真正理解。',
        questionCount: 5,
        outputKey: 'socratic_questions'
      }),
      node('card-write', 'knowledge_write', 120, 550, {
        collection: 'wiki_core/concepts',
        title: '课程知识卡片',
        format: 'concept_card'
      })
    ],
    edges: [
      edge('card-read', 'card-summary'),
      edge('card-summary', 'card-socratic'),
      edge('card-socratic', 'card-write')
    ]
  },
  {
    id: 'socratic-quiz',
    name: '苏格拉底自测',
    tagline: '从知识卡片生成追问、纠错和薄弱点报告',
    description: '适合展示教学灵魂：AI 不只是给答案，而是通过追问帮助学生理解。',
    nodes: [
      node('quiz-read', 'read_file', 120, 80, {
        path: './wiki_core/concepts/example.md',
        outputKey: 'knowledge_card'
      }),
      node('quiz-question', 'socratic', 120, 230, {
        goal: '根据知识卡片设计概念解释、反例辨析、迁移应用三类追问。',
        questionCount: 6,
        outputKey: 'quiz_questions'
      }),
      node('quiz-feedback', 'llm', 120, 390, {
        prompt: '根据学生回答进行纠错，指出遗漏点，并继续提出一个更深入的问题。',
        model: '',
        outputKey: 'weakness_report'
      }),
      node('quiz-write', 'write_file', 120, 550, {
        path: './reports/socratic-weakness-report.md',
        content: '使用上一步输出',
        mode: 'overwrite'
      })
    ],
    edges: [
      edge('quiz-read', 'quiz-question'),
      edge('quiz-question', 'quiz-feedback'),
      edge('quiz-feedback', 'quiz-write')
    ]
  },
  {
    id: 'daily-briefing',
    name: '每日学习日报',
    tagline: '汇总群消息与知识库，生成今日学习建议并推送',
    description: '适合演示完整闭环：信息进入、知识沉淀、学习行动、QQ 推送。',
    nodes: [
      node('brief-qq', 'qq_message', 120, 80, {
        source: '课程群和社团群最近 24 小时消息',
        outputKey: 'daily_messages'
      }),
      node('brief-condition', 'condition', 120, 230, {
        expression: '消息中存在 deadline、考试、作业或报名信息',
        trueLabel: '需要推送',
        falseLabel: '无重要待办'
      }),
      node('brief-summary', 'llm', 20, 400, {
        prompt: '把重要消息整理成今日待办、建议学习内容和风险提醒，语气简洁。',
        model: '',
        outputKey: 'daily_briefing'
      }),
      node('brief-log', 'knowledge_write', 250, 400, {
        collection: 'wiki_core/temporary',
        title: '无重要待办日志',
        format: 'task_list'
      }),
      node('brief-push', 'qq_push', 20, 560, {
        target: '个人私聊',
        messageTemplate: '今日学习日报：\\n{{content}}'
      })
    ],
    edges: [
      edge('brief-qq', 'brief-condition'),
      edge('brief-condition', 'brief-summary', 'true', 'condition_true', 'True'),
      edge('brief-condition', 'brief-log', 'false', 'condition_false', 'False'),
      edge('brief-summary', 'brief-push')
    ]
  }
];

export const getWorkflowTemplate = (id: string) => {
  return workflowTemplates.find((template) => template.id === id) || workflowTemplates[0];
};
