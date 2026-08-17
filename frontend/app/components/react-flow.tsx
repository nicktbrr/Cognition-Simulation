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
import { analyzeSampleBalance, edgeKey, splitEvenly, splitProportion } from '../utils/stepGraph'

const nodeTypes = {
  custom: CustomNode as any,
}

const flowKey = 'simulation-flow';

const getSampleProportion = (node: Node) =>
  typeof node.data?.sampleProportion === 'number' ? node.data.sampleProportion : 100;

/** Trim the rounding tail so 33.34 reads as 33.34 and 50.00 reads as 50. */
const formatPercent = (value: number) => `${Math.round(value * 100) / 100}%`;

/**
 * Push a set of new proportions down through the steps that follow them.
 *
 * Every step must hand its whole sample to the steps after it, so changing one
 * proportion changes everything downstream of it. Each step's children are
 * re-split across the step's new proportion, keeping whatever ratio the user
 * had set between them (an untouched even split stays even), and the split is
 * done in hundredths so the parts add back up exactly.
 *
 * Only children with a single parent are touched - once branches merge, the
 * split is ambiguous, so those proportions are left for the user to set and
 * validation guides them.
 */
const applyProportions = (nodes: Node[], edges: Edge[], seeds: Map<string, number>) => {
  const updates = new Map(seeds);
  const proportionOf = (nodeId: string) => {
    if (updates.has(nodeId)) return updates.get(nodeId)!;
    const node = nodes.find((candidate) => candidate.id === nodeId);
    return node ? getSampleProportion(node) : 100;
  };

  const queue = [...seeds.keys()];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);

    const childIds = edges.filter((edge) => edge.source === parentId).map((edge) => edge.target);
    if (childIds.length === 0) continue;

    const allSingleParent = childIds.every(
      (childId) => edges.filter((edge) => edge.target === childId).length === 1
    );
    if (!allSingleParent) continue;

    const shares = splitProportion(proportionOf(parentId), childIds.map(proportionOf));
    childIds.forEach((childId, index) => {
      updates.set(childId, shares[index]);
      queue.push(childId);
    });
  }

  const changed = [...updates.entries()].filter(([nodeId, value]) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    return node && getSampleProportion(node) !== value;
  });
  if (changed.length === 0) return nodes;

  return nodes.map((node) =>
    updates.has(node.id)
      ? { ...node, data: { ...node.data, sampleProportion: updates.get(node.id) } }
      : node
  );
};

/** Split each listed step's sample evenly across its branches, then cascade. */
const rebalanceChildren = (nodes: Node[], edges: Edge[], parentIds: Array<string | null>) => {
  const seeds = new Map<string, number>();

  for (const parentId of parentIds) {
    if (!parentId) continue;
    const parent = nodes.find((node) => node.id === parentId);
    if (!parent) continue;

    const childIds = edges.filter((edge) => edge.source === parentId).map((edge) => edge.target);
    if (childIds.length === 0) continue;

    const allSingleParent = childIds.every(
      (childId) => edges.filter((edge) => edge.target === childId).length === 1
    );
    if (!allSingleParent) continue;

    const shares = splitEvenly(getSampleProportion(parent), childIds.length);
    childIds.forEach((childId, index) => seeds.set(childId, shares[index]));
  }

  if (seeds.size === 0) return nodes;
  return applyProportions(nodes, edges, seeds);
};

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
  readOnly?: boolean;
}

export interface ReactFlowRef {
  clearFlow: () => void;
  setNodesAndEdges: (newNodes: Node[], newEdges: Edge[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const ReactFlowComponent = forwardRef<ReactFlowRef, ReactFlowAppProps>(({ onFlowDataChange, selectedColor = '#3b82f6', colorArmed = false, onColorApplied, measures = [], loadingMeasures = false, readOnly = false }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  // The step whose sample proportion was changed last - the only one called
  // out in red when the sample stops adding up.
  const [lastEditedNodeId, setLastEditedNodeId] = useState<string | null>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { setViewport } = useReactFlow()

  // Undo/Redo history state
  const [history, setHistory] = useState<Array<{ nodes: Node[], edges: Edge[] }>>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const historyIndexRef = useRef<number>(-1)
  const isUndoRedoRef = useRef<boolean>(false)
  const previousStateRef = useRef<{ nodes: Node[], edges: Edge[] } | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const isEditingTextRef = useRef<boolean>(false)
  
  // Keep ref in sync with state
  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  

  // Helper function to deep clone nodes and edges
  const cloneState = useCallback((nodesToClone: Node[], edgesToClone: Edge[]) => {
    return {
      nodes: JSON.parse(JSON.stringify(nodesToClone)),
      edges: JSON.parse(JSON.stringify(edgesToClone))
    }
  }, [])

  // Helper function to check if two states are different
  const statesAreDifferent = useCallback((state1: { nodes: Node[], edges: Edge[] }, state2: { nodes: Node[], edges: Edge[] }) => {
    if (state1.nodes.length !== state2.nodes.length || state1.edges.length !== state2.edges.length) {
      return true
    }
    
    // Compare nodes
    for (let i = 0; i < state1.nodes.length; i++) {
      const node1 = state1.nodes[i]
      const node2 = state2.nodes[i]
      if (node1.id !== node2.id || 
          JSON.stringify(node1.position) !== JSON.stringify(node2.position) ||
          JSON.stringify(node1.data) !== JSON.stringify(node2.data)) {
        return true
      }
    }
    
    // Compare edges
    for (let i = 0; i < state1.edges.length; i++) {
      const edge1 = state1.edges[i]
      const edge2 = state2.edges[i]
      if (edge1.id !== edge2.id || 
          edge1.source !== edge2.source || 
          edge1.target !== edge2.target) {
        return true
      }
    }
    
    return false
  }, [])

  // Function to save current state to history
  const saveToHistory = useCallback(() => {
    const currentState = { nodes, edges }
    
    // Only track if state actually changed
    if (previousStateRef.current && statesAreDifferent(previousStateRef.current, currentState)) {
      // Create a new history entry using functional updates to avoid stale state
      setHistory((prevHistory) => {
        const currentIndex = historyIndexRef.current
        const newHistory = prevHistory.slice(0, currentIndex + 1) // Remove any "future" history if we're not at the end
        const clonedState = cloneState(nodes, edges)
        
        // Add new state to history (limit to last 3 changes)
        const updatedHistory = [...newHistory, clonedState]
        const limitedHistory = updatedHistory.slice(-3) // Keep only last 3 changes
        
        // Update index to point to the new entry
        const newIndex = limitedHistory.length - 1
        setHistoryIndex(newIndex)
        historyIndexRef.current = newIndex
        
        return limitedHistory
      })
    } else if (!previousStateRef.current) {
      // Initial state - save it
      const clonedState = cloneState(nodes, edges)
      setHistory([clonedState])
      setHistoryIndex(0)
      historyIndexRef.current = 0
    }
    
    previousStateRef.current = { nodes, edges }
  }, [nodes, edges, cloneState, statesAreDifferent])

  // Track changes to nodes/edges for undo/redo (only if not from undo/redo operation, not dragging, and not editing text)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      // Skip tracking during undo/redo
      isUndoRedoRef.current = false
      previousStateRef.current = { nodes, edges }
      return
    }

    // Skip tracking during drag or text editing - we'll save on drag end or blur
    if (isDraggingRef.current || isEditingTextRef.current) {
      return
    }

    // For other changes (add node, delete node, connect edge, etc.), save immediately
    const currentState = { nodes, edges }
    
    // Only track if state actually changed
    if (previousStateRef.current && statesAreDifferent(previousStateRef.current, currentState)) {
      saveToHistory()
    } else if (!previousStateRef.current) {
      // Initial state - save it
      const clonedState = cloneState(nodes, edges)
      setHistory([clonedState])
      setHistoryIndex(0)
      historyIndexRef.current = 0
      previousStateRef.current = currentState
    }
  }, [nodes, edges, cloneState, statesAreDifferent, saveToHistory])

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

  // Undo function
  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current
    if (currentIndex > 0) {
      isUndoRedoRef.current = true
      const previousState = history[currentIndex - 1]
      setNodes(previousState.nodes)
      setEdges(previousState.edges)
      const newIndex = currentIndex - 1
      setHistoryIndex(newIndex)
      historyIndexRef.current = newIndex
      previousStateRef.current = previousState
    }
  }, [history, setNodes, setEdges])

  // Redo function
  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current
    if (currentIndex < history.length - 1) {
      isUndoRedoRef.current = true
      const nextState = history[currentIndex + 1]
      setNodes(nextState.nodes)
      setEdges(nextState.edges)
      const newIndex = currentIndex + 1
      setHistoryIndex(newIndex)
      historyIndexRef.current = newIndex
      previousStateRef.current = nextState
    }
  }, [history, setNodes, setEdges])

  // Check if undo is possible
  const canUndo = useCallback(() => {
    return historyIndexRef.current > 0
  }, [])

  // Check if redo is possible
  const canRedo = useCallback(() => {
    return historyIndexRef.current < history.length - 1
  }, [history.length])

  // Expose clear function, setNodesAndEdges, and undo/redo to parent component
  useImperativeHandle(ref, () => ({
    clearFlow: () => {
      setNodes([])
      setEdges([])
      setSelectedNodeId(null)
      setLastEditedNodeId(null)
      setViewport({ x: 0, y: 0, zoom: 1 })
      localStorage.removeItem(flowKey)
      setHistory([])
      setHistoryIndex(-1)
      historyIndexRef.current = -1
      previousStateRef.current = null
    },
    setNodesAndEdges: (newNodes: Node[], newEdges: Edge[]) => {
      isUndoRedoRef.current = true // Don't track this as a history change
      setNodes(newNodes)
      setEdges(newEdges)
      setLastEditedNodeId(null)
      // Reset history when setting nodes/edges externally (e.g., from generate steps)
      const clonedState = cloneState(newNodes, newEdges)
      setHistory([clonedState])
      setHistoryIndex(0)
      historyIndexRef.current = 0
      previousStateRef.current = { nodes: newNodes, edges: newEdges }
      // Auto-fit the view to show all nodes
      setTimeout(() => {
        if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ padding: 0.2 })
        }
      }, 50)
    },
    undo,
    redo,
    canUndo,
    canRedo
  }), [setNodes, setEdges, setViewport, undo, redo, canUndo, canRedo, cloneState])

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
    (params: Connection) => {
      const nextEdges = addEdge({
        ...params,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      }, edges)
      setEdges(nextEdges)
      // Splitting a step into two branches should default to an even split.
      setNodes((nds: Node[]) => rebalanceChildren(nds, nextEdges, [params.source]))
    },
    [edges, setEdges, setNodes]
  )

  // Removing an arrow leaves the step that fed it with a sample to re-split.
  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      const removedIds = changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id)
      onEdgesChange(changes)

      if (removedIds.length === 0) return
      const affectedParents = edges
        .filter((edge: Edge) => removedIds.includes(edge.id))
        .map((edge: Edge) => edge.source)
      const nextEdges = edges.filter((edge: Edge) => !removedIds.includes(edge.id))
      setNodes((nds: Node[]) => rebalanceChildren(nds, nextEdges, affectedParents))
    },
    [edges, onEdgesChange, setNodes]
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
    // Parents of the deleted step lose a branch, so re-split what's left.
    const affectedParents = edges
      .filter((edge: Edge) => edge.target === nodeId)
      .map((edge: Edge) => edge.source)
    const nextEdges = edges.filter(
      (edge: Edge) => edge.source !== nodeId && edge.target !== nodeId
    )
    setEdges(nextEdges)
    setNodes((nds: Node[]) =>
      rebalanceChildren(
        nds.filter((node: Node) => node.id !== nodeId),
        nextEdges,
        affectedParents
      )
    )
  }, [edges, setNodes, setEdges])

  const handleTitleChange = useCallback((nodeId: string, title: string) => {
    isEditingTextRef.current = true
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, title } } : node
      )
    )
  }, [setNodes])

  const handleTitleBlur = useCallback(() => {
    isEditingTextRef.current = false
    // Save to history when user stops editing
    setTimeout(() => {
      saveToHistory()
    }, 0)
  }, [saveToHistory])

  const handleDescriptionChange = useCallback((nodeId: string, description: string) => {
    isEditingTextRef.current = true
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, description } } : node
      )
    )
  }, [setNodes])

  const handleDescriptionBlur = useCallback(() => {
    isEditingTextRef.current = false
    // Save to history when user stops editing
    setTimeout(() => {
      saveToHistory()
    }, 0)
  }, [saveToHistory])

  const handleSliderChange = useCallback((nodeId: string, value: number) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, sliderValue: value } } : node
      )
    )
  }, [setNodes])

  const handleSampleProportionChange = useCallback((nodeId: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, value))
    setLastEditedNodeId(nodeId)
    // The steps after this one carry its sample, so they move with it.
    setNodes((nds: Node[]) =>
      applyProportions(
        nds.map((node: Node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, sampleProportion: clamped } } : node
        ),
        edges,
        new Map([[nodeId, clamped]])
      )
    )
  }, [edges, setNodes])

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
        sampleProportion: 100,
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
        onSampleProportionChange: handleSampleProportionChange,
        onMeasuresChange: handleMeasuresChange,
        onResize: handleResize,
      },
    }
    setNodes((nds: Node[]) => [...nds, newNode])
  }, [setNodes, handleNodeDelete, handleTitleChange, handleDescriptionChange, handleSliderChange, handleSampleProportionChange, handleMeasuresChange, handleResize, nodes, getNextNodeId, measures, loadingMeasures])

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
  // How each step's share of the sample travels through the flow. Uses the
  // same solver as validation, so the canvas never contradicts the run check.
  const balance = analyzeSampleBalance(
    nodes.map((node: Node) => ({ id: node.id, sampleProportion: getSampleProportion(node) })),
    edges.map((edge: Edge) => ({ source: edge.source, target: edge.target }))
  )

  // Every arrow carries a share of the sample - show it on the arrow.
  const edgesWithFlow = edges.map((edge: Edge) => {
    const flow = balance.flows.get(edgeKey(edge.source, edge.target))
    if (flow === undefined) return edge
    return {
      ...edge,
      label: formatPercent(flow),
      labelShowBg: true,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      labelBgStyle: {
        fill: '#ffffff',
        stroke: '#3b82f6',
        strokeWidth: 1,
      },
      labelStyle: {
        fill: '#1d4ed8',
        fontSize: 12,
        fontWeight: 600,
      },
    }
  })

  // Only the step the user changed last is called out, so a single edit
  // doesn't light up half the canvas.
  const highlightedNodeId =
    !balance.isBalanced && lastEditedNodeId && balance.byNode.has(lastEditedNodeId)
      ? lastEditedNodeId
      : null

  const sampleWarningFor = (nodeId: string) => {
    if (nodeId !== highlightedNodeId) return undefined
    const nodeBalance = balance.byNode.get(nodeId)!
    const { proportion, inflow, outflow, shortfall, status } = nodeBalance

    if (inflow === null && Math.abs(proportion - 100) > 0.01) {
      return 'The first step must use 100% of the sample.'
    }
    if (proportion <= 0) {
      return 'Must be more than 0% of the sample.'
    }
    if (outflow !== null && outflow > proportion + 0.005) {
      return 'The next steps take more sample than this step passes on.'
    }
    if (outflow !== null && outflow < proportion - 0.005) {
      return 'The next steps don’t use all of this step’s sample.'
    }
    if (shortfall > 0.005) {
      return 'Less of the sample reaches this step than it is set to use.'
    }
    // The edit landed elsewhere in the flow - say so rather than nothing.
    return status === 'ok'
      ? 'This change leaves the flow using less or more than the whole sample.'
      : 'This step’s share of the sample doesn’t add up.'
  }

  // A short read-out of where a step's sample comes from and goes to.
  const sampleMessageFor = (nodeId: string) => {
    const nodeBalance = balance.byNode.get(nodeId)
    if (!nodeBalance) return undefined
    const { proportion, inflow, outflow, shortfall } = nodeBalance

    if (inflow === null && Math.abs(proportion - 100) > 0.01) {
      return `First step must use 100% of the sample, not ${formatPercent(proportion)}`
    }
    if (proportion <= 0) {
      return 'Sample proportion must be greater than 0%'
    }
    // What this step hands on is the more useful reading when both ends are
    // off, since fixing the split fixes the steps that follow it too.
    if (outflow !== null) {
      return `Next steps take ${formatPercent(outflow)} of ${formatPercent(proportion)}`
    }
    if (shortfall > 0.005 && inflow !== null) {
      return `Only ${formatPercent(inflow)} of the sample reaches this step, but it is set to ${formatPercent(proportion)}`
    }
    return undefined
  }

  const nodesWithHandlers = nodes.map((node: Node) => ({
    ...node,
    width: (typeof node.width === 'number' ? node.width : (typeof node.data?.width === 'number' ? node.data.width : 400)) as number,
    height: (typeof node.height === 'number' ? node.height : (typeof node.data?.height === 'number' ? node.data.height : 600)) as number, // Default height to prevent auto-sizing
    data: {
      ...node.data,
      measures: measures,
      loadingMeasures: loadingMeasures,
      selectedMeasures: node.data?.selectedMeasures || [],
      sampleProportion: getSampleProportion(node),
      // The highlighted step is always marked, even when the gap it opened up
      // shows on a step further along.
      sampleStatus:
        node.id === highlightedNodeId
          ? (balance.byNode.get(node.id)?.status ?? 'ok') === 'ok'
            ? 'over'
            : balance.byNode.get(node.id)!.status
          : 'ok',
      sampleMessage: sampleMessageFor(node.id),
      sampleWarning: sampleWarningFor(node.id),
      width: (typeof node.width === 'number' ? node.width : (typeof node.data?.width === 'number' ? node.data.width : 400)) as number,
      height: (typeof node.height === 'number' ? node.height : (typeof node.data?.height === 'number' ? node.data.height : 600)) as number, // Default height to prevent auto-sizing
      onDelete: handleNodeDelete,
      onTitleChange: handleTitleChange,
      onTitleBlur: handleTitleBlur,
      onDescriptionChange: handleDescriptionChange,
      onDescriptionBlur: handleDescriptionBlur,
      onSliderChange: handleSliderChange,
      onSampleProportionChange: handleSampleProportionChange,
      onMeasuresChange: handleMeasuresChange,
      onResize: handleResize,
    },
    style: {
      ...node.style,
      // The step that broke the sample maths is called out in red, whether or
      // not it happens to be selected.
      border:
        node.id === highlightedNodeId
          ? '3px solid #dc2626'
          : selectedNodeId === node.id
            ? '3px solid #3b82f6'
            : '1px solid #e5e7eb',
      boxShadow:
        node.id === highlightedNodeId
          ? '0 0 0 4px rgba(220, 38, 38, 0.25)'
          : selectedNodeId === node.id
            ? '0 0 0 3px rgba(59, 130, 246, 0.25)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    },
  }))

  return (
    <div ref={containerRef} className="w-full h-full relative bg-gray-50">
      {/* Add Node Button */}
      {!readOnly && (
      <div className="absolute top-4 left-4 z-10">
        <Button 
          onClick={handleAddNode} 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
      </div>
      )}

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
        edges={edgesWithFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={readOnly ? onEdgesChange : handleEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStart={readOnly ? undefined : () => {
          isDraggingRef.current = true
        }}
        onNodeDragStop={readOnly ? undefined : () => {
          isDraggingRef.current = false
          setTimeout(() => {
            saveToHistory()
          }, 0)
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
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

const ReactFlowApp = forwardRef<ReactFlowRef, ReactFlowAppProps>(({ onFlowDataChange, selectedColor, colorArmed, onColorApplied, measures, loadingMeasures, readOnly }, ref) => {
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
        readOnly={readOnly}
      />
    </ReactFlowProvider>
  )
})

ReactFlowApp.displayName = 'ReactFlowApp'

export default ReactFlowApp
