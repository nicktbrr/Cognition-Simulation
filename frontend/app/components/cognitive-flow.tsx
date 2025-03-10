"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  type Connection,
  useNodesState,
  useEdgesState,
  type NodeProps,
  Handle,
  Position,
  type NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

interface StepNodeProps extends NodeProps {
  data: {
    stepId: number;
    label: string;
    instructions: string;
    temperature: number;
    updateStep: (id: number, field: keyof Step, value: string | number) => void;
    deleteStep: (id: number) => void;
  };
}

// Custom node component for steps with improved handles
function StepNode({ data }: StepNodeProps) {
  return (
    <div className="w-[220px] p-4 border border-primary rounded-md bg-white shadow-md">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="cursor-grab active:cursor-grabbing hover:text-primary">
            <GripVertical className="w-4 h-4" />
          </div>
          <span className="text-xs text-muted-foreground">
            Step {data.stepId}
          </span>
        </div>
        <input
          type="text"
          placeholder="[Add Label]"
          className="w-full text-sm border rounded p-2 text-primary"
          value={data.label}
          onChange={(e) =>
            data.updateStep(data.stepId, "label", e.target.value)
          }
        />
        <textarea
          className="w-full h-24 text-sm resize-none border rounded p-2"
          placeholder="[Enter instructions, as if you were asking a human to complete this step.]"
          value={data.instructions}
          onChange={(e) =>
            data.updateStep(data.stepId, "instructions", e.target.value)
          }
        />
        <div className="space-y-1">
          <div className="text-sm">Temperature: {data.temperature}</div>
          <input
            type="range"
            min="0"
            max="100"
            value={data.temperature}
            onChange={(e) =>
              data.updateStep(
                data.stepId,
                "temperature",
                Number.parseInt(e.target.value)
              )
            }
            className="w-full accent-primary"
          />
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => data.deleteStep(data.stepId)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>

      {/* Improved handles with better connection areas */}
      {/* Top handles */}
      <div className="absolute left-0 right-0 top-0 h-4 flex justify-center">
        <Handle
          type="target"
          position={Position.Top}
          style={{
            top: 0,
            background: "#555",
            width: "20px",
            height: "20px",
            zIndex: 10,
          }}
          isConnectable={true}
          id="target-top"
        />
      </div>
      <div className="absolute left-0 right-0 top-0 h-4 flex justify-center">
        <Handle
          type="source"
          position={Position.Top}
          style={{
            top: 0,
            background: "#555",
            width: "20px",
            height: "20px",
            zIndex: 10,
          }}
          isConnectable={true}
          id="source-top"
        />
      </div>

      {/* Left handle */}
      <div className="absolute left-0 top-0 bottom-0 w-4 flex items-center">
        <Handle
          type="target"
          position={Position.Left}
          style={{
            left: 0,
            background: "#555",
            width: "20px",
            height: "20px",
            zIndex: 10,
          }}
          isConnectable={true}
          id="target-left"
        />
      </div>

      {/* Right handle */}
      <div className="absolute right-0 top-0 bottom-0 w-4 flex items-center">
        <Handle
          type="source"
          position={Position.Right}
          style={{
            right: 0,
            background: "#555",
            width: "20px",
            height: "20px",
            zIndex: 10,
          }}
          isConnectable={true}
          id="source-right"
        />
      </div>

      {/* Bottom handles */}
      <div className="absolute left-0 right-0 bottom-0 h-4 flex justify-center">
        <Handle
          type="target"
          position={Position.Bottom}
          style={{
            bottom: 0,
            background: "#555",
            width: "20px",
            height: "20px",
            zIndex: 10,
          }}
          isConnectable={true}
          id="target-bottom"
        />
      </div>
      <div className="absolute left-0 right-0 bottom-0 h-4 flex justify-center">
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            bottom: 0,
            background: "#555",
            width: "20px",
            height: "20px",
            zIndex: 10,
          }}
          isConnectable={true}
          id="source-bottom"
        />
      </div>
    </div>
  );
}

// Custom minimap node
function MiniMapNode({ x, y, width, height, id, style, selected }) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="#1a192b"
      fillOpacity={0.8}
      stroke={selected ? "#ff0072" : "#555"}
      strokeWidth={1}
      rx={4}
      ry={4}
    />
  );
}

// Flow content component
function Flow({
  steps,
  onStepsChange,
}: {
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // Flag for initial setup
  const initializedRef = useRef(false);

  // Track node positions separately from flow state
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});

  // New state to toggle panel visibility
  const [showPanel, setShowPanel] = useState(true);

  // New state to toggle minimap visibility
  const [showMinimap, setShowMinimap] = useState(true);

  // Define node types
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      stepNode: StepNode,
    }),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Custom nodes change handler to track positions
  const handleNodesChange = useCallback(
    (changes) => {
      // Update positions in ref based on position changes
      changes.forEach((change) => {
        if (change.type === "position" && change.id && change.position) {
          nodePositionsRef.current[change.id] = { ...change.position };
        }
      });

      // Apply the changes to nodes state
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // Update a step's properties
  const updateStep = useCallback(
    (id: number, field: keyof Step, value: string | number) => {
      const updatedSteps = steps.map((step) =>
        step.id === id ? { ...step, [field]: value } : step
      );
      onStepsChange(updatedSteps);
    },
    [steps, onStepsChange]
  );

  // Delete a step
  const deleteStep = useCallback(
    (id: number) => {
      const updatedSteps = steps.filter((step) => step.id !== id);
      onStepsChange(updatedSteps);
    },
    [steps, onStepsChange]
  );

  // Initialize only on first render
  useEffect(() => {
    if (steps.length > 0 && !initializedRef.current) {
      const initialNodes = steps.map((step, index) => ({
        id: step.id.toString(),
        type: "stepNode",
        position: { x: index * 300, y: 100 },
        data: {
          stepId: step.id,
          label: step.label,
          instructions: step.instructions,
          temperature: step.temperature,
          updateStep,
          deleteStep,
        },
        connectable: true,
      }));

      setNodes(initialNodes);
      setEdges([]);
      initializedRef.current = true;

      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    }
  }, [steps, setNodes, setEdges, updateStep, deleteStep, fitView]);

  // Update node data without changing positions
  useEffect(() => {
    if (!initializedRef.current || steps.length === 0) return;

    // Create a map of step data by ID for quick lookup
    const stepMap = steps.reduce((map, step) => {
      map[step.id.toString()] = step;
      return map;
    }, {} as Record<string, Step>);

    // Get existing node IDs for comparison
    const existingNodeIds = new Set(nodes.map((node) => node.id));
    const stepIds = new Set(steps.map((step) => step.id.toString()));

    // Update nodes: maintain positions for existing nodes, add new ones
    const updatedNodes = nodes
      // Keep existing nodes that are still in steps
      .filter((node) => stepIds.has(node.id))
      // Update their data
      .map((node) => {
        const step = stepMap[node.id];
        return {
          ...node,
          data: {
            stepId: step.id,
            label: step.label,
            instructions: step.instructions,
            temperature: step.temperature,
            updateStep,
            deleteStep,
          },
        };
      });

    // Add new nodes
    const newNodes = steps
      .filter((step) => !existingNodeIds.has(step.id.toString()))
      .map((step) => {
        // Find rightmost position
        const maxX = nodes.length
          ? Math.max(...nodes.map((node) => node.position.x))
          : 0;

        return {
          id: step.id.toString(),
          type: "stepNode",
          position: { x: maxX + 300, y: 100 },
          data: {
            stepId: step.id,
            label: step.label,
            instructions: step.instructions,
            temperature: step.temperature,
            updateStep,
            deleteStep,
          },
          connectable: true,
        };
      });

    if (newNodes.length > 0 || updatedNodes.length !== nodes.length) {
      setNodes([...updatedNodes, ...newNodes]);
    }
  }, [steps, nodes, setNodes, updateStep, deleteStep]);

  // Handle connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      console.log("Connection attempt:", params);

      // Create a unique ID for the edge to avoid duplicate key warnings
      const uniqueId = `e${params.source}-${params.target}-${Date.now()}`;

      // Create a properly formatted edge object with unique ID
      const newEdge = {
        id: uniqueId,
        source: params.source,
        sourceHandle: params.sourceHandle,
        target: params.target,
        targetHandle: params.targetHandle,
        animated: true,
        style: { stroke: "#000", strokeWidth: 3 },
      };

      console.log("Adding new edge:", newEdge);

      // Add the new edge without checking for duplicates to allow multiple connections
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

  // Debug current edges state
  useEffect(() => {
    console.log("Current edges state:", edges);
  }, [edges]);

  return (
    <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
      {/* Controls for showing/hiding UI elements */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10,
          display: "flex",
          gap: "20px",
        }}
      >
        <Button onClick={() => setShowMinimap((prev) => !prev)}>
          {showMinimap ? "Hide Minimap" : "Show Minimap"}
        </Button>
        <Button onClick={() => setShowPanel((prev) => !prev)}>
          {showPanel ? "Hide Panel" : "Show Panel"}
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        connectionMode="loose"
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "var(--primary)", strokeWidth: 2 },
        }}
      >
        <Background color="#aaa" gap={16} />
        <Controls />

        {/* Minimap with custom styling */}
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            pannable
            zoomable
            zoomStep={0.5}
            nodeColor="#1a192b"
            nodeBorderRadius={2}
            style={{
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid #ddd",
              borderRadius: "8px",
              right: 20,
              bottom: 20,
            }}
          />
        )}

        {showPanel && (
          <Panel
            position="bottom-center"
            className="bg-white p-2 rounded shadow-md"
            style={{ pointerEvents: "auto" }}
          >
            <div>
              Drag nodes to reposition • Connect nodes by dragging between
              handles
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// Main component with ReactFlowProvider
export default function CognitiveFlow({
  steps,
  onStepsChange,
}: {
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
}) {
  return (
    <ReactFlowProvider>
      <Flow steps={steps} onStepsChange={onStepsChange} />
    </ReactFlowProvider>
  );
}
