"use client";
import React from "react";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { Trash2, GripVertical, LockIcon, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ReactFlow,
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
  MarkerType,
  NodeToolbar,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { isValidURL } from "@/app/utils/urlParser";

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
    disabled?: boolean;
  };
}

// Context to hold the steps and update function
const StepsContext = React.createContext<{
  steps: Step[];
  updateStepData: (
    id: number,
    field: keyof Step,
    value: string | number
  ) => void;
  disabled?: boolean;
}>({
  steps: [],
  updateStepData: () => {},
  disabled: false,
});
// StepNode component - optimized to reduce updates
const StepNode = React.memo(function StepNode({ data }: StepNodeProps) {
  // Get steps data from context
  const { steps, updateStepData, disabled } = React.useContext(StepsContext);

  const { updateNodeData } = useReactFlow();

  // Find current step data from context
  const currentStep = useMemo(
    () => steps.find((step) => step.id === data.stepId),
    [steps, data.stepId]
  );

  // Use state from context as initial values
  const [localLabel, setLocalLabel] = useState(
    currentStep?.label ?? data.label ?? ""
  );
  const [localInstructions, setLocalInstructions] = useState(
    currentStep?.instructions ?? data.instructions ?? ""
  );
  const [localTemperature, setLocalTemperature] = useState(
    currentStep?.temperature ?? data.temperature ?? 0
  );

  // Single effect to update from context when needed
  useEffect(() => {
    if (currentStep) {
      setLocalLabel(currentStep.label ?? "");
      setLocalInstructions(currentStep.instructions ?? "");
      setLocalTemperature(currentStep.temperature ?? 0);
    }
  }, [currentStep?.id]); // Only update when the step ID changes

  // Combined update function for any field
  const handleUpdate = useCallback(
    (field: keyof Step, value: string | number) => {
      if (disabled) return; // Prevent updates when disabled

      // Update context (single source of truth)
      updateStepData(data.stepId, field, value);

      // Store in global space for emergency recovery
      if (!window.nodeValues) window.nodeValues = {};
      if (!window.nodeValues[data.stepId]) window.nodeValues[data.stepId] = {};
      window.nodeValues[data.stepId][field] = value;
    },
    [data.stepId, updateStepData, disabled]
  );

  // Is simulation active / disabled?
  const isDisabled = disabled || data.disabled;

  return (
    <>
      <div
        className={`w-[450px] h-[400px] p-4 border ${
          isDisabled ? "border-gray-300" : "border-primary"
        } rounded-md bg-white shadow-md ${isDisabled ? "opacity-80" : ""}`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {isDisabled ? (
              <div className="text-muted-foreground">
                <LockIcon className="w-4 h-4" />
              </div>
            ) : (
              <div className="cursor-grab active:cursor-grabbing hover:text-primary">
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              Step {data.stepId}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="[Add Label]"
              className="w-full text-sm border rounded p-2 text-primary"
              value={localLabel}
              maxLength={20}
              onChange={(e) => {
                if (isDisabled) return;
                const newValue = e.target.value;
                setLocalLabel(newValue);
                handleUpdate("label", newValue);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              disabled={isDisabled}
            />
          </div>
          <div className="relative">
            <textarea
              className="w-full h-[200px] text-sm resize-none border rounded p-2"
              placeholder="[Enter instructions, as if you were asking a human to complete this step.]"
              value={localInstructions}
              maxLength={500}
              onChange={(e) => {
                if (isDisabled) return;
                const newValue = e.target.value;
                setLocalInstructions(newValue);
                handleUpdate("instructions", newValue);
              }}
              disabled={isDisabled}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {localInstructions.length}/500
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm">Temperature: {localTemperature}</div>
            <Slider
              defaultValue={[localTemperature]}
              max={100}
              step={1}
              onValueChange={([value]) => {
                if (isDisabled) return;
                setLocalTemperature(value);
                handleUpdate("temperature", value);
              }}
              disabled={isDisabled}
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => data.deleteStep(data.stepId)}
            disabled={isDisabled}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Connection Handles */}
        {/* <div className="absolute left-0 right-0 top-0 h-4 flex justify-center">
          <Handle
            type="target"
            position={Position.Top}
            style={{
              top: 0,
              background: isDisabled ? "#999" : "#555",
              width: "20px",
              height: "20px",
              zIndex: 10,
            }}
            isConnectable={!isDisabled}
            id="target-top"
          />
          <Handle
            type="source"
            position={Position.Top}
            style={{
              top: 0,
              background: isDisabled ? "#999" : "#555",
              width: "20px",
              height: "20px",
              zIndex: 10,
            }}
            isConnectable={!isDisabled}
            id="source-top"
          />
        </div> */}
        <div className="absolute left-0 top-0 bottom-0 w-4 flex items-center">
          <Handle
            type="target"
            position={Position.Left}
            style={{
              left: 0,
              background: isDisabled ? "#999" : "#555",
              width: "20px",
              height: "20px",
              zIndex: 10,
            }}
            isConnectable={!isDisabled}
            id="target-left"
          />
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-4 flex items-center">
          <Handle
            type="source"
            position={Position.Right}
            style={{
              right: 0,
              background: isDisabled ? "#999" : "#555",
              width: "20px",
              height: "20px",
              zIndex: 10,
            }}
            isConnectable={!isDisabled}
            id="source-right"
          />
        </div>
        {/* <div className="absolute left-0 right-0 bottom-0 h-4 flex justify-center">
          <Handle
            type="target"
            position={Position.Bottom}
            style={{
              bottom: 0,
              background: isDisabled ? "#999" : "#555",
              width: "20px",
              height: "20px",
              zIndex: 10,
            }}
            isConnectable={!isDisabled}
            id="target-bottom"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            style={{
              bottom: 0,
              background: isDisabled ? "#999" : "#555",
              width: "20px",
              height: "20px",
              zIndex: 10,
            }}
            isConnectable={!isDisabled}
            id="source-bottom"
          />
        </div> */}
      </div>
    </>
  );
});

// Flow content component
function Flow({
  steps,
  edges: parentEdges = [],
  onStepsChange,
  parentOnEdgesChange, // Renamed to avoid conflict
  disabled = false,
}: {
  steps: Step[];
  edges?: any[];
  onStepsChange: (steps: Step[]) => void;
  parentOnEdgesChange?: (edges: any[]) => void;
  disabled?: boolean;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const initializedRef = useRef(false);
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});

  // Single source of truth for steps
  const [localSteps, setLocalSteps] = useState<Step[]>(steps);

  // UI toggles
  const [showPanel, setShowPanel] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add connection error message state
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const connectionErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Define node types - memoized
  const nodeTypes = useMemo<NodeTypes>(() => ({ stepNode: StepNode }), []);

  // Initialize with parent edges if provided
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(parentEdges); // Renamed to avoid conflict

  console.log("edges", edges);

  // Sync edges back to parent when they change
  useEffect(() => {
    if (parentOnEdgesChange && edges) {
      parentOnEdgesChange(edges);
    }
  }, [edges, parentOnEdgesChange]);

  // Update local edges when parent edges change
  useEffect(() => {
    if (parentEdges && parentEdges.length > 0) {
      setEdges(parentEdges);
    }
  }, [parentEdges, setEdges]);

  // Update local steps when parent steps change (only for new steps)
  useEffect(() => {
    if (!steps.length) return;

    setLocalSteps((prevLocalSteps) => {
      // Create a map of existing local steps
      const localStepsMap = prevLocalSteps.reduce((map, step) => {
        map[step.id] = step;
        return map;
      }, {} as Record<number, Step>);

      // Merge with preserved values
      return steps.map((parentStep) => {
        const localStep = localStepsMap[parentStep.id];

        if (localStep) {
          return {
            ...parentStep,
            label: localStep.label || parentStep.label,
            instructions: localStep.instructions || parentStep.instructions,
            temperature: localStep.temperature || parentStep.temperature,
          };
        }

        return { ...parentStep };
      });
    });
  }, [steps]);

  // Update step data function
  const updateStepData = useCallback(
    (id: number, field: keyof Step, value: string | number) => {
      // Don't update if disabled
      if (disabled) return;

      // Update local steps
      setLocalSteps((prevSteps) => {
        const newSteps = prevSteps.map((step) =>
          step.id === id ? { ...step, [field]: value } : step
        );

        // Call parent update
        onStepsChange(newSteps);
        return newSteps;
      });
    },
    [onStepsChange, disabled]
  );

  // Track node positions
  const handleNodesChange = useCallback(
    (changes) => {
      // Don't update positions if disabled
      if (disabled) {
        // Only allow selection changes when disabled
        const allowedChanges = changes.filter(
          (change) => change.type === "select"
        );
        if (allowedChanges.length > 0) {
          onNodesChange(allowedChanges);
        }
        return;
      }

      changes.forEach((change) => {
        if (change.type === "position" && change.id && change.position) {
          nodePositionsRef.current[change.id] = { ...change.position };
        }
      });
      onNodesChange(changes);
    },
    [onNodesChange, disabled]
  );

  // Delete a step with proper state updates
  const deleteStep = useCallback(
    (id: number) => {
      // Don't delete if disabled
      if (disabled) return;

      // Remove the step from local steps
      setLocalSteps((prevSteps) => {
        const updatedSteps = prevSteps.filter((step) => step.id !== id);
        onStepsChange(updatedSteps);
        return updatedSteps;
      });

      // Also remove any edges connected to this node
      const nodeId = id.toString();
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
    },
    [onStepsChange, setEdges, disabled]
  );

  // Initialize and sync nodes with steps - combined effect
  useEffect(() => {
    // Handle initialization
    if (localSteps.length > 0 && !initializedRef.current) {
      const initialNodes = localSteps.map((step, index) => ({
        id: step.id.toString(),
        type: "stepNode",
        position: { x: index * 600, y: 100 },
        data: {
          stepId: step.id,
          label: step.label,
          instructions: step.instructions,
          temperature: step.temperature,
          updateStep: updateStepData,
          deleteStep,
          disabled,
        },
        connectable: !disabled,
        draggable: !disabled,
      }));

      setNodes(initialNodes);
      initializedRef.current = true;

      // Store positions
      initialNodes.forEach((node) => {
        nodePositionsRef.current[node.id] = { ...node.position };
      });

      setTimeout(() => fitView({ padding: 0.2 }), 100);
      return;
    }

    // Skip if not initialized
    if (!initializedRef.current || localSteps.length === 0) return;

    // Get node IDs for comparison
    const existingNodeIds = new Set(nodes.map((node) => node.id));
    const stepIds = new Set(localSteps.map((step) => step.id.toString()));

    // Update existing nodes
    const updatedNodes = nodes
      .filter((node) => stepIds.has(node.id))
      .map((node) => {
        const step = localSteps.find((s) => s.id.toString() === node.id);
        return {
          ...node,
          connectable: !disabled,
          draggable: !disabled,
          data: {
            ...node.data,
            stepId: step.id,
            label: step.label,
            instructions: step.instructions,
            temperature: step.temperature,
            disabled,
          },
        };
      });

    // Add new nodes
    const newNodes = localSteps
      .filter((step) => !existingNodeIds.has(step.id.toString()))
      .map((step) => {
        // Position at the end
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
            updateStep: updateStepData,
            deleteStep,
            disabled,
          },
          connectable: !disabled,
          draggable: !disabled,
        };
      });

    // Only update if needed
    if (newNodes.length > 0 || updatedNodes.length !== nodes.length) {
      setNodes([...updatedNodes, ...newNodes]);
    }
  }, [
    localSteps,
    nodes,
    setNodes,
    updateStepData,
    deleteStep,
    fitView,
    disabled,
  ]);

  // Function to show connection errors temporarily
  const showConnectionError = useCallback((message: string) => {
    setConnectionError(message);

    // Clear any existing timeout
    if (connectionErrorTimeoutRef.current) {
      clearTimeout(connectionErrorTimeoutRef.current);
    }

    // Set new timeout to clear message after 3 seconds
    connectionErrorTimeoutRef.current = setTimeout(() => {
      setConnectionError(null);
    }, 3000);
  }, []);

  // Handle connections with validation
  const onConnect = useCallback(
    (params: Connection) => {
      // Don't allow connections if disabled
      if (disabled) {
        showConnectionError("Connections are locked during simulation");
        return;
      }

      // Prevent self-loops (connecting a node to itself)
      if (params.source === params.target) {
        showConnectionError("Cannot connect a node to itself");
        return;
      }

      // Check if source node already has an outgoing connection
      const sourceHasOutgoing = edges.some(
        (edge) => edge.source === params.source
      );
      if (sourceHasOutgoing) {
        showConnectionError("A node can only connect to one other node");
        return;
      }

      // Create a unique ID for the edge
      const uniqueId = `e${params.source}-${params.target}-${Date.now()}`;

      const newEdge = {
        id: uniqueId,
        source: params.source,
        sourceHandle: params.sourceHandle,
        target: params.target,
        targetHandle: params.targetHandle,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: "hsl(var(--primary))",
        },
      };

      // Add the new edge
      setEdges((eds) => [...eds, newEdge]);
    },
    [edges, setEdges, showConnectionError, disabled]
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (connectionErrorTimeoutRef.current) {
        clearTimeout(connectionErrorTimeoutRef.current);
      }
    };
  }, []);

  const areAllStepsFilled = () => {
    return steps.every(
      (step) => step.label.trim() !== "" && step.instructions.trim() !== ""
    );
  };

  const isAddButtonDisabled = !areAllStepsFilled();

  const addStep = () => {
    // Check for maximum steps limit
    if (steps.length >= 20) {
      return; // Don't add more steps if limit reached
    }

    // Only add a new step if all existing steps are filled out
    if (areAllStepsFilled()) {
      const newStepId = steps.length > 0 ? Math.max(...steps.map((s) => s.id)) + 1 : 1;
      const newSteps = [
        ...steps,
        {
          id: newStepId,
          label: "",
          instructions: "",
          temperature: 50,
        },
      ];
      onStepsChange(newSteps);

      // Automatically add an edge from the previous node to the new node
      if (steps.length > 0) {
        const prevNodeId = steps[steps.length - 1].id.toString();
        const newNodeId = newStepId.toString();
        const uniqueId = `e${prevNodeId}-${newNodeId}-${Date.now()}`;
        const newEdge = {
          id: uniqueId,
          source: prevNodeId,
          target: newNodeId,
          animated: true,
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "hsl(var(--primary))",
          },
        };
        setEdges((eds) => [...eds, newEdge]);
      }
    }
  };

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    // Give the DOM time to update before fitting the view
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [fitView]);

  // Context value
  const stepsContextValue = useMemo(
    () => ({
      steps: localSteps,
      updateStepData,
      disabled,
    }),
    [localSteps, updateStepData, disabled]
  );

  const incompleteSteps = localSteps.filter(
    (step) => step.label.trim() === "" || step.instructions.trim() === ""
  );

  return (
    <StepsContext.Provider value={stepsContextValue}>
      <div 
        ref={reactFlowWrapper} 
        style={{ 
          width: isFullscreen ? "100vw" : "100%", 
          height: isFullscreen ? "100vh" : "100%",
          position: isFullscreen ? "fixed" : "relative",
          top: isFullscreen ? 0 : "auto",
          left: isFullscreen ? 0 : "auto",
          zIndex: isFullscreen ? 50 : "auto",
          background: "white"
        }}
      >
        {/* Controls */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1000,
            display: "flex",
            gap: "20px",
          }}
        >
           <Button
              onClick={addStep}
              disabled={
                disabled || isAddButtonDisabled || steps.length >= 20
              }
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          <Button
            onClick={toggleFullscreen}
            disabled={disabled}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
          <Button
            onClick={() => setShowMinimap((prev) => !prev)}
            disabled={disabled}
          >
            {showMinimap ? "Hide Minimap" : "Show Minimap"}
          </Button>
          <Button
            onClick={() => setShowPanel((prev) => !prev)}
            disabled={disabled}
          >
            {showPanel ? "Hide Panel" : "Show Panel"}
          </Button>
        </div>

        {/* Warning Message */}
        {isAddButtonDisabled && incompleteSteps.length > 0 && (
          <div 
            className="text-sm text-amber-600 flex items-center gap-2 absolute top-10 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 px-4 py-2 rounded-md shadow-md"
          >
            <AlertCircle className="h-4 w-4" />
            <span>
              Please fill out all required fields in step
              {incompleteSteps.length > 1 ? "s" : ""}{" "}
              {incompleteSteps.map((s) => s.id).join(", ")} before adding a
              new step.
            </span>
          </div>
        )}

        {/* Simulation Active Warning */}
        {disabled && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              backgroundColor: "rgba(245, 158, 11, 0.9)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "4px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
              maxWidth: "80%",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <LockIcon className="w-4 h-4" />
            Flow editing is locked during simulation
          </div>
        )}

        {/* Connection Error Message */}
        {connectionError && (
          <div
            style={{
              position: "absolute",
              top: disabled ? 60 : 60,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              backgroundColor: "rgba(255, 59, 48, 0.9)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "4px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
              maxWidth: "80%",
              textAlign: "center",
            }}
          >
            {connectionError}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          edgesUpdatable={false}
          edgesFocusable={false}
          onNodesChange={handleNodesChange}
          onEdgesChange={disabled ? () => {} : handleEdgesChange}
          onConnect={() => {}}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "var(--primary)", strokeWidth: 2 },
          }}
          nodesDraggable={!disabled}
          nodesConnectable={false}
          edgesConnectable={false}
          elementsSelectable={false}
        >
          <Background color="#aaa" gap={16} />
          <Controls />

          {/* Minimap */}
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

          {/* Info Panel */}
          {showPanel && (
            <Panel
              position="bottom-center"
              className="bg-white p-2 rounded shadow-md"
              style={{ pointerEvents: "auto" }}
            >
              <div>
                {disabled
                  ? "Editing is locked during simulation"
                  : "Drag nodes to reposition • Connect nodes by dragging between handles"}
              </div>
              <div className="text-xs mt-1 text-gray-500">
                {localSteps.length} steps • {nodes.length} nodes •{" "}
                {edges.length} connections
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </StepsContext.Provider>
  );
}

// Main component with ReactFlowProvider
export default function CognitiveFlow({
  steps,
  edges,
  onStepsChange,
  onEdgesChange,
  disabled = false,
}: {
  steps: Step[];
  edges?: any[];
  onStepsChange: (steps: Step[]) => void;
  onEdgesChange?: (edges: any[]) => void;
  disabled?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <Flow
        steps={steps}
        edges={edges}
        onStepsChange={onStepsChange}
        parentOnEdgesChange={onEdgesChange}
        disabled={disabled}
      />
    </ReactFlowProvider>
  );
}
