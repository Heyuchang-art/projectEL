import { Edge, Node } from '@xyflow/react';
import { canConnectNodeTypes, getNodeDefinition } from './nodeRegistry';

export type WorkflowValidationLevel = 'error' | 'warning' | 'success';

export interface WorkflowValidationItem {
  level: WorkflowValidationLevel;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface WorkflowValidationResult {
  ok: boolean;
  items: WorkflowValidationItem[];
}

const isBlank = (value: unknown) => {
  return value === undefined || value === null || String(value).trim() === '';
};

export function validateWorkflow(nodes: Node[], edges: Edge[]): WorkflowValidationResult {
  const items: WorkflowValidationItem[] = [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  if (nodes.length === 0) {
    items.push({ level: 'error', message: '画板中还没有节点，请先选择一个模板或拖拽节点。' });
  }

  nodes.forEach((node) => {
    const definition = getNodeDefinition(node.type || undefined);
    definition.requiredFields.forEach((field) => {
      if (isBlank(node.data?.[field])) {
        items.push({
          level: 'error',
          nodeId: node.id,
          message: `${definition.label} 节点缺少必填字段：${field}`
        });
      }
    });

    if (node.type === 'loop' && Number(node.data?.maxIterations || 0) <= 0) {
      items.push({
        level: 'error',
        nodeId: node.id,
        message: 'Loop 节点必须设置大于 0 的最大循环次数。'
      });
    }
  });

  edges.forEach((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      items.push({ level: 'error', edgeId: edge.id, message: '存在连接到已删除节点的连线。' });
      return;
    }

    if (edge.source === edge.target) {
      items.push({ level: 'error', edgeId: edge.id, message: `节点 ${edge.source} 不能连接到自身。` });
    }

    if (!canConnectNodeTypes(source.type || undefined, edge.sourceHandle, target.type || undefined)) {
      items.push({
        level: 'warning',
        edgeId: edge.id,
        message: `${getNodeDefinition(source.type || undefined).label} -> ${getNodeDefinition(target.type || undefined).label} 的数据类型可能不匹配。`
      });
    }
  });

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, Edge[]>();
  nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  });
  edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge]);
  });

  const startNodes = nodes.filter((node) => (incoming.get(node.id) || 0) === 0);
  if (nodes.length > 0 && startNodes.length === 0) {
    items.push({ level: 'error', message: '没有起始节点，可能所有节点都处在循环中。' });
  }

  const reachable = new Set<string>();
  const queue = startNodes.map((node) => node.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    (outgoing.get(current) || []).forEach((edge) => queue.push(edge.target));
  }

  nodes.forEach((node) => {
    if (!reachable.has(node.id)) {
      items.push({
        level: 'warning',
        nodeId: node.id,
        message: `${getNodeDefinition(node.type || undefined).label} 节点无法从起始节点到达。`
      });
    }
  });

  nodes
    .filter((node) => node.type === 'condition')
    .forEach((node) => {
      const exits = outgoing.get(node.id) || [];
      const hasTrue = exits.some((edge) => edge.sourceHandle === 'true' || edge.data?.mode === 'condition_true');
      const hasFalse = exits.some((edge) => edge.sourceHandle === 'false' || edge.data?.mode === 'condition_false');
      if (!hasTrue || !hasFalse) {
        items.push({
          level: 'error',
          nodeId: node.id,
          message: 'Condition 节点必须同时连接 true 和 false 两个分支。'
        });
      }
    });

  nodes
    .filter((node) => node.type === 'loop')
    .forEach((node) => {
      const exits = outgoing.get(node.id) || [];
      const hasBody = exits.some((edge) => edge.sourceHandle === 'body' || edge.data?.mode === 'loop_body');
      const hasNext = exits.some((edge) => edge.sourceHandle === 'next' || edge.data?.mode === 'loop_next');
      if (!hasBody || !hasNext) {
        items.push({
          level: 'warning',
          nodeId: node.id,
          message: 'Loop 节点建议同时连接 body 和 next，避免循环结束后流程断开。'
        });
      }
    });

  if (hasCycle(nodes, edges)) {
    items.push({
      level: 'warning',
      message: '检测到环路。请确认这是有最大次数限制的循环，而不是误连。'
    });
  }

  if (items.length === 0) {
    items.push({ level: 'success', message: '流程检查通过：节点字段、连接关系和基础控制流都正常。' });
  }

  return {
    ok: !items.some((item) => item.level === 'error'),
    items
  };
}

function hasCycle(nodes: Node[], edges: Edge[]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const adj = new Map<string, string[]>();
  nodes.forEach((node) => adj.set(node.id, []));
  edges.forEach((edge) => adj.set(edge.source, [...(adj.get(edge.source) || []), edge.target]));

  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return nodes.some((node) => dfs(node.id));
}
