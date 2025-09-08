// Cognitive Flow component for the application.
// It is used to display the cognitive flow of the application.
// It is used in the application to display the cognitive flow of the application.

// Import the React library.
"use client";

// Import the React library.
import React from "react";

// Import the necessary hooks from React.
import { useCallback, useEffect, useRef, useMemo, useState } from "react";

// Import the necessary icons from Lucide.
import { Trash2, GripVertical, LockIcon, Plus, AlertCircle, HelpCircle } from "lucide-react";

// Import the Button component from the UI library.
import { Button } from "@/components/ui/button";

// Import the Slider component from the UI library.
import { Slider } from "@/components/ui/slider";

// Import the Tooltip components from the UI library.
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Import the ReactFlow component from the XYFlow library.
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

// Import the isValidURL function from the urlParser file.
import { isValidURL } from "@/app/utils/urlParser";

// Define the Step interface for the application.
interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

// Define the StepNodeProps interface for the application.
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

// Define the StepsContext for the application.
const StepsContext = React.createContext<{
  steps: Step[];
  updateStepData: (
    id: number,
    field: keyof Step,
    value: string | number
  ) => void;
  saveAllStates: () => void;
  disabled?: boolean;
}>({
  steps: [],
  updateStepData: () => {},
  saveAllStates: () => {},
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
      if (!(window as any).nodeValues) (window as any).nodeValues = {};
      if (!(window as any).nodeValues[data.stepId]) (window as any).nodeValues[data.stepId] = {};
      (window as any).nodeValues[data.stepId][field] = value;
    },
    [data.stepId, updateStepData, disabled]
  );

  // Listen for global save events
  useEffect(() => {
    const handleSaveEvent = (event: CustomEvent) => {
      if (event.detail.stepId === data.stepId) {
        // Save current local states if they have changed
        if (localLabel !== (currentStep?.label ?? "")) {
          handleUpdate("label", localLabel);
        }
        if (localInstructions !== (currentStep?.instructions ?? "")) {
          handleUpdate("instructions", localInstructions);
        }
        if (localTemperature !== (currentStep?.temperature ?? 0)) {
          console.log(`Saving temperature for step ${data.stepId}: ${localTemperature} (was: ${currentStep?.temperature ?? 0})`);
          handleUpdate("temperature", localTemperature);
        }
      }
    };

    // Add event listener to the node container
    const nodeElement = document.querySelector(`[data-id="${data.stepId}"]`);
    if (nodeElement) {
      nodeElement.addEventListener('saveNodeState', handleSaveEvent as EventListener);
      
      return () => {
        nodeElement.removeEventListener('saveNodeState', handleSaveEvent as EventListener);
      };
    }
  }, [data.stepId, localLabel, localInstructions, localTemperature, currentStep, handleUpdate]);


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
              className="w-full text-sm border rounded p-2 text-primary pr-12"
              value={localLabel}
              maxLength={250}
              onChange={(e) => {
                if (isDisabled) return;
                const newValue = e.target.value;
                setLocalLabel(newValue);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              disabled={isDisabled}
            />
            <div className="absolute top-2 right-2 text-xs text-muted-foreground">
              {localLabel.length}/250
            </div>
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
              }}
              disabled={isDisabled}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {localInstructions.length}/500
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">Temperature: {localTemperature}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Controls randomness in AI responses. Lower values (0-30) produce more focused, deterministic outputs. Higher values (70-100) generate more creative, varied responses. Moderate values (30-70) balance consistency with creativity.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Slider
              defaultValue={[localTemperature]}
              max={100}
              step={1}
              onValueChange={([value]) => {
                if (isDisabled) return;
                setLocalTemperature(value);
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
  const pendingStepsUpdateRef = useRef<Step[] | null>(null); // Track pending steps update

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
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, handleEdgesChange] = useEdgesState<any>(parentEdges); // Renamed to avoid conflict

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
    if (!steps.length) {
      // If parent steps are empty, clear local steps
      setLocalSteps([]);
      return;
    }

    // Always replace local steps with parent steps completely
    setLocalSteps(steps.map(step => ({ ...step })));
  }, [steps]);

  // Handle pending steps updates
  const processPendingUpdates = useCallback(() => {
    if (pendingStepsUpdateRef.current !== null) {
      onStepsChange(pendingStepsUpdateRef.current);
      pendingStepsUpdateRef.current = null;
    }
  }, [onStepsChange]);

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

        // Store the update to be applied
        pendingStepsUpdateRef.current = newSteps;
        return newSteps;
      });

      // Process the update immediately
      setTimeout(() => processPendingUpdates(), 0);
    },
    [disabled, processPendingUpdates]
  );

  // Track node positions
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      // Don't update positions if disabled
      if (disabled) {
        // Only allow selection changes when disabled
        const allowedChanges = changes.filter(
          (change: any) => change.type === "select"
        );
        if (allowedChanges.length > 0) {
          onNodesChange(allowedChanges);
        }
        return;
      }

      changes.forEach((change: any) => {
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

      const nodeIdToDelete = id.toString();

      // Reconnect edges if a middle node is deleted
      setEdges((currentEdges) => {
        const incomingEdge = currentEdges.find(
          (edge) => edge.target === nodeIdToDelete
        );
        const outgoingEdge = currentEdges.find(
          (edge) => edge.source === nodeIdToDelete
        );

        const prevNodeId = incomingEdge?.source;
        const nextNodeId = outgoingEdge?.target;

        // Remove edges connected to the deleted node
        let updatedEdges = currentEdges.filter(
          (edge) =>
            edge.source !== nodeIdToDelete && edge.target !== nodeIdToDelete
        );

        // If there's a previous and next node, create a new edge to connect them
        if (prevNodeId && nextNodeId) {
          const newEdge = {
            id: `e${prevNodeId}-${nextNodeId}`,
            source: prevNodeId,
            target: nextNodeId,
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: "hsl(var(--primary))",
            },
          };
          updatedEdges.push(newEdge);
        }

        return updatedEdges;
      });

      // Remove the step from local steps
      setLocalSteps((prevSteps) => {
        const updatedSteps = prevSteps.filter((step) => step.id !== id);
        // Store the update to be applied
        pendingStepsUpdateRef.current = updatedSteps;
        return updatedSteps;
      });

      // Process the update immediately
      setTimeout(() => processPendingUpdates(), 0);
    },
    [disabled, processPendingUpdates, setEdges]
  );

  // Derive nodes directly from localSteps to avoid infinite loops
  const derivedNodes = useMemo(() => {
    if (localSteps.length === 0) {
      return [];
    }

    return localSteps.map((step, index) => {
      // Use stored position if available, otherwise use default position
      const storedPosition = nodePositionsRef.current[step.id.toString()];
      const defaultPosition = { x: index * 600, y: 100 };
      
      return {
        id: step.id.toString(),
        type: "stepNode",
        position: storedPosition || defaultPosition,
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
  }, [localSteps, updateStepData, deleteStep, disabled]);

  // Sync derived nodes to ReactFlow state
  useEffect(() => {
    setNodes(derivedNodes);
  }, [derivedNodes, setNodes]);

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

  // Global save function that saves all pending changes
  const saveAllStates = useCallback(() => {
    if (disabled) return;
    
    console.log('saveAllStates called - dispatching save events to all nodes');
    
    // Force save all current local states by triggering updates
    // This will be called when the user clicks outside the flow
    localSteps.forEach(step => {
      // Find the node element and trigger any pending saves
      const nodeElement = document.querySelector(`[data-id="${step.id}"]`);
      if (nodeElement) {
        // Trigger a custom event that nodes can listen to
        const saveEvent = new CustomEvent('saveNodeState', { 
          detail: { stepId: step.id } 
        });
        nodeElement.dispatchEvent(saveEvent);
      }
    });
  }, [disabled, localSteps]);

  // Context value
  const stepsContextValue = useMemo(
    () => ({
      steps: localSteps,
      updateStepData,
      saveAllStates,
      disabled,
    }),
    [localSteps, updateStepData, saveAllStates, disabled]
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
        onBlur={(e) => {
          // Only trigger if the blur is not going to another element within the flow
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            console.log('Flow container lost focus - saving all states');
            // Save all states when focus leaves the flow container
            saveAllStates();
          }
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
            {/* <LockIcon className="w-4 h-4" />
            Flow editing is locked during simulation */}
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
          edgesFocusable={false}
          onNodesChange={handleNodesChange}
          onEdgesChange={disabled ? () => {} : handleEdgesChange}
          onConnect={() => {}}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "var(--primary)", strokeWidth: 2 },
          }}
          nodesDraggable={!disabled}
          nodesConnectable={false}
          edgesReconnectable={false}
          elementsSelectable={true}
          selectNodesOnDrag={false}
          onNodeDragStart={() => {}}
          onNodeDrag={() => {}}
          onNodeDragStop={() => {}}
          onPaneClick={() => {
            // Save all states when clicking on empty pane
            // Trigger blur on all active form elements to save their states
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && typeof activeElement.blur === 'function') {
              activeElement.blur();
            }
          }}
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
