import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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

interface CanvasContextProps {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  activeTemplateId: string;
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
  applyTemplate: (templateId: string) => void;
  updateSelectedNodeData: (field: string, value: string | number) => void;
  updateSelectedEdgeData: (field: string, value: string) => void;
  saveAndCompile: (sessionId?: string) => Promise<void>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

const cloneNodes = (nodes: Node[]) => nodes.map((node) => ({ ...node, data: { ...node.data }, position: { ...node.position } }));
const cloneEdges = (edges: Edge[]) => edges.map((edge) => ({ ...edge, data: { ...edge.data } }));

const defaultTemplate = workflowTemplates[0];

const CanvasContext = createContext<CanvasContextProps | undefined>(undefined);

const createNodeId = (type: WorkflowNodeType) => {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(cloneNodes(defaultTemplate.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(cloneEdges(defaultTemplate.edges));
  const [selectedNode, setSelectedNodeState] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdgeState] = useState<Edge | null>(null);

  const validation = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);

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
    (templateId: string) => {
      const template = getWorkflowTemplate(templateId);
      setActiveTemplateId(template.id);
      setNodes(cloneNodes(template.nodes));
      setEdges(cloneEdges(template.edges));
      setSelectedNodeState(null);
      setSelectedEdgeState(null);
    },
    [setNodes, setEdges]
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
      const template = getWorkflowTemplate(activeTemplateId);
      const response = await fetch('http://localhost:3000/api/workflow/fetch-and-summarize-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
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
        confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
        alert('工作流保存成功，SKILL.md 已重新编译并热加载到 Pi 内核。');
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
