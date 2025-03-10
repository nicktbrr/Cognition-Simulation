// "use client"

// import { useCallback, useEffect, useRef, useMemo } from "react"
// import { Trash2, GripVertical } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import {
//   ReactFlow,
//   type Node,
//   type Edge,
//   addEdge,
//   Background,
//   Controls,
//   type Connection,
//   useNodesState,
//   useEdgesState,
//   type NodeProps,
//   Handle,
//   Position,
//   type NodeTypes,
//   ReactFlowProvider,
//   useReactFlow,
//   Panel,
// } from "@xyflow/react"
// import "@xyflow/react/dist/style.css"

// interface Step {
//   id: number
//   label: string
//   instructions: string
//   temperature: number
// }

// interface StepNodeProps extends NodeProps {
//   data: {
//     stepId: number
//     label: string
//     instructions: string
//     temperature: number
//     updateStep: (id: number, field: keyof Step, value: string | number) => void
//     deleteStep: (id: number) => void
//   }
// }

// // Custom node component for steps
// function StepNode({ data }: StepNodeProps) {
//   return (
//     <div className="w-[220px] p-4 border border-primary rounded-md bg-white shadow-md">
//       <div className="space-y-2">
//         <div className="flex items-center justify-between">
//           <div className="cursor-grab active:cursor-grabbing hover:text-primary">
//             <GripVertical className="w-4 h-4" />
//           </div>
//           <span className="text-xs text-muted-foreground">Step {data.stepId}</span>
//         </div>
//         <input
//           type="text"
//           placeholder="[Add Label]"
//           className="w-full text-sm border rounded p-2 text-primary"
//           value={data.label}
//           onChange={(e) => data.updateStep(data.stepId, "label", e.target.value)}
//         />
//         <textarea
//           className="w-full h-24 text-sm resize-none border rounded p-2"
//           placeholder="[Enter instructions, as if you were asking a human to complete this step.]"
//           value={data.instructions}
//           onChange={(e) => data.updateStep(data.stepId, "instructions", e.target.value)}
//         />
//         <div className="space-y-1">
//           <div className="text-sm">Temperature: {data.temperature}</div>
//           <input
//             type="range"
//             min="0"
//             max="100"
//             value={data.temperature}
//             onChange={(e) => data.updateStep(data.stepId, "temperature", Number.parseInt(e.target.value))}
//             className="w-full accent-primary"
//           />
//         </div>
//         <Button variant="destructive" size="sm" className="w-full" onClick={() => data.deleteStep(data.stepId)}>
//           <Trash2 className="w-4 h-4 mr-2" />
//           Delete
//         </Button>
//       </div>
//       <Handle type="target" position={Position.Left} style={{ background: "#555" }} isConnectable={true} />
//       <Handle type="source" position={Position.Right} style={{ background: "#555" }} isConnectable={true} />
//     </div>
//   )
// }

// // Flow content component
// function Flow({
//   steps,
//   onStepsChange,
// }: {
//   steps: Step[]
//   onStepsChange: (steps: Step[]) => void
// }) {
//   const reactFlowWrapper = useRef<HTMLDivElement>(null)
//   const reactFlowInstance = useReactFlow()

//   // Define node types
//   const nodeTypes = useMemo<NodeTypes>(
//     () => ({
//       stepNode: StepNode,
//     }),
//     [],
//   )

//   const [nodes, setNodes, onNodesChange] = useNodesState([])
//   const [edges, setEdges, onEdgesChange] = useEdgesState([])

//   // Update a step's properties
//   const updateStep = useCallback(
//     (id: number, field: keyof Step, value: string | number) => {
//       const updatedSteps = steps.map((step) => (step.id === id ? { ...step, [field]: value } : step))
//       onStepsChange(updatedSteps)
//     },
//     [steps, onStepsChange],
//   )

//   // Delete a step
//   const deleteStep = useCallback(
//     (id: number) => {
//       const updatedSteps = steps.filter((step) => step.id !== id)
//       onStepsChange(updatedSteps)
//     },
//     [steps, onStepsChange],
//   )

//   // Create nodes and edges from steps
//   const updateNodesAndEdges = useCallback(() => {
//     if (!steps.length) return

//     // Create nodes from steps
//     const newNodes: Node[] = steps.map((step, index) => ({
//       id: step.id.toString(),
//       type: "stepNode",
//       position: { x: index * 300, y: 100 },
//       data: {
//         stepId: step.id,
//         label: step.label,
//         instructions: step.instructions,
//         temperature: step.temperature,
//         updateStep,
//         deleteStep,
//       },
//     }))

//     // Create edges between consecutive nodes
//     const newEdges: Edge[] = []
//     for (let i = 0; i < steps.length - 1; i++) {
//       newEdges.push({
//         id: `e${steps[i].id}-${steps[i + 1].id}`,
//         source: steps[i].id.toString(),
//         target: steps[i + 1].id.toString(),
//         animated: true,
//         style: { stroke: "var(--primary)", strokeWidth: 2 },
//       })
//     }

//     setNodes(newNodes)
//     setEdges(newEdges)

//     // Fit view after a short delay
//     setTimeout(() => {
//       if (reactFlowInstance) {
//         reactFlowInstance.fitView({ padding: 0.2 })
//       }
//     }, 50)
//   }, [steps, updateStep, deleteStep, setNodes, setEdges, reactFlowInstance])

//   // Handle connections between nodes
//   const onConnect = useCallback(
//     (params: Connection) => {
//       // Check if this connection would create a duplicate
//       const edgeExists = edges.some((edge) => edge.source === params.source && edge.target === params.target)

//       if (!edgeExists) {
//         setEdges((eds) =>
//           addEdge(
//             {
//               ...params,
//               animated: true,
//               style: { stroke: "var(--primary)", strokeWidth: 2 },
//             },
//             eds,
//           ),
//         )
//       }
//     },
//     [edges, setEdges],
//   )

//   // Update flow when steps change
//   useEffect(() => {
//     updateNodesAndEdges()
//   }, [steps, updateNodesAndEdges])

//   return (
//     <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
//       <ReactFlow
//         nodes={nodes}
//         edges={edges}
//         onNodesChange={onNodesChange}
//         onEdgesChange={onEdgesChange}
//         onConnect={onConnect}
//         nodeTypes={nodeTypes}
//         fitView
//         fitViewOptions={{ padding: 0.2 }}
//         defaultViewport={{ x: 0, y: 0, zoom: 1 }}
//         minZoom={0.5}
//         maxZoom={1.5}
//         proOptions={{ hideAttribution: true }}
//       >
//         <Background color="#aaa" gap={16} />
//         <Controls />
//         <Panel position="bottom-center" className="bg-white p-2 rounded shadow-md">
//           Drag nodes to reposition • Connect nodes by dragging between handles
//         </Panel>
//       </ReactFlow>
//     </div>
//   )
// }

// // Main component with ReactFlowProvider
// export default function CognitiveFlow({
//   steps,
//   onStepsChange,
// }: {
//   steps: Step[]
//   onStepsChange: (steps: Step[]) => void
// }) {
//   return (
//     <ReactFlowProvider>
//       <Flow steps={steps} onStepsChange={onStepsChange} />
//     </ReactFlowProvider>
//   )
// }


"use client"

import { useCallback, useEffect, useRef, useMemo, useState } from "react"
import { Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ReactFlow,
  type Node,
  type Edge,
  addEdge,
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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

interface Step {
  id: number
  label: string
  instructions: string
  temperature: number
}

interface StepNodeProps extends NodeProps {
  data: {
    stepId: number
    label: string
    instructions: string
    temperature: number
    updateStep: (id: number, field: keyof Step, value: string | number) => void
    deleteStep: (id: number) => void
  }
}

// Custom node component for steps
function StepNode({ data }: StepNodeProps) {
  return (
    <div className="w-[220px] p-4 border border-primary rounded-md bg-white shadow-md">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="cursor-grab active:cursor-grabbing hover:text-primary">
            <GripVertical className="w-4 h-4" />
          </div>
          <span className="text-xs text-muted-foreground">Step {data.stepId}</span>
        </div>
        <input
          type="text"
          placeholder="[Add Label]"
          className="w-full text-sm border rounded p-2 text-primary"
          value={data.label}
          onChange={(e) => data.updateStep(data.stepId, "label", e.target.value)}
        />
        <textarea
          className="w-full h-24 text-sm resize-none border rounded p-2"
          placeholder="[Enter instructions, as if you were asking a human to complete this step.]"
          value={data.instructions}
          onChange={(e) => data.updateStep(data.stepId, "instructions", e.target.value)}
        />
        <div className="space-y-1">
          <div className="text-sm">Temperature: {data.temperature}</div>
          <input
            type="range"
            min="0"
            max="100"
            value={data.temperature}
            onChange={(e) => data.updateStep(data.stepId, "temperature", Number.parseInt(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <Button variant="destructive" size="sm" className="w-full" onClick={() => data.deleteStep(data.stepId)}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>
      <Handle type="target" position={Position.Left} style={{ background: "#555" }} isConnectable={true} />
      <Handle type="source" position={Position.Right} style={{ background: "#555" }} isConnectable={true} />
    </div>
  )
}

// Flow content component
function Flow({
  steps,
  onStepsChange,
}: {
  steps: Step[]
  onStepsChange: (steps: Step[]) => void
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useReactFlow()

  // New state to toggle panel visibility
  const [showPanel, setShowPanel] = useState(true)

  // Define node types
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      stepNode: StepNode,
    }),
    [],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Update a step's properties
  const updateStep = useCallback(
    (id: number, field: keyof Step, value: string | number) => {
      const updatedSteps = steps.map((step) => (step.id === id ? { ...step, [field]: value } : step))
      onStepsChange(updatedSteps)
    },
    [steps, onStepsChange],
  )

  // Delete a step
  const deleteStep = useCallback(
    (id: number) => {
      const updatedSteps = steps.filter((step) => step.id !== id)
      onStepsChange(updatedSteps)
    },
    [steps, onStepsChange],
  )

  // Create nodes and edges from steps
  const updateNodesAndEdges = useCallback(() => {
    if (!steps.length) return

    // Create nodes from steps
    const newNodes: Node[] = steps.map((step, index) => ({
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
    }))

    // Create edges between consecutive nodes
    const newEdges: Edge[] = []
    for (let i = 0; i < steps.length - 1; i++) {
      newEdges.push({
        id: `e${steps[i].id}-${steps[i + 1].id}`,
        source: steps[i].id.toString(),
        target: steps[i + 1].id.toString(),
        animated: true,
        style: { stroke: "var(--primary)", strokeWidth: 2 },
      })
    }
    console.log(newNodes)
    console.log(newEdges)
    setNodes(newNodes)
    setEdges(newEdges)

    // Fit view after a short delay
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 })
      }
    }, 50)
  }, [steps, updateStep, deleteStep, setNodes, setEdges, reactFlowInstance])

  // Handle connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      // Check if this connection would create a duplicate
      const edgeExists = edges.some((edge) => edge.source === params.source && edge.target === params.target)

      if (!edgeExists) {
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              animated: true,
              style: { stroke: "var(--primary)", strokeWidth: 2 },
            },
            eds,
          ),
        )
      }
    },
    [edges, setEdges],
  )

  // Update flow when steps change
  useEffect(() => {
    updateNodesAndEdges()
  }, [steps, updateNodesAndEdges])

  return (
    <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
      {/* Toggle button to show/hide the panel */}
      <Button
        onClick={() => setShowPanel((prev) => !prev)}
        style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}
      >
        {showPanel ? "Hide Panel" : "Show Panel"}
      </Button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        {showPanel && (
          <Panel
            position="bottom-center"
            className="bg-white p-2 rounded shadow-md"
            // Prevent panel from intercepting pointer events
            style={{ pointerEvents: "none" }}
          >
            <div style={{ pointerEvents: "auto" }}>
              Drag nodes to reposition • Connect nodes by dragging between handles
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

// Main component with ReactFlowProvider
export default function CognitiveFlow({
  steps,
  onStepsChange,
}: {
  steps: Step[]
  onStepsChange: (steps: Step[]) => void
}) {
  return (
    <ReactFlowProvider>
      <Flow steps={steps} onStepsChange={onStepsChange} />
    </ReactFlowProvider>
  )
}

