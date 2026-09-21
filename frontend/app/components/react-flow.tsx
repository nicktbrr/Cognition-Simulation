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
import { Plus, ChevronDown, Maximize2, Minimize2, AlertTriangle, RotateCcw, X, FileText, SlidersHorizontal } from 'lucide-react'

import CustomNode from './react-flow/node'
import MeasureNode from './react-flow/measure-node'
import PersonaSplitEdge from './react-flow/edge'
import type { Measure } from '../types/measure'
import {
  analyzeSampleBalance,
  defaultProportions,
  edgeKey,
  personaCounts,
  redistributeProportions,
} from '../utils/stepGraph'

const nodeTypes = {
  custom: CustomNode as any,
  measure: MeasureNode as any,
}

const edgeTypes = {
  personaSplit: PersonaSplitEdge as any,
}

const flowKey = 'simulation-flow';

const getSampleProportion = (node: Node) =>
  typeof node.data?.sampleProportion === 'number' ? node.data.sampleProportion : 100;

/** Samples are whole people, so a share of them always reads as a count. */
const formatSamples = (count: number) => `${count} ${count === 1 ? 'sample' : 'samples'}`;

/**
 * Steps whose sample proportion the user typed in themselves.
 *
 * A pinned step keeps the share it was given; everything else on its level is
 * re-split around it. The flag lives on the node, so it survives an undo, a
 * reload from storage, and a round trip through the canvas.
 */
const pinnedProportions = (nodes: Node[]) =>
  new Set(nodes.filter((node) => node.data?.sampleProportionPinned === true).map((node) => node.id));

const setPinned = (node: Node, pinned: boolean) =>
  ({ ...node, data: { ...node.data, sampleProportionPinned: pinned } }) as Node;

/**
 * Re-split the sample across the whole flow, keeping the steps the user set.
 *
 * The step the user typed into holds its value and the rest of its level
 * shares what's left of the parent's sample in equal parts. The same rule is
 * applied to every level below it, so one edit cascades all the way down.
 */
const applyRedistribution = (nodes: Node[], edges: Edge[], pinned: Set<string>) => {
  const proportions = redistributeProportions(
    nodes.map((node) => ({ id: node.id, sampleProportion: getSampleProportion(node) })),
    edges.map((edge) => ({ source: edge.source, target: edge.target })),
    pinned
  );

  let changed = false;
  const next = nodes.map((node) => {
    const value = proportions.get(node.id);
    if (value === undefined || value === getSampleProportion(node)) return node;
    changed = true;
    return { ...node, data: { ...node.data, sampleProportion: value } } as Node;
  });

  return changed ? next : nodes;
};

/**
 * Re-split the branches of the listed steps evenly, then cascade.
 *
 * Adding or removing an arrow changes what a level is splitting, so the values
 * the user pinned on that level no longer describe a split of anything - they
 * are dropped and the level goes back to an even share each.
 */
const rebalanceChildren = (nodes: Node[], edges: Edge[], parentIds: Array<string | null>) => {
  const affectedChildren = new Set(
    edges
      .filter((edge) => parentIds.includes(edge.source))
      .map((edge) => edge.target)
  );

  const unpinned = affectedChildren.size
    ? nodes.map((node) => (affectedChildren.has(node.id) ? setPinned(node, false) : node))
    : nodes;

  return applyRedistribution(unpinned, edges, pinnedProportions(unpinned));
};

interface ReactFlowAppProps {
  onFlowDataChange?: (nodes: Node[], edges: Edge[]) => void;
  selectedColor?: string;
  colorArmed?: boolean;
  onColorApplied?: () => void;
  measures?: Measure[];
  loadingMeasures?: boolean;
  readOnly?: boolean;
  /** Samples in the run - what the splits on the arrows are counted out of. */
  sampleSize?: number;
  /** Open the shared "add measure" form on behalf of a measure node. */
  onRequestAddMeasure?: (nodeId: string) => void;
}

export interface ReactFlowRef {
  clearFlow: () => void;
  setNodesAndEdges: (newNodes: Node[], newEdges: Edge[]) => void;
  selectMeasureForNode: (nodeId: string, measureId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const ReactFlowComponent = forwardRef<ReactFlowRef, ReactFlowAppProps>(({ onFlowDataChange, selectedColor = '#3b82f6', colorArmed = false, onColorApplied, measures = [], loadingMeasures = false, readOnly = false, sampleSize = 10, onRequestAddMeasure }, ref) => {
  const personaTotal = Math.max(0, Math.round(sampleSize))
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
  // The prompt shown when a level of the flow doesn't use the whole sample.
  const [showSampleAlert, setShowSampleAlert] = useState(false)
  // The "+ Add" menu: step or measure.
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const [sampleAlertDismissed, setSampleAlertDismissed] = useState(false)
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

  // Clicking anywhere else puts the add menu away.
  useEffect(() => {
    if (!showAddMenu) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as globalThis.Node
      if (addMenuRef.current && !addMenuRef.current.contains(target)) {
        setShowAddMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('touchstart', handleClickOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('touchstart', handleClickOutside, true)
    }
  }, [showAddMenu])

  

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
  /**
   * Point a measure node at a measure - the one it puts to the persona.
   *
   * A node with no name of its own takes the measure's, so it always has one
   * to be known by in the results. Renaming it afterwards is what tells two
   * nodes carrying the same measure apart.
   */
  const handleMeasureNodeSelect = useCallback((nodeId: string, measureId: string | null) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) => {
        if (node.id !== nodeId) return node
        const named = ((node.data?.title as string) || '').trim()
        const picked = measures.find((measure: Measure) => measure.id === measureId)
        return {
          ...node,
          data: {
            ...node.data,
            measureId,
            title: named || picked?.title || '',
          },
        } as Node
      })
    )
  }, [measures, setNodes])

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
    // Used after the shared form saves a new measure, so the node that asked
    // for it is already pointing at it when the form closes.
    selectMeasureForNode: (nodeId: string, measureId: string) => {
      handleMeasureNodeSelect(nodeId, measureId)
    },
    undo,
    redo,
    canUndo,
    canRedo
  }), [setNodes, setEdges, setViewport, undo, redo, canUndo, canRedo, cloneState, handleMeasureNodeSelect])

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
    // (The deleted step takes its own pinned share with it.)
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

  /**
   * Give the step at the end of an arrow the samples typed onto it.
   *
   * An arrow is only editable when its step has this one arrow coming in, so
   * what travels the arrow is that step's whole share of the sample. The step
   * keeps what was typed; the branches beside it split what is left of their
   * parent's sample evenly, and every level below them does the same.
   */
  const handlePersonaCountChange = useCallback((edgeId: string, personas: number) => {
    if (personaTotal <= 0) return
    const edge = edges.find((candidate: Edge) => candidate.id === edgeId)
    if (!edge) return

    const count = Math.max(0, Math.min(personaTotal, Math.round(personas)))
    // Proportions stay whole percents behind the scenes; with at most 50
    // samples a whole percent is always finer than a single sample, so the
    // count that comes back out is the count that was typed in.
    const proportion = Math.round((count / personaTotal) * 100)

    setLastEditedNodeId(edge.target)
    setNodes((nds: Node[]) => {
      const edited = nds.map((node: Node) =>
        node.id === edge.target
          ? ({
              ...node,
              data: { ...node.data, sampleProportion: proportion, sampleProportionPinned: true },
            } as Node)
          : node
      )
      return applyRedistribution(edited, edges, pinnedProportions(edited))
    })
  }, [edges, personaTotal, setNodes])

  /** Put every step back on an even share of its parent's sample. */
  const handleResetProportions = useCallback(() => {
    setLastEditedNodeId(null)
    setShowSampleAlert(false)
    setNodes((nds: Node[]) => {
      const proportions = defaultProportions(
        nds.map((node: Node) => node.id),
        edges.map((edge: Edge) => ({ source: edge.source, target: edge.target }))
      )
      return nds.map((node: Node) => ({
        ...node,
        data: {
          ...node.data,
          sampleProportion: proportions.get(node.id) ?? 100,
          sampleProportionPinned: false,
        },
      })) as Node[]
    })
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

  const addNodeOfKind = useCallback((kind: 'custom' | 'measure') => {
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
    
    // A measure node carries a measure instead of instructions, so it needs
    // less room; everything else about placing it is the same.
    const height = kind === 'measure' ? 520 : 600

    const newNode: Node = {
      id: newNodeId,
      type: kind,
      position: {
        x: snappedX,
        y: snappedY,
      },
      width: 400,
      height, // Set explicit initial height to prevent auto-sizing loop
      data: kind === 'measure'
        ? {
            title: '',
            measureId: null,
            sampleProportion: 100,
            measures: measures,
            loadingMeasures: loadingMeasures,
            width: 400,
            height,
            onDelete: handleNodeDelete,
            onTitleChange: handleTitleChange,
            onMeasureNodeSelect: handleMeasureNodeSelect,
            onResize: handleResize,
          }
        : {
            title: '',
            description: '',
            sliderValue: 50,
            sampleProportion: 100,
            numDescriptionsChars: 500,
            selectedMeasures: [],
            measures: measures,
            loadingMeasures: loadingMeasures,
            width: 400,
            height,
            onDelete: handleNodeDelete,
            onTitleChange: handleTitleChange,
            onDescriptionChange: handleDescriptionChange,
            onSliderChange: handleSliderChange,
            onMeasuresChange: handleMeasuresChange,
            onResize: handleResize,
          },
    }
    setNodes((nds: Node[]) => [...nds, newNode])
  }, [setNodes, handleNodeDelete, handleTitleChange, handleDescriptionChange, handleSliderChange, handleMeasuresChange, handleMeasureNodeSelect, handleResize, nodes, getNextNodeId, measures, loadingMeasures])

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

  // A number being typed in passes through half-finished values, so the reset
  // prompt waits a beat rather than flashing up between keystrokes.
  useEffect(() => {
    if (readOnly || nodes.length === 0 || balance.isBalanced) {
      setShowSampleAlert(false)
      // A flow that adds up again earns a fresh prompt if it stops adding up.
      if (balance.isBalanced) setSampleAlertDismissed(false)
      return
    }
    const timer = setTimeout(() => setShowSampleAlert(true), 600)
    return () => clearTimeout(timer)
  }, [balance.isBalanced, nodes.length, readOnly])

  // The steps whose share of the sample doesn't add up, named for the prompt.
  const unbalancedLabels = nodes
    .filter((node: Node) => (balance.byNode.get(node.id)?.status ?? 'ok') !== 'ok')
    .map((node: Node) => ((node.data?.title as string) || '').trim() || `Step ${node.id}`)

  // The samples each arrow carries, worked out the same way the backend
  // routes them, so the canvas shows the split the run will actually use.
  const counts = personaCounts(
    nodes.map((node: Node) => ({ id: node.id, sampleProportion: getSampleProportion(node) })),
    edges.map((edge: Edge) => ({ source: edge.source, target: edge.target })),
    balance.flows,
    personaTotal
  )

  // How many arrows feed each step - a step that branches rejoin has its share
  // worked out by the solver, so there is no single arrow to type into.
  const incomingCount = new Map<string, number>()
  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
  }

  // Every arrow carries a share of the sample - show it on the arrow, and let
  // it be set there.
  const edgesWithFlow = edges.map((edge: Edge) => ({
    ...edge,
    type: 'personaSplit',
    data: {
      ...edge.data,
      personas: counts.byEdge.get(edgeKey(edge.source, edge.target)),
      available: counts.byNode.get(edge.source),
      editable: !readOnly && (incomingCount.get(edge.target) ?? 0) === 1,
      onPersonaCountChange: handlePersonaCountChange,
    },
  }))

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
      return 'The first step must use the whole sample.'
    }
    if (proportion <= 0) {
      return 'This step needs at least one sample.'
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

  /** A percent of the whole sample, read back as whole samples. */
  const samplesIn = (percent: number) => Math.round((percent * personaTotal) / 100)

  // A short read-out of where a step's samples come from and go to.
  const sampleMessageFor = (nodeId: string) => {
    const nodeBalance = balance.byNode.get(nodeId)
    if (!nodeBalance) return undefined
    const { proportion, inflow, outflow, shortfall } = nodeBalance

    if (inflow === null && Math.abs(proportion - 100) > 0.01) {
      return `First step must use all ${formatSamples(personaTotal)}, not ${formatSamples(samplesIn(proportion))}`
    }
    if (proportion <= 0) {
      return 'This step must be given at least one sample'
    }
    // What this step hands on is the more useful reading when both ends are
    // off, since fixing the split fixes the steps that follow it too.
    if (outflow !== null) {
      return `Next steps take ${formatSamples(samplesIn(outflow))} of ${formatSamples(samplesIn(proportion))}`
    }
    if (shortfall > 0.005 && inflow !== null) {
      return `Only ${formatSamples(samplesIn(inflow))} reach this step, but it is set to ${formatSamples(samplesIn(proportion))}`
    }
    return undefined
  }

  // A scale-only measure is never rated on a step, so it stays out of the
  // step nodes' measure lists.
  const ratingMeasures = measures.filter((measure: Measure) => !measure.scaleOnly)

  const nodesWithHandlers = nodes.map((node: Node) => ({
    ...node,
    width: (typeof node.width === 'number' ? node.width : (typeof node.data?.width === 'number' ? node.data.width : 400)) as number,
    height: (typeof node.height === 'number' ? node.height : (typeof node.data?.height === 'number' ? node.data.height : 600)) as number, // Default height to prevent auto-sizing
    data: {
      ...node.data,
      measures: node.type === 'measure' ? measures : ratingMeasures,
      loadingMeasures: loadingMeasures,
      readOnly,
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
      onMeasuresChange: handleMeasuresChange,
      onMeasureNodeSelect: handleMeasureNodeSelect,
      onRequestAddMeasure,
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
      {/* Add a step, or a measure to put to the persona */}
      {!readOnly && (
      <div className="absolute top-4 left-4 z-10" ref={addMenuRef}>
        <Button
          onClick={() => setShowAddMenu((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={showAddMenu}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add
          <ChevronDown className={`w-4 h-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
        </Button>

        {showAddMenu && (
          <div
            role="menu"
            className="absolute left-0 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setShowAddMenu(false); addNodeOfKind('custom') }}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
            >
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
              <span>
                <span className="block text-sm font-medium text-gray-900">Step</span>
                <span className="block text-xs text-gray-500">Something the persona does</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setShowAddMenu(false); addNodeOfKind('measure') }}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
            >
              <SlidersHorizontal className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
              <span>
                <span className="block text-sm font-medium text-gray-900">Measure</span>
                <span className="block text-xs text-gray-500">A scale the persona answers</span>
              </span>
            </button>
          </div>
        )}
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

      {/* The sample has to be used up on every level - offer a way back when
          an edit leaves some of it unassigned. */}
      {showSampleAlert && !sampleAlertDismissed && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[440px] max-w-[calc(100%-2rem)]">
          <div className="rounded-lg border border-red-200 bg-white shadow-lg">
            <div className="flex items-start gap-3 p-4">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-red-700">
                  The sample isn’t fully used
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {unbalancedLabels.length > 0
                    ? `${unbalancedLabels.slice(0, 3).join(', ')}${
                        unbalancedLabels.length > 3 ? ` and ${unbalancedLabels.length - 3} more` : ''
                      } ${unbalancedLabels.length === 1 ? 'doesn’t' : 'don’t'} pass on the whole sample. `
                    : 'Some of the sample has nowhere to go. '}
                  Set the remaining branches on the arrows, or reset to give every
                  step an even share of the sample.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleResetProportions}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset split evenly
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSampleAlertDismissed(true)}
                  >
                    Keep editing
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setSampleAlertDismissed(true)}
                className="p-1 -m-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      )}

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
        edgeTypes={edgeTypes}
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

const ReactFlowApp = forwardRef<ReactFlowRef, ReactFlowAppProps>(({ onFlowDataChange, selectedColor, colorArmed, onColorApplied, measures, loadingMeasures, readOnly, sampleSize, onRequestAddMeasure }, ref) => {
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
        sampleSize={sampleSize}
        onRequestAddMeasure={onRequestAddMeasure}
      />
    </ReactFlowProvider>
  )
})

ReactFlowApp.displayName = 'ReactFlowApp'

export default ReactFlowApp
