"use client"

import React, { useCallback, useState, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  MarkerType,
  ReactFlowInstance,
  getOutgoers,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

import CustomNode from './react-flow/node'

const nodeTypes = {
  custom: CustomNode as any,
}

const flowKey = 'simulation-flow';

interface ReactFlowAppProps {
  onFlowDataChange?: (nodes: Node[], edges: Edge[]) => void;
  selectedColor?: string;
}

function ReactFlowComponent({ onFlowDataChange, selectedColor = '#3b82f6' }: ReactFlowAppProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const { setViewport } = useReactFlow()

  

  // Notify parent component when flow data changes
  useEffect(() => {
    if (onFlowDataChange) {
      onFlowDataChange(nodes, edges)
    }
  }, [nodes, edges, onFlowDataChange])

  // Auto-save flow state to localStorage whenever nodes or edges change
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      saveFlowToStorage()
    }
  }, [nodes, edges])

  // Load flow state from localStorage on component mount
  useEffect(() => {
    loadFlowFromStorage()
  }, [])

  // Save flow state to localStorage
  const saveFlowToStorage = useCallback(() => {
    if (reactFlowInstance.current) {
      const flow = reactFlowInstance.current.toObject()
      localStorage.setItem(flowKey, JSON.stringify(flow))
    }
  }, [])

  // Load flow state from localStorage
  const loadFlowFromStorage = useCallback(() => {
    const restoreFlow = async () => {
      try {
        const flowData = localStorage.getItem(flowKey)
        if (flowData) {
          const flow = JSON.parse(flowData)
          if (flow) {
            const { x = 0, y = 0, zoom = 1 } = flow.viewport || {}
            setNodes(flow.nodes || [])
            setEdges(flow.edges || [])
            setViewport({ x, y, zoom })
          }
        }
      } catch (error) {
        console.error('Error loading flow from storage:', error)
      }
    }
    restoreFlow()
  }, [setNodes, setEdges, setViewport])

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // Prevent self-connections
      if (connection.source === connection.target) return false;
      
      // Get current nodes and edges
      const currentNodes = nodes;
      const currentEdges = edges;
      
      // Find the target node
      const target = currentNodes.find((node) => node.id === connection.target);
      if (!target) return false;
      
      // Check for cycles using depth-first search
      const hasCycle = (node: Node, visited = new Set<string>()): boolean => {
        if (visited.has(node.id)) return false;
        
        visited.add(node.id);
        
        // Get all outgoing connections from this node
        const outgoers = getOutgoers(node, currentNodes, currentEdges);
        
        for (const outgoer of outgoers) {
          // If we find a path back to the source, we have a cycle
          if (outgoer.id === connection.source) return true;
          // Recursively check if this outgoer leads to a cycle
          if (hasCycle(outgoer, visited)) return true;
        }
        
        return false;
      };
      
      return !hasCycle(target);
    },
    [nodes, edges]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge({
      ...params,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#3b82f6',
      },
    }, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
    console.log(`Node ${node.id} clicked and highlighted with color: ${selectedColor}`)
    
    // Update the node data to include the selected color
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id 
          ? { ...n, data: { ...n.data, selectedColor } }
          : n
      )
    )
  }, [selectedColor, setNodes])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds: Node[]) => nds.filter((node: Node) => node.id !== nodeId))
    setEdges((eds: Edge[]) => eds.filter((edge: Edge) => edge.source !== nodeId && edge.target !== nodeId))
  }, [setNodes, setEdges])

  const handleTitleChange = useCallback((nodeId: string, title: string) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, title } } : node
      )
    )
  }, [setNodes])

  const handleDescriptionChange = useCallback((nodeId: string, description: string) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, description } } : node
      )
    )
  }, [setNodes])

  const handleSliderChange = useCallback((nodeId: string, value: number) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, sliderValue: value } } : node
      )
    )
  }, [setNodes])

  // Generate the next sequential node ID
  const getNextNodeId = useCallback((currentNodes: Node[]) => {
    // Extract all node IDs and find the highest number
    const nodeIds = currentNodes.map(node => node.id).filter(id => /^\d+$/.test(id))
    const numbers = nodeIds.map((id: string) => parseInt(id))
    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0
    return `${maxNumber + 1}`
  }, [])

  const handleAddNode = useCallback(() => {
    if (!reactFlowInstance.current) return
    
    const newNodeId = getNextNodeId(nodes)
    const gridSize = 40 // Match the snapGrid size
    const nodeSpacing = 400 // Horizontal spacing between nodes
    
    // Find the rightmost node to place the new node to its right
    let baseX = 0
    let baseY = 0
    
    if (nodes.length > 0) {
      // Find the rightmost node
      const rightmostNode = nodes.reduce((rightmost, node) => 
        node.position.x > rightmost.position.x ? node : rightmost
      )
      baseX = rightmostNode.position.x + nodeSpacing
      baseY = rightmostNode.position.y
    } else {
      // If no nodes exist, place the first node in the center
      const centerX = dimensions.width / 2
      const centerY = dimensions.height / 2
      const centerPosition = reactFlowInstance.current.screenToFlowPosition({
        x: centerX,
        y: centerY,
      })
      baseX = centerPosition.x
      baseY = centerPosition.y
    }
    
    // Snap the position to the grid
    const snappedX = Math.round(baseX / gridSize) * gridSize
    const snappedY = Math.round(baseY / gridSize) * gridSize
    
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: {
        x: snappedX,
        y: snappedY,
      },
      data: {
        title: '',
        description: '',
        sliderValue: 50,
        numDescriptionsChars: 500,
        onDelete: handleNodeDelete,
        onTitleChange: handleTitleChange,
        onDescriptionChange: handleDescriptionChange,
        onSliderChange: handleSliderChange,
      },
    }
    setNodes((nds: Node[]) => [...nds, newNode])
  }, [setNodes, handleNodeDelete, handleTitleChange, handleDescriptionChange, handleSliderChange, dimensions, nodes, getNextNodeId])

  // Update node data with handlers and highlighting
  const nodesWithHandlers = nodes.map((node: Node) => ({
    ...node,
    data: {
      ...node.data,
      onDelete: handleNodeDelete,
      onTitleChange: handleTitleChange,
      onDescriptionChange: handleDescriptionChange,
      onSliderChange: handleSliderChange,
    },
    style: {
      ...node.style,
      border: selectedNodeId === node.id ? `3px solid ${selectedColor}` : '1px solid #e5e7eb',
      boxShadow: selectedNodeId === node.id ? `0 0 0 3px ${selectedColor}40` : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    },
  }))

  return (
    <div ref={containerRef} className="w-full h-full relative bg-gray-50">
      {/* Add Node Button */}
      <div className="absolute top-4 left-4 z-10">
        <Button 
          onClick={handleAddNode} 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
      </div>

      
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid={true}
        snapGrid={[40, 40]}
        className="bg-gray-50"
        onInit={(instance) => {
          reactFlowInstance.current = instance as unknown as ReactFlowInstance<Node, Edge>
        }}
      >
        <Controls 
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
          style={{ 
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}
        />
        <MiniMap 
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
          style={{ 
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={80} 
          size={10} 
          color="black"
          className="opacity-15"
        />
      </ReactFlow>
    </div>
  )
}

export default function ReactFlowApp({ onFlowDataChange, selectedColor }: ReactFlowAppProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowComponent onFlowDataChange={onFlowDataChange} selectedColor={selectedColor} />
    </ReactFlowProvider>
  )
}
