import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  useEdgesState,
  useNodesState,
  XYPosition
} from '@xyflow/react';
import confetti from 'canvas-confetti';
import {
  canConnectNodeTypes,
  getDefaultNodeData,
  WorkflowNodeType
} from '../workflow/nodeRegistry';
import { getWorkflowTemplate, workflowTemplates } from '../workflow/workflowTemplates';
import {
  validateWorkflow,
  WorkflowValidationResult
} from '../workflow/workflowValidation';

interface WorkflowOption {
  id: string;
  name: string;
  description: string;
  source: 'template' | 'saved' | 'draft';
}

interface WorkflowDraft extends WorkflowOption {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasContextProps {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  activeTemplateId: string;
  workflowId: string;
  workflowName: string;
  workflowDescription: string;
  workflowOptions: WorkflowOption[];
  validation: WorkflowValidationResult;
  setSelectedNode: (node: Node | null) => void;
  setSelectedEdge: (edge: Edge | null) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: WorkflowNodeType, position: XYPosition) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  applyTemplate: (templateId: string) => Promise<void>;
  createBlankWorkflow: (name?: string) => void;
  deleteWorkflow: (workflowId?: string, sessionId?: string) => Promise<void>;
  updateSelectedNodeData: (field: string, value: string | number) => void;
  updateSelectedEdgeData: (field: string, value: string) => void;
  saveAndCompile: (sessionId?: string) => Promise<void>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

const cloneNodes = (nodes: Node[]) => nodes.map((node) => ({ ...node, data: { ...node.data }, position: { ...node.position } }));
const cloneEdges = (edges: Edge[]) => edges.map((edge) => ({ ...edge, data: { ...edge.data } }));

const defaultTemplate = getWorkflowTemplate('course-group-todo');
const blankTemplate = getWorkflowTemplate('blank-workflow');

const CanvasContext = createContext<CanvasContextProps | undefined>(undefined);

const createNodeId = (type: WorkflowNodeType) => {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
};

const slugifyWorkflowName = (name: string) => {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'custom-workflow';
};

const getModeFromHandle = (sourceHandle?: string | null, sourceType?: string) => {
  if (sourceHandle === 'true') return 'condition_true';
  if (sourceHandle === 'false') return 'condition_false';
  if (sourceHandle === 'body') return 'loop_body';
  if (sourceHandle === 'next' && sourceType === 'loop') return 'loop_next';
  if (sourceHandle === 'next') return 'sequence';
  return 'sequence';
};

const getLabelFromMode = (mode: string) => {
  const labels: Record<string, string> = {
    sequence: '顺序',
    condition_true: 'True',
    condition_false: 'False',
    loop_body: 'Body',
    loop_next: 'Next',
    parallel: '并行'
  };
  return labels[mode] || '顺序';
};

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTemplateId, setActiveTemplateId] = useState(defaultTemplate.id);
  const [workflowId, setWorkflowId] = useState(defaultTemplate.id);
  const [workflowName, setWorkflowName] = useState(defaultTemplate.name);
  const [workflowDescription, setWorkflowDescription] = useState(defaultTemplate.description);
  const [workflowSource, setWorkflowSource] = useState<WorkflowOption['source']>('template');
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowOption[]>([]);
  const [draftWorkflows, setDraftWorkflows] = useState<WorkflowDraft[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(cloneNodes(defaultTemplate.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(cloneEdges(defaultTemplate.edges));
  const [selectedNode, setSelectedNodeState] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdgeState] = useState<Edge | null>(null);

  const validation = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);

  const refreshSavedWorkflows = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3000/api/workflows');
      if (!response.ok) return;
      const data = await response.json();
      const templateIds = new Set(workflowTemplates.map((template) => template.id));
      const saved = (data.workflows || [])
        .filter((workflow: any) => !templateIds.has(workflow.id))
        .map((workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description || '',
          source: 'saved' as const
        }));
      setSavedWorkflows(saved);
    } catch (err) {
      console.warn('Failed to fetch saved workflows:', err);
    }
  }, []);

  useEffect(() => {
    refreshSavedWorkflows();
  }, [refreshSavedWorkflows]);

  const workflowOptions = useMemo(() => {
    const builtIns: WorkflowOption[] = workflowTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      source: 'template' as const
    }));
    const options = [...builtIns, ...savedWorkflows, ...draftWorkflows];
    if (!options.some((option) => option.id === workflowId)) {
      options.push({
        id: workflowId,
        name: workflowName,
        description: workflowDescription,
        source: workflowSource === 'saved' ? 'saved' : 'draft'
      });
    }
    return options;
  }, [draftWorkflows, savedWorkflows, workflowDescription, workflowId, workflowName, workflowSource]);

  const persistCurrentDraft = useCallback(() => {
    if (workflowSource !== 'draft') return;
    setDraftWorkflows((items) => {
      const current: WorkflowDraft = {
        id: workflowId,
        name: workflowName,
        description: workflowDescription,
        source: 'draft',
        nodes: cloneNodes(nodes),
        edges: cloneEdges(edges)
      };
      return [...items.filter((item) => item.id !== workflowId), current];
    });
  }, [edges, nodes, workflowDescription, workflowId, workflowName, workflowSource]);

  const setSelectedNode = useCallback((node: Node | null) => {
    setSelectedNodeState(node);
    if (node) setSelectedEdgeState(null);
  }, []);

  const setSelectedEdge = useCallback((edge: Edge | null) => {
    setSelectedEdgeState(edge);
    if (edge) setSelectedNodeState(null);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) {
        alert('不能把节点连接到自身。');
        return;
      }

      const sourceType = nodes.find((node) => node.id === params.source)?.type;
      const targetType = nodes.find((node) => node.id === params.target)?.type;
      if (!canConnectNodeTypes(sourceType || undefined, params.sourceHandle, targetType || undefined)) {
        alert('这条连线的数据类型不匹配，请换一个目标节点或使用 LLM 做中间转换。');
        return;
      }

      const mode = getModeFromHandle(params.sourceHandle, sourceType);
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.sourceHandle || 'next'}-${params.target}`,
            type: 'smoothstep',
            label: getLabelFromMode(mode),
            data: { mode, note: '' }
          },
          eds
        )
      );
    },
    [nodes, setEdges]
  );

  const addNode = useCallback(
    (type: WorkflowNodeType, position: XYPosition) => {
      const node: Node = {
        id: createNodeId(type),
        type,
        position,
        data: getDefaultNodeData(type)
      };
      setNodes((nds) => nds.concat(node));
      setSelectedNode(node);
    },
    [setNodes, setSelectedNode]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeState((node) => (node?.id === nodeId ? null : node));
    },
    [setNodes, setEdges]
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodes.find((node) => node.id === nodeId);
      if (!source) return;
      const duplicate: Node = {
        ...source,
        id: createNodeId(source.type as WorkflowNodeType),
        position: {
          x: source.position.x + 40,
          y: source.position.y + 40
        },
        data: { ...source.data }
      };
      setNodes((nds) => nds.concat(duplicate));
      setSelectedNode(duplicate);
    },
    [nodes, setNodes, setSelectedNode]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
      setSelectedEdgeState((edge) => (edge?.id === edgeId ? null : edge));
    },
    [setEdges]
  );

  const applyTemplate = useCallback(
    async (templateId: string) => {
      persistCurrentDraft();
      const template = getWorkflowTemplate(templateId);
      if (template.id === templateId && template.id !== blankTemplate.id) {
        setActiveTemplateId(template.id);
        setWorkflowId(template.id);
        setWorkflowName(template.name);
        setWorkflowDescription(template.description);
        setWorkflowSource('template');
        setNodes(cloneNodes(template.nodes));
        setEdges(cloneEdges(template.edges));
        setSelectedNodeState(null);
        setSelectedEdgeState(null);
        return;
      }

      if (templateId === blankTemplate.id) {
        setActiveTemplateId(blankTemplate.id);
        setWorkflowId(blankTemplate.id);
        setWorkflowName(blankTemplate.name);
        setWorkflowDescription(blankTemplate.description);
        setWorkflowSource('template');
        setNodes([]);
        setEdges([]);
        setSelectedNodeState(null);
        setSelectedEdgeState(null);
        return;
      }

      const draft = draftWorkflows.find((item) => item.id === templateId);
      if (draft) {
        setActiveTemplateId(blankTemplate.id);
        setWorkflowId(draft.id);
        setWorkflowName(draft.name);
        setWorkflowDescription(draft.description);
        setWorkflowSource('draft');
        setNodes(cloneNodes(draft.nodes));
        setEdges(cloneEdges(draft.edges));
        setSelectedNodeState(null);
        setSelectedEdgeState(null);
        return;
      }

      try {
        const response = await fetch(`http://localhost:3000/api/workflow/${encodeURIComponent(templateId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const workflow = await response.json();
        setActiveTemplateId(blankTemplate.id);
        setWorkflowId(workflow.id || templateId);
        setWorkflowName(workflow.name || templateId);
        setWorkflowDescription(workflow.description || '');
        setWorkflowSource('saved');
        setNodes(cloneNodes(workflow.nodes || []));
        setEdges(cloneEdges(workflow.edges || []));
        setSelectedNodeState(null);
        setSelectedEdgeState(null);
      } catch (err: any) {
        alert(`加载工作流失败：${err.message}`);
      }
    },
    [draftWorkflows, persistCurrentDraft, setNodes, setEdges]
  );

  const createBlankWorkflow = useCallback((name?: string) => {
    persistCurrentDraft();
    const template = getWorkflowTemplate('blank-workflow');
    const finalName = name?.trim() || `新建工作流 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
    const id = `${slugifyWorkflowName(finalName)}-${Date.now().toString(36)}`;
    setActiveTemplateId(template.id);
    setWorkflowId(id);
    setWorkflowName(finalName);
    setWorkflowDescription('用户从空白画板新建的自定义学习工作流。');
    setWorkflowSource('draft');
    setDraftWorkflows((items) => {
      const current: WorkflowDraft = {
        id,
        name: finalName,
        description: '用户从空白画板新建的自定义学习工作流。',
        source: 'draft',
        nodes: [],
        edges: []
      };
      return [...items.filter((item) => item.id !== id), current];
    });
    setNodes([]);
    setEdges([]);
    setSelectedNodeState(null);
    setSelectedEdgeState(null);
  }, [persistCurrentDraft, setNodes, setEdges]);

  const deleteWorkflow = useCallback(
    async (targetWorkflowId?: string, sessionId?: string) => {
      const id = targetWorkflowId || workflowId;
      const option = workflowOptions.find((item) => item.id === id);
      if (!option || option.source === 'template') {
        alert('内置模板不能删除。');
        return;
      }

      if (option.source === 'draft') {
        setDraftWorkflows((items) => items.filter((item) => item.id !== id));
        if (id === workflowId) {
          setActiveTemplateId(defaultTemplate.id);
          setWorkflowId(defaultTemplate.id);
          setWorkflowName(defaultTemplate.name);
          setWorkflowDescription(defaultTemplate.description);
          setWorkflowSource('template');
          setNodes(cloneNodes(defaultTemplate.nodes));
          setEdges(cloneEdges(defaultTemplate.edges));
          setSelectedNodeState(null);
          setSelectedEdgeState(null);
        }
        return;
      }

      try {
        const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
        const response = await fetch(`http://localhost:3000/api/workflow/${encodeURIComponent(id)}${query}`, {
          method: 'DELETE'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        setSavedWorkflows((items) => items.filter((item) => item.id !== id));
        await refreshSavedWorkflows();
        if (id === workflowId) {
          await applyTemplate(defaultTemplate.id);
        }
      } catch (err: any) {
        alert(`删除工作流失败：${err.message}`);
      }
    },
    [applyTemplate, refreshSavedWorkflows, workflowId, workflowOptions]
  );

  const updateSelectedNodeData = (field: string, value: string | number) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value
              }
            }
          : node
      )
    );
    setSelectedNodeState((prev) =>
      prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              [field]: value
            }
          }
        : null
    );
  };

  const updateSelectedEdgeData = (field: string, value: string) => {
    if (!selectedEdge) return;
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id !== selectedEdge.id) return edge;
        if (field === 'mode') {
          return {
            ...edge,
            label: getLabelFromMode(value),
            data: {
              ...edge.data,
              mode: value
            }
          };
        }
        return {
          ...edge,
          data: {
            ...edge.data,
            [field]: value
          }
        };
      })
    );
    setSelectedEdgeState((prev) => {
      if (!prev) return null;
      if (field === 'mode') {
        return {
          ...prev,
          label: getLabelFromMode(value),
          data: {
            ...prev.data,
            mode: value
          }
        };
      }
      return {
        ...prev,
        data: {
          ...prev.data,
          [field]: value
        }
      };
    });
  };

  const saveAndCompile = async (sessionId?: string) => {
    const currentValidation = validateWorkflow(nodes, edges);
    if (!currentValidation.ok) {
      const errorText = currentValidation.items
        .filter((item) => item.level === 'error')
        .map((item) => `- ${item.message}`)
        .join('\n');
      alert(`流程检查未通过，暂不能保存：\n${errorText}`);
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/workflow/${encodeURIComponent(workflowId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          description: workflowDescription,
          nodes: nodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data
          })),
          edges: edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            type: edge.type || 'smoothstep',
            label: edge.label,
            data: edge.data || { mode: 'sequence', note: '' }
          })),
          sessionId
        })
      });
      const resData = await response.json();
      if (resData.success) {
        setWorkflowSource('saved');
        setDraftWorkflows((items) => items.filter((item) => item.id !== workflowId));
        await refreshSavedWorkflows();
        confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
        alert(`工作流“${workflowName}”保存成功，SKILL.md 已重新编译并热加载到 Pi 内核。`);
      } else {
        alert(`保存失败: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`通信错误: ${err.message}`);
    }
  };

  return (
    <CanvasContext.Provider
      value={{
        nodes,
        edges,
        selectedNode,
        selectedEdge,
        activeTemplateId,
        workflowId,
        workflowName,
        workflowDescription,
        workflowOptions,
        validation,
        setSelectedNode,
        setSelectedEdge,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        deleteNode,
        duplicateNode,
        deleteEdge,
        applyTemplate,
        createBlankWorkflow,
        deleteWorkflow,
        updateSelectedNodeData,
        updateSelectedEdgeData,
        saveAndCompile,
        setNodes,
        setEdges
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) throw new Error('useCanvas must be used within a CanvasProvider');
  return context;
};
