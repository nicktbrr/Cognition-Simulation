"use client"

import React, { useCallback, useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
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
import { Plus, Maximize2, Minimize2 } from 'lucide-react'

import CustomNode from './react-flow/node'

const nodeTypes = {
  custom: CustomNode as any,
}

const flowKey = 'simulation-flow';

interface Measure {
  id: string;
  title: string;
  description: string;
  range: string;
  desiredValues: Array<{ value: number; label: string }>;
}

interface ReactFlowAppProps {
  onFlowDataChange?: (nodes: Node[], edges: Edge[]) => void;
  selectedColor?: string;
  colorArmed?: boolean;
  onColorApplied?: () => void;
  measures?: Measure[];
  loadingMeasures?: boolean;
}

export interface ReactFlowRef {
  clearFlow: () => void;
  setNodesAndEdges: (newNodes: Node[], newEdges: Edge[]) => void;
}

const ReactFlowComponent = forwardRef<ReactFlowRef, ReactFlowAppProps>(({ onFlowDataChange, selectedColor = '#3b82f6', colorArmed = false, onColorApplied, measures = [], loadingMeasures = false }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
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

  // Expose clear function and setNodesAndEdges to parent component
  useImperativeHandle(ref, () => ({
    clearFlow: () => {
      setNodes([])
      setEdges([])
      setSelectedNodeId(null)
      setViewport({ x: 0, y: 0, zoom: 1 })
      localStorage.removeItem(flowKey)
    },
    setNodesAndEdges: (newNodes: Node[], newEdges: Edge[]) => {
      setNodes(newNodes)
      setEdges(newEdges)
      // Auto-fit the view to show all nodes
      setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ padding: 0.2 })
        }
      }, 50)
    }
  }), [setNodes, setEdges, setViewport])

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
    
    // Only apply color if a color is armed (user clicked a color first)
    if (colorArmed && selectedColor) {
      // Update the node data to include the selected color
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id 
            ? { ...n, data: { ...n.data, selectedColor } }
            : n
        )
      )
      // Notify parent that color was applied, so it can disarm
      if (onColorApplied) {
        onColorApplied()
      }
    }
  }, [selectedColor, colorArmed, setNodes, onColorApplied])

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

  const handleMeasuresChange = useCallback((nodeId: string, selectedMeasures: string[]) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, selectedMeasures } } : node
      )
    )
  }, [setNodes])

  const handleResize = useCallback((nodeId: string, width: number, height: number) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId 
          ? { 
              ...node, 
              width: width,
              height: height,
              data: { ...node.data, width, height } 
            } 
          : node
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
    if (!reactFlowInstance.current || !containerRef.current) return
    
    const newNodeId = getNextNodeId(nodes)
    const gridSize = 40 // Match the snapGrid size
    
    // Get the ReactFlow pane element (the actual flow area)
    const paneElement = containerRef.current.querySelector('.react-flow__pane') as HTMLElement
    if (!paneElement) return
    
    // Get the pane position and dimensions on screen
    const paneRect = paneElement.getBoundingClientRect()
    // Calculate center in screen coordinates (relative to viewport)
    // Add small offsets to move slightly left and up
    const centerX = paneRect.left + paneRect.width / 2 - 90
    const centerY = paneRect.top + paneRect.height / 2 - 150
    
    // Convert screen coordinates to flow coordinates
    const centerPosition = reactFlowInstance.current.screenToFlowPosition({
      x: centerX,
      y: centerY,
    })
    
    // Snap the position to the grid
    const snappedX = Math.round(centerPosition.x / gridSize) * gridSize
    const snappedY = Math.round(centerPosition.y / gridSize) * gridSize
    
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: {
        x: snappedX,
        y: snappedY,
      },
      width: 400,
      height: 600, // Set explicit initial height to prevent auto-sizing loop
      data: {
        title: '',
        description: '',
        sliderValue: 50,
        numDescriptionsChars: 500,
        selectedMeasures: [],
        measures: measures,
        loadingMeasures: loadingMeasures,
        width: 400,
        height: 600,
        onDelete: handleNodeDelete,
        onTitleChange: handleTitleChange,
        onDescriptionChange: handleDescriptionChange,
        onSliderChange: handleSliderChange,
        onMeasuresChange: handleMeasuresChange,
        onResize: handleResize,
      },
    }
    setNodes((nds: Node[]) => [...nds, newNode])
  }, [setNodes, handleNodeDelete, handleTitleChange, handleDescriptionChange, handleSliderChange, handleMeasuresChange, handleResize, nodes, getNextNodeId, measures, loadingMeasures])

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      // Enter fullscreen
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen()
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen()
      }
      setIsFullscreen(true)
      
      // Center nodes when entering fullscreen
      setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ 
            padding: 0.2,
            duration: 300 
          })
        }
      }, 100)
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen()
      }
      setIsFullscreen(false)
      
      // Center nodes when exiting fullscreen
      setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ 
            padding: 0.2,
            duration: 300 
          })
        }
      }, 100)
    }
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
      
      // Center nodes when entering or exiting fullscreen
      if (reactFlowInstance.current) {
        // Use setTimeout to ensure the fullscreen transition is complete
        setTimeout(() => {
          if (reactFlowInstance.current) {
            reactFlowInstance.current.fitView({ 
              padding: 0.2,
              duration: 300 
            })
          }
        }, 100)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Update node data with handlers and highlighting
  const nodesWithHandlers = nodes.map((node: Node) => ({
    ...node,
    width: (typeof node.width === 'number' ? node.width : (typeof node.data?.width === 'number' ? node.data.width : 400)) as number,
    height: (typeof node.height === 'number' ? node.height : (typeof node.data?.height === 'number' ? node.data.height : 600)) as number, // Default height to prevent auto-sizing
    data: {
      ...node.data,
      measures: measures,
      loadingMeasures: loadingMeasures,
      selectedMeasures: node.data?.selectedMeasures || [],
      width: (typeof node.width === 'number' ? node.width : (typeof node.data?.width === 'number' ? node.data.width : 400)) as number,
      height: (typeof node.height === 'number' ? node.height : (typeof node.data?.height === 'number' ? node.data.height : 600)) as number, // Default height to prevent auto-sizing
      onDelete: handleNodeDelete,
      onTitleChange: handleTitleChange,
      onDescriptionChange: handleDescriptionChange,
      onSliderChange: handleSliderChange,
      onMeasuresChange: handleMeasuresChange,
      onResize: handleResize,
    },
    style: {
      ...node.style,
      border: selectedNodeId === node.id ? '3px solid #3b82f6' : '1px solid #e5e7eb',
      boxShadow: selectedNodeId === node.id ? '0 0 0 3px rgba(59, 130, 246, 0.25)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
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

      {/* Fullscreen Toggle Button - Lower Left */}
      <div className="absolute bottom-4 left-4 z-10">
        <Button 
          onClick={toggleFullscreen}
          variant="outline"
          className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4" />
              Exit Fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              Fullscreen
            </>
          )}
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
        {/* Controls hidden - replaced with custom fullscreen button */}
        <MiniMap 
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
          style={{ 
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}
        />
      </ReactFlow>
    </div>
  )
})

ReactFlowComponent.displayName = 'ReactFlowComponent'

const ReactFlowApp = forwardRef<ReactFlowRef, ReactFlowAppProps>(({ onFlowDataChange, selectedColor, colorArmed, onColorApplied, measures, loadingMeasures }, ref) => {
  return (
    <ReactFlowProvider>
      <ReactFlowComponent 
        ref={ref}
        onFlowDataChange={onFlowDataChange} 
        selectedColor={selectedColor}
        colorArmed={colorArmed}
        onColorApplied={onColorApplied}
        measures={measures}
        loadingMeasures={loadingMeasures}
      />
    </ReactFlowProvider>
  )
})

ReactFlowApp.displayName = 'ReactFlowApp'

export default ReactFlowApp
