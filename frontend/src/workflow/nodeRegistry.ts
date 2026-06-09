import {
  Bell,
  Bot,
  BrainCircuit,
  DatabaseZap,
  FileCode,
  FileText,
  GitBranch,
  Globe2,
  LucideIcon,
  MessageSquareText,
  Repeat2,
  Sparkles,
  Terminal,
  Wrench
} from 'lucide-react';

export type WorkflowNodeType =
  | 'bash'
  | 'llm'
  | 'read_file'
  | 'write_file'
  | 'api_request'
  | 'mcp_tool'
  | 'condition'
  | 'loop'
  | 'subagent'
  | 'qq_message'
  | 'knowledge_write'
  | 'socratic'
  | 'qq_push';

export type WorkflowFieldType = 'text' | 'textarea' | 'select' | 'number';
export type WorkflowValueType = 'text' | 'json' | 'list' | 'card' | 'task' | 'message' | 'any';

export interface WorkflowFieldDefinition {
  key: string;
  label: string;
  type: WorkflowFieldType;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface WorkflowHandleDefinition {
  id: string;
  label: string;
  outputType: WorkflowValueType;
}

export interface WorkflowNodeDefinition {
  type: WorkflowNodeType;
  label: string;
  group: string;
  description: string;
  color: string;
  icon: LucideIcon;
  defaultData: Record<string, string | number>;
  summaryField: string;
  fields: WorkflowFieldDefinition[];
  requiredFields: string[];
  inputTypes: WorkflowValueType[];
  outputs: WorkflowHandleDefinition[];
}

export const workflowNodeDefinitions: WorkflowNodeDefinition[] = [
  {
    type: 'qq_message',
    label: 'QQ 群消息',
    group: '南大学习',
    description: '读取课程群、通知群或学习群里的消息片段',
    color: '#38bdf8',
    icon: MessageSquareText,
    defaultData: {
      source: '课程群最近 24 小时消息',
      outputKey: 'qq_messages'
    },
    summaryField: 'source',
    requiredFields: ['source'],
    inputTypes: [],
    fields: [
      { key: 'source', label: '消息来源', type: 'text', placeholder: '课程群最近 24 小时消息' },
      { key: 'outputKey', label: '输出变量', type: 'text', placeholder: 'qq_messages' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'message' }]
  },
  {
    type: 'knowledge_write',
    label: '写入知识库',
    group: '南大学习',
    description: '把总结、任务或知识卡片沉淀到个人知识库',
    color: '#a3e635',
    icon: DatabaseZap,
    defaultData: {
      collection: 'wiki_core/concepts',
      title: '课程学习卡片',
      format: 'concept_card'
    },
    summaryField: 'collection',
    requiredFields: ['collection', 'title'],
    inputTypes: ['text', 'json', 'card', 'task', 'any'],
    fields: [
      { key: 'collection', label: '知识库目录', type: 'text', placeholder: 'wiki_core/concepts' },
      { key: 'title', label: '卡片标题', type: 'text', placeholder: '课程学习卡片' },
      {
        key: 'format',
        label: '写入格式',
        type: 'select',
        options: [
          { label: '知识卡片', value: 'concept_card' },
          { label: '待办任务', value: 'task_list' },
          { label: '薄弱点报告', value: 'weakness_report' }
        ]
      }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'card' }]
  },
  {
    type: 'socratic',
    label: '苏格拉底追问',
    group: '南大学习',
    description: '基于资料生成追问、自测题和纠错提示',
    color: '#f97316',
    icon: BrainCircuit,
    defaultData: {
      goal: '帮助学生理解核心概念，而不是直接背答案',
      questionCount: 5,
      outputKey: 'socratic_questions'
    },
    summaryField: 'goal',
    requiredFields: ['goal'],
    inputTypes: ['text', 'card', 'any'],
    fields: [
      { key: 'goal', label: '追问目标', type: 'textarea', placeholder: '帮助学生理解核心概念...' },
      { key: 'questionCount', label: '问题数量', type: 'number', placeholder: '5' },
      { key: 'outputKey', label: '输出变量', type: 'text', placeholder: 'socratic_questions' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'text' }]
  },
  {
    type: 'qq_push',
    label: 'QQ 推送',
    group: '南大学习',
    description: '把学习日报、待办或提醒推送到 QQ',
    color: '#f472b6',
    icon: Bell,
    defaultData: {
      target: '个人私聊或课程群',
      messageTemplate: '今日学习待办：\\n{{content}}'
    },
    summaryField: 'target',
    requiredFields: ['target', 'messageTemplate'],
    inputTypes: ['text', 'task', 'card', 'any'],
    fields: [
      { key: 'target', label: '推送目标', type: 'text', placeholder: '个人私聊或课程群' },
      { key: 'messageTemplate', label: '消息模板', type: 'textarea', placeholder: '今日学习待办：\\n{{content}}' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'message' }]
  },
  {
    type: 'bash',
    label: 'Bash',
    group: '基础执行',
    description: '运行终端命令或脚本',
    color: 'var(--secondary)',
    icon: Terminal,
    defaultData: {
      command: 'curl -s https://news.ycombinator.com/',
      cwd: '',
      timeout: 60
    },
    summaryField: 'command',
    requiredFields: ['command'],
    inputTypes: [],
    fields: [
      { key: 'command', label: 'Bash 指令', type: 'textarea', placeholder: 'npm run build' },
      { key: 'cwd', label: '工作目录', type: 'text', placeholder: './' },
      { key: 'timeout', label: '超时秒数', type: 'number', placeholder: '60' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'text' }]
  },
  {
    type: 'llm',
    label: 'LLM',
    group: 'AI',
    description: '调用模型进行分析、生成、总结或结构化提取',
    color: 'var(--primary)',
    icon: Sparkles,
    defaultData: {
      prompt: '从上一步输出中提取重点，并整理成适合复习的结构化内容。',
      model: '',
      outputKey: 'llm_result'
    },
    summaryField: 'prompt',
    requiredFields: ['prompt'],
    inputTypes: ['text', 'json', 'message', 'card', 'task', 'any'],
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: '结合上下文完成分析...' },
      { key: 'model', label: '模型覆盖', type: 'text', placeholder: '留空使用当前激活模型' },
      { key: 'outputKey', label: '输出变量', type: 'text', placeholder: 'llm_result' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'text' }]
  },
  {
    type: 'read_file',
    label: 'Read File',
    group: '文件',
    description: '读取本地课件、README、笔记或资料文件',
    color: '#8b5cf6',
    icon: FileText,
    defaultData: {
      path: './README.md',
      outputKey: 'file_content'
    },
    summaryField: 'path',
    requiredFields: ['path'],
    inputTypes: [],
    fields: [
      { key: 'path', label: '读取路径', type: 'text', placeholder: './README.md' },
      { key: 'outputKey', label: '输出变量', type: 'text', placeholder: 'file_content' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'text' }]
  },
  {
    type: 'write_file',
    label: 'Write File',
    group: '文件',
    description: '把结果写入目标文件',
    color: 'var(--accent)',
    icon: FileCode,
    defaultData: {
      path: './study-cards/ai-news.md',
      content: '使用上一步输出',
      mode: 'overwrite'
    },
    summaryField: 'path',
    requiredFields: ['path'],
    inputTypes: ['text', 'json', 'card', 'task', 'any'],
    fields: [
      { key: 'path', label: '写入路径', type: 'text', placeholder: './output.md' },
      { key: 'content', label: '写入内容', type: 'textarea', placeholder: '使用上一步输出' },
      {
        key: 'mode',
        label: '写入模式',
        type: 'select',
        options: [
          { label: '覆盖', value: 'overwrite' },
          { label: '追加', value: 'append' }
        ]
      }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'text' }]
  },
  {
    type: 'api_request',
    label: 'API Request',
    group: '网络',
    description: '发起 HTTP 请求并保存响应',
    color: '#22c55e',
    icon: Globe2,
    defaultData: {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: '',
      body: '',
      outputKey: 'api_response'
    },
    summaryField: 'url',
    requiredFields: ['method', 'url'],
    inputTypes: [],
    fields: [
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' }
        ]
      },
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data' },
      { key: 'headers', label: 'Headers', type: 'textarea', placeholder: 'Authorization: Bearer ...' },
      { key: 'body', label: 'Body', type: 'textarea', placeholder: '{"query":"..."}' },
      { key: 'outputKey', label: '输出变量', type: 'text', placeholder: 'api_response' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'json' }]
  },
  {
    type: 'mcp_tool',
    label: 'MCP Tool',
    group: '工具',
    description: '调用已连接的 MCP 服务和工具，接入 GitHub、浏览器、数据库等外部能力',
    color: '#14b8a6',
    icon: Wrench,
    defaultData: {
      server: 'github',
      tool: 'search_repositories',
      params: '{\n  "query": "NJU AI education"\n}',
      outputKey: 'mcp_result'
    },
    summaryField: 'tool',
    requiredFields: ['server', 'tool'],
    inputTypes: ['text', 'json', 'message', 'card', 'task', 'any'],
    fields: [
      { key: 'server', label: 'MCP 服务', type: 'text', placeholder: 'github / browser / database' },
      { key: 'tool', label: '工具名称', type: 'text', placeholder: 'search_repositories' },
      { key: 'params', label: '参数 JSON', type: 'textarea', placeholder: '{\n  "query": "{{input}}"\n}' },
      { key: 'outputKey', label: '输出变量', type: 'text', placeholder: 'mcp_result' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'json' }]
  },
  {
    type: 'condition',
    label: 'Condition',
    group: '流程控制',
    description: '根据表达式进入 true/false 分支',
    color: '#f59e0b',
    icon: GitBranch,
    defaultData: {
      expression: '上一节点输出包含 deadline',
      trueLabel: '匹配',
      falseLabel: '不匹配'
    },
    summaryField: 'expression',
    requiredFields: ['expression'],
    inputTypes: ['text', 'json', 'message', 'card', 'task', 'any'],
    fields: [
      { key: 'expression', label: '判断条件', type: 'textarea', placeholder: '如果上一步输出包含...' },
      { key: 'trueLabel', label: 'True 分支名', type: 'text', placeholder: '匹配' },
      { key: 'falseLabel', label: 'False 分支名', type: 'text', placeholder: '不匹配' }
    ],
    outputs: [
      { id: 'true', label: 'true', outputType: 'any' },
      { id: 'false', label: 'false', outputType: 'any' }
    ]
  },
  {
    type: 'loop',
    label: 'Loop',
    group: '流程控制',
    description: '遍历列表或重复执行子流程',
    color: '#06b6d4',
    icon: Repeat2,
    defaultData: {
      iterable: '上一节点输出列表',
      maxIterations: 5,
      itemKey: 'item'
    },
    summaryField: 'iterable',
    requiredFields: ['iterable', 'maxIterations'],
    inputTypes: ['list', 'json', 'any'],
    fields: [
      { key: 'iterable', label: '循环对象', type: 'text', placeholder: '上一节点输出列表' },
      { key: 'maxIterations', label: '最大次数', type: 'number', placeholder: '5' },
      { key: 'itemKey', label: '单项变量', type: 'text', placeholder: 'item' }
    ],
    outputs: [
      { id: 'body', label: 'body', outputType: 'any' },
      { id: 'next', label: 'next', outputType: 'any' }
    ]
  },
  {
    type: 'subagent',
    label: 'SubAgent',
    group: 'Agent',
    description: '调用一个专门能力的子代理',
    color: '#ec4899',
    icon: Bot,
    defaultData: {
      agent: 'code-review',
      mode: 'chain',
      instruction: '让子代理处理当前上下文，并返回结构化结果。'
    },
    summaryField: 'instruction',
    requiredFields: ['agent', 'instruction'],
    inputTypes: ['text', 'json', 'card', 'any'],
    fields: [
      { key: 'agent', label: '子代理', type: 'text', placeholder: 'code-review' },
      {
        key: 'mode',
        label: '编排模式',
        type: 'select',
        options: [
          { label: 'Chain', value: 'chain' },
          { label: 'Parallel', value: 'parallel' },
          { label: 'Supervisor', value: 'supervisor' }
        ]
      },
      { key: 'instruction', label: '任务说明', type: 'textarea', placeholder: '交给子代理完成...' }
    ],
    outputs: [{ id: 'next', label: 'next', outputType: 'text' }]
  }
];

export const workflowNodeRegistry = workflowNodeDefinitions.reduce(
  (acc, definition) => {
    acc[definition.type] = definition;
    return acc;
  },
  {} as Record<WorkflowNodeType, WorkflowNodeDefinition>
);

export const groupedWorkflowNodes = workflowNodeDefinitions.reduce(
  (acc, definition) => {
    if (!acc[definition.group]) acc[definition.group] = [];
    acc[definition.group].push(definition);
    return acc;
  },
  {} as Record<string, WorkflowNodeDefinition[]>
);

export const getNodeDefinition = (type?: string) => {
  return workflowNodeRegistry[type as WorkflowNodeType] || workflowNodeRegistry.bash;
};

export const getDefaultNodeData = (type: WorkflowNodeType) => {
  return { ...workflowNodeRegistry[type].defaultData };
};

export const getOutputTypeForHandle = (type?: string, handleId?: string | null): WorkflowValueType => {
  const definition = getNodeDefinition(type);
  const output = definition.outputs.find((item) => item.id === handleId) || definition.outputs[0];
  return output?.outputType || 'any';
};

export const canConnectNodeTypes = (sourceType?: string, sourceHandle?: string | null, targetType?: string) => {
  const target = getNodeDefinition(targetType);
  if (target.inputTypes.length === 0) return false;
  const outputType = getOutputTypeForHandle(sourceType, sourceHandle);
  return target.inputTypes.includes('any') || outputType === 'any' || target.inputTypes.includes(outputType);
};

export const edgeModeOptions = [
  { label: '顺序执行', value: 'sequence' },
  { label: '条件 True', value: 'condition_true' },
  { label: '条件 False', value: 'condition_false' },
  { label: '循环 Body', value: 'loop_body' },
  { label: '循环 Next', value: 'loop_next' },
  { label: '并行分支', value: 'parallel' }
];
