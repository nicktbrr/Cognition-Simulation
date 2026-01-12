"use client";

import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Save, Download, RotateCcw, RotateCw, HelpCircle, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import ReactFlowApp, { ReactFlowRef } from "../components/react-flow";
import { Node, Edge } from "@xyflow/react";
import Spinner from "../components/ui/spinner";

type Sample = {
  id: string; // Changed to string for UUID
  name: string; // Changed from label to name to match Supabase
  desc: string;
  user_id?: string;
  created_at?: string;
  attributes?: any;
  persona?: string;
};

// Samples are now fetched from Supabase dynamically

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface DesiredValue {
  value: number;
  label: string;
}

interface Measure {
  id: string;
  title: string;
  description: string;
  range: string;
  desiredValues: DesiredValue[];
}

function SimulationPageContent() {
  const searchParams = useSearchParams();
  const modifyExperimentId = searchParams.get('modify');
  const isNewSimulation = searchParams.get('new') === 'true';
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [processDescription, setProcessDescription] = useState("");
  const [processTitle, setProcessTitle] = useState("");
  const [studyIntroduction, setStudyIntroduction] = useState("");
  const [selectedSample, setSelectedSample] = useState("");
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#ffffff');
  const [colorArmed, setColorArmed] = useState<boolean>(false); // Track if a color is ready to be applied
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [loadingMeasures, setLoadingMeasures] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [isLoadingExperiment, setIsLoadingExperiment] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [simulationTaskId, setSimulationTaskId] = useState<string | null>(null);
  const [simulationProgress, setSimulationProgress] = useState<number | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reactFlowRef = useRef<ReactFlowRef>(null);
  const hasInitiallyLoadedRef = useRef(false);
  const loadedModifyExperimentIdRef = useRef<string | null>(null);
  const originalExperimentDataRef = useRef<any>(null); // Store original experiment data for comparison

  const getUserData = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_emails")
      .select("user_email, user_id, pic_url")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching user data:", error);
    } else {
      setUserData(data);
    }
  };

  const getMeasures = async (userId: string) => {
    setLoadingMeasures(true);
    try {
      const { data, error } = await supabase
        .from("measures")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching measures:", error);
        setMeasures([]);
        return;
      }

      const formattedMeasures: Measure[] = data.map((measure: any) => ({
        id: measure.id,
        title: measure.title,
        description: measure.definition,
        range: `${measure.min} - ${measure.max}`,
        desiredValues: measure.desired_values || []
      }));

      setMeasures(formattedMeasures);
    } catch (error) {
      console.error("Error processing measures data:", error);
      setMeasures([]);
    } finally {
      setLoadingMeasures(false);
      setContentLoaded(true);
    }
  };

  const getSamples = async (userId: string) => {
    setLoadingSamples(true);
    try {
      const { data, error } = await supabase
        .from("samples")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching samples:", error);
        setSamples([]);
        return;
      }

      // Transform Supabase data to match our interface
      const formattedSamples: Sample[] = data.map((sample: any) => ({
        id: sample.id,
        name: sample.name,
        desc: `Sample created on ${new Date(sample.created_at).toLocaleDateString()} with ${Array.isArray(sample.attributes) ? sample.attributes.length : 0} attribute(s)`,
        user_id: sample.user_id,
        created_at: sample.created_at,
        attributes: sample.attributes,
        persona: sample.persona || ""
      }));

      setSamples(formattedSamples);
    } catch (error) {
      console.error("Error processing samples data:", error);
      setSamples([]);
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleGenerateSteps = async () => {
    const requestId = `frontend-${Date.now()}`;
    
    // Validate that process description is provided
    if (!processDescription || processDescription.trim() === '') {
      console.warn(`[${requestId}] Validation failed: process description is empty`);
      alert("Please enter a study description before generating steps.");
      return;
    }

    setIsGeneratingSteps(true);
    
    try {
      // Get the user's Supabase access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error(`[${requestId}] Error getting session:`, sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      const accessToken = session?.access_token;
      if (!accessToken) {
        console.error(`[${requestId}] No access token found`);
        throw new Error("No Supabase access token found");
      }

      // Define backend URL based on environment
      const prod = process.env.NEXT_PUBLIC_DEV || "production";
      const url =
        prod === "development"
          ? "http://127.0.0.1:5000/api/generate-steps"
          : "https://cognition-backend-81313456654.us-west1.run.app/api/generate-steps";

      // Call the backend API
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prompt: processDescription }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] Response not OK. Status: ${response.status}, Body:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();

      if (result.status === "success" && result.data) {
        
        // Convert the backend response to the format expected by convertStepsToFlow
        const stepsData = result.data;
        
        const convertedSteps: Array<{
          label: string;
          instructions: string;
          temperature: number;
          measures: Measure[];
        }> = [];

        // Extract all step keys (step01, step02, etc.) and sort them
        const stepKeys = Object.keys(stepsData)
          .filter(key => key.startsWith('step'))
          .sort((a, b) => {
            // Extract numbers from step01, step02, etc. and sort numerically
            const numA = parseInt(a.replace('step', '')) || 0;
            const numB = parseInt(b.replace('step', '')) || 0;
            return numA - numB;
          });

        // Convert each step to the expected format
        stepKeys.forEach((stepKey, index) => {
          const step = stepsData[stepKey];
          
          if (step && step.title && step.instructions) {
            convertedSteps.push({
              label: step.title,
              instructions: step.instructions,
              temperature: 0.5, // Default temperature
              measures: [], // Empty measures array - user can add measures later
            });
          } else {
            console.warn(`[${requestId}] Skipping invalid step ${stepKey}:`, step);
          }
        });

        if (convertedSteps.length > 0) {
          // Convert steps to flow nodes and edges
          const { nodes, edges } = convertStepsToFlow(convertedSteps);
          
          // Update the React Flow
          if (reactFlowRef.current) {
            reactFlowRef.current.setNodesAndEdges(nodes, edges);
          }
          
          setFlowNodes(nodes);
          setFlowEdges(edges);

          // Optionally set the title from study context if available
          if (stepsData.study_context_and_instructions?.context && !processTitle) {
            // Extract a title from the context or use it as-is
            const context = stepsData.study_context_and_instructions.context;
            // Try to use first sentence or first 50 characters
            const suggestedTitle = context.split('.')[0].trim().substring(0, 50);
            if (suggestedTitle) {
              setProcessTitle(suggestedTitle);
            }
          }

          alert(`Successfully generated ${convertedSteps.length} step(s)!`);
        } else {
          console.warn(`[${requestId}] No valid steps were generated`);
          alert("No valid steps were generated. Please try again with a more detailed description.");
        }
      } else {
        console.error(`[${requestId}] Response indicates failure:`, result);
        throw new Error(result.message || 'Failed to generate steps');
      }
    } catch (error) {
      console.error(`[${requestId}] Error generating steps:`, error);
      if (error instanceof Error) {
        console.error(`[${requestId}] Error name: ${error.name}`);
        console.error(`[${requestId}] Error message: ${error.message}`);
        console.error(`[${requestId}] Error stack:`, error.stack);
      }
      alert(`Error generating steps: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      // Get the user from auth
      if (!user || !isAuthenticated) {
        alert("Please log in to save drafts.");
        return;
      }

      // Get the selected sample details
      const selectedSampleDetails = getSelectedSampleDetails();
      if (!selectedSampleDetails) {
        alert("Please select a sample before saving the draft.");
        return;
      }

      // Convert React Flow nodes to the expected format
      const orderedSteps = convertFlowNodesToSteps(flowNodes, flowEdges);

      // Construct the JSON payload for the draft
      const experimentData = {
        seed: "no-seed",
        steps: orderedSteps,
        iters: 10,
        temperature: 0.5,
        user_id: user.user_id,
        title: processTitle || "Untitled Simulation",
        study_introduction: studyIntroduction || "",
        sample: {
          id: selectedSampleDetails.id,
          name: selectedSampleDetails.name,
          user_id: selectedSampleDetails.user_id,
          created_at: selectedSampleDetails.created_at,
          attributes: selectedSampleDetails.attributes,
          persona: selectedSampleDetails.persona
        }
      };

      let data, error;

      // If we're modifying an existing experiment, update it; otherwise create a new draft
      if (modifyExperimentId) {
        // Check if the experiment exists and is a draft
        const { data: existingExperiment } = await supabase
          .from("experiments")
          .select("status")
          .eq("experiment_id", modifyExperimentId)
          .eq("user_id", user.user_id)
          .single();

        if (existingExperiment && existingExperiment.status === "Draft") {
          // Update existing draft
          const result = await supabase
            .from("experiments")
            .update({
              experiment_data: experimentData,
              updated_at: new Date().toISOString()
            })
            .eq("experiment_id", modifyExperimentId)
            .eq("user_id", user.user_id)
            .select()
            .single();

          data = result.data;
          error = result.error;
        } else {
          // Create a new draft (the existing experiment is not a draft)
          const draftId = crypto.randomUUID();
          const result = await supabase
            .from("experiments")
            .insert({
              experiment_id: draftId,
              user_id: user.user_id,
              experiment_data: experimentData,
              status: "Draft",
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          data = result.data;
          error = result.error;
        }
      } else {
        // Create a new draft
        const draftId = crypto.randomUUID();
        const result = await supabase
          .from("experiments")
          .insert({
            experiment_id: draftId,
            user_id: user.user_id,
            experiment_data: experimentData,
            status: "Draft",
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Error saving draft:", error);
        alert(`Error saving draft: ${error.message}`);
        return;
      }

      alert("Draft saved successfully!");
    } catch (error) {
      console.error("Error saving draft:", error);
      alert(`Error saving draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClearAll = () => {
    // Clear form fields
    setProcessDescription("");
    setProcessTitle("");
    setStudyIntroduction("");
    setSelectedSample("");
    
    // Clear React Flow
    if (reactFlowRef.current) {
      reactFlowRef.current.clearFlow();
    }
    
    // Clear localStorage
    localStorage.removeItem('simulation-flow');
    localStorage.removeItem('simulation-title');
    localStorage.removeItem('simulation-introduction');
    localStorage.removeItem('simulation-sample');
    localStorage.removeItem('last-loaded-modify-experiment-id');
    
    // Reset the modify experiment ref
    loadedModifyExperimentIdRef.current = null;
  };

  const convertFlowNodesToSteps = (nodes: Node[], edges: Edge[]) => {
    const orderedSteps: Array<{ 
      label: string; 
      instructions: string; 
      temperature: number;
      measures: Measure[];
    }> = [];
    
    if (nodes.length === 0) return orderedSteps;
    
    // Find the starting node (no incoming edges)
    const targetNodes = new Set(edges.map(edge => edge.target));
    const startingNodes = nodes.filter(node => !targetNodes.has(node.id));
    
    if (startingNodes.length === 0) {
      // If no clear starting node, just use the first node
      const firstNode = nodes[0];
      const selectedMeasureIds = (firstNode.data?.selectedMeasures as string[]) || [];
      const selectedMeasures = measures.filter(measure => selectedMeasureIds.includes(measure.id));
      
      orderedSteps.push({
        label: (firstNode.data?.title as string) || `Step ${firstNode.id}`,
        instructions: (firstNode.data?.description as string) || '',
        temperature: (firstNode.data?.sliderValue as number) ? (firstNode.data.sliderValue as number) / 100 : 0.5,
        measures: selectedMeasures
      });
    } else {
      // Traverse from the starting node
      const visited = new Set<string>();
      const traverse = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          const selectedMeasureIds = (node.data?.selectedMeasures as string[]) || [];
          const selectedMeasures = measures.filter(measure => selectedMeasureIds.includes(measure.id));
          
          orderedSteps.push({
            label: (node.data?.title as string) || `Step ${node.id}`,
            instructions: (node.data?.description as string) || '',
            temperature: (node.data?.sliderValue as number) ? (node.data.sliderValue as number) / 100 : 0.5,
            measures: selectedMeasures
          });
          
          // Find outgoing edges and traverse them
          const outgoingEdges = edges.filter(edge => edge.source === nodeId);
          for (const edge of outgoingEdges) {
            traverse(edge.target);
          }
        }
      };
      
      traverse(startingNodes[0].id);
    }
    
    return orderedSteps;
  };

  // Helper function to compare two experiment data objects
  // Returns true if they are identical (same title, sample.id, and steps)
  const areExperimentsIdentical = (original: any, newData: any): boolean => {
    // Compare title
    if ((original.title || '') !== (newData.title || '')) {
      return false;
    }

    // Compare sample ID
    if ((original.sample?.id || '') !== (newData.sample?.id || '')) {
      return false;
    }

    // Compare steps (label, instructions, temperature)
    const originalSteps = original.steps || [];
    const newSteps = newData.steps || [];

    if (originalSteps.length !== newSteps.length) {
      return false;
    }

    for (let i = 0; i < originalSteps.length; i++) {
      const origStep = originalSteps[i];
      const newStep = newSteps[i];

      if (
        (origStep.label || '') !== (newStep.label || '') ||
        (origStep.instructions || '') !== (newStep.instructions || '') ||
        (origStep.temperature || 0) !== (newStep.temperature || 0)
      ) {
        return false;
      }
    }

    return true;
  };

  const validateFlow = () => {
    const errors: string[] = [];
    
    // Check if there are any nodes
    if (flowNodes.length === 0) {
      errors.push("Please add at least one node to your flow");
      return { isValid: false, errors };
    }
    
    // 1. Check that all nodes have title and description
    const nodesWithoutTitle = flowNodes.filter(node => !node.data?.title || (node.data.title as string).trim() === '');
    const nodesWithoutDescription = flowNodes.filter(node => !node.data?.description || (node.data.description as string).trim() === '');
    
    if (nodesWithoutTitle.length > 0) {
      errors.push(`Node(s) are missing titles`);
    }
    
    if (nodesWithoutDescription.length > 0) {
      errors.push(`Node(s) are missing descriptions`);
    }
    
    // 2. Check connectivity - find starting node and ensure all nodes are connected
    if (flowNodes.length > 1) {
      // Find nodes with no incoming edges (potential starting nodes)
      const nodeIds = new Set(flowNodes.map(node => node.id));
      const targetNodes = new Set(flowEdges.map(edge => edge.target));
      const startingNodes = flowNodes.filter(node => !targetNodes.has(node.id));
      
      if (startingNodes.length === 0) {
        errors.push("No starting node found - all nodes have incoming connections");
      } else if (startingNodes.length > 1) {
        errors.push(`Multiple starting nodes found. There should be only one starting node.`);
      } else {
        // Traverse from starting node to check connectivity
        const visited = new Set<string>();
        const queue = [startingNodes[0].id];
        
        while (queue.length > 0) {
          const currentNodeId = queue.shift()!;
          if (visited.has(currentNodeId)) continue;
          
          visited.add(currentNodeId);
          
          // Find all outgoing edges from current node
          const outgoingEdges = flowEdges.filter(edge => edge.source === currentNodeId);
          for (const edge of outgoingEdges) {
            if (!visited.has(edge.target)) {
              queue.push(edge.target);
            }
          }
        }
        
        // Check if all nodes were visited
        const unvisitedNodes = flowNodes.filter(node => !visited.has(node.id));
        if (unvisitedNodes.length > 0) {
          errors.push(`Disconnected nodes found. All nodes must be connected to the flow.`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSubmitSimulation = async () => {
    
    // Validate the flow
    const validation = validateFlow();
    
    if (!validation.isValid) {
      alert("Validation failed:\n" + validation.errors.join('\n'));
      return;
    }

    // Validate that a sample is selected
    if (!selectedSample) {
      alert("Please select a sample before submitting the simulation.");
      return;
    }
    
    // If validation passes, immediately disable button and show progress
    // This happens before waiting for the backend (cold start)
    setIsSimulationRunning(true);
    setSimulationProgress(0);
    
    try {
      // Get the user from local storage
      let parsedUser = null;
      const storedUser = localStorage.getItem("supabaseUser");
      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser);
        } catch (e) {
          console.error("Error parsing user:", e);
        }
      }
      
      // Get the user's Supabase access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("No Supabase access token found");
      }
      
      // Get the selected sample details
      const selectedSampleDetails = getSelectedSampleDetails();
      if (!selectedSampleDetails) {
        throw new Error("Selected sample not found. Please refresh and try again.");
      }
      
      // Convert React Flow nodes to the expected format
      const orderedSteps = convertFlowNodesToSteps(flowNodes, flowEdges);
      
      // Construct the JSON payload for the simulation
      const jsonData = {
        seed: "no-seed",
        steps: orderedSteps,
        iters: 10,
        temperature: 0.5,
        user_id: parsedUser.id,
        title: processTitle || "Simulation Flow",
        study_introduction: studyIntroduction || "",
        sample: {
          id: selectedSampleDetails.id,
          name: selectedSampleDetails.name,
          user_id: selectedSampleDetails.user_id,
          created_at: selectedSampleDetails.created_at,
          attributes: selectedSampleDetails.attributes,
          persona: selectedSampleDetails.persona
        }
      };

      // If in modify mode, compare with original experiment data
      // If identical, it will be treated as a replication (grouped in same row)
      // If different, it will appear as a new row
      if (modifyExperimentId && originalExperimentDataRef.current) {
        const isIdentical = areExperimentsIdentical(originalExperimentDataRef.current, jsonData);
        // The grouping logic in the dashboard will automatically group this with the original
        // since it will have the same config key (title, sample.id, steps)
      }
      
      // Define backend URL based on environment
      const prod = process.env.NEXT_PUBLIC_DEV || "production";
      const url =
        prod === "development"
          ? "http://127.0.0.1:5000/api/evaluate"
          : "https://cognition-backend-81313456654.us-west1.run.app/api/evaluate";
      
      // Generate UUID for the simulation
      const uuid = crypto.randomUUID();

      // TODO: Add this for production
      
      // Send the simulation request to the backend API
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: uuid, data: jsonData }),
      });

      // TODO: Remove this for production
      // const response = {
      //   status: "started",
      //   task_id: uuid,
      //   message: "Simulation submitted successfully",
      // }

      // const result = response;

      // TODO: Add this for production
      
      const result = await response.json();
      
      if (result.status === "started") {
        const taskId = result.task_id;
        
        // Save task_id to localStorage
        localStorage.setItem('simulation-task-id', taskId);
        
        // Set task ID for polling (progress and running state already set above)
        setSimulationTaskId(taskId);
        
        // Don't show alert, let the button show progress instead
      } else {
        throw new Error(result.message || 'Simulation failed to start');
      }
      
    } catch (error) {
      // Reset state on error so user can try again
      setIsSimulationRunning(false);
      setSimulationProgress(null);
      setSimulationTaskId(null);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFlowDataChange = (nodes: Node[], edges: Edge[]) => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  };

  // Function to check progress for a running simulation by querying Supabase directly
  const checkSimulationProgress = useCallback(async (experimentId: string, userId: string) => {
    try {
      // Query Supabase directly for the experiment progress
      const { data, error } = await supabase
        .from("experiments")
        .select("progress, status, url")
        .eq("experiment_id", experimentId)
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error checking progress:", error);
        return;
      }

      if (data) {
        const progressData = data;
        
        // Normalize progress to 0-100 range (backend might return 0-1 or 0-100)
        let progressPercent = progressData.progress || 0;
        if (progressPercent <= 1 && progressPercent > 0) {
          progressPercent = progressPercent * 100;
        }
        
        // Normalize status
        const status = progressData.status || '';
        const statusLower = status.toLowerCase();
        
        // Update progress state
        setSimulationProgress(progressPercent);
        
        // Check if simulation is complete or failed
        const isFailed = statusLower === 'failed';
        const isComplete = progressPercent >= 100 || statusLower === 'completed' || statusLower === 'done' || statusLower === 'finished';
        
        if (isComplete || isFailed) {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Clear state and localStorage
          setIsSimulationRunning(false);
          setSimulationTaskId(null);
          setSimulationProgress(null);
          localStorage.removeItem('simulation-task-id');
          
          // Show completion message
          if (isFailed) {
            alert("Simulation failed. Please check your experiment settings and try again.");
          } else {
            alert("Simulation completed successfully! You can view the results in the Dashboard.");
          }
        }
      }
    } catch (error) {
      console.error("Error checking progress:", error);
    }
  }, []);

  const getSelectedSampleDetails = () => {
    return samples.find(sample => sample.id === selectedSample);
  };

  const handleNodeDelete = useCallback((nodeId: string) => {
    setFlowNodes((nds: Node[]) => nds.filter((node: Node) => node.id !== nodeId));
    setFlowEdges((eds: Edge[]) => eds.filter((edge: Edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, []);

  const handleTitleChange = useCallback((nodeId: string, title: string) => {
    setFlowNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, title } } : node
      )
    );
  }, []);

  const handleDescriptionChange = useCallback((nodeId: string, description: string) => {
    setFlowNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, description } } : node
      )
    );
  }, []);

  const handleSliderChange = useCallback((nodeId: string, value: number) => {
    setFlowNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, sliderValue: value } } : node
      )
    );
  }, []);

  const handleMeasuresChange = useCallback((nodeId: string, selectedMeasures: string[]) => {
    setFlowNodes((nds: Node[]) =>
      nds.map((node: Node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, selectedMeasures } } : node
      )
    );
  }, []);

  const convertStepsToFlow = (steps: any[]): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    const nodeWidth = 400; // Default node width
    const gapBetweenNodes = 50; // Gap between nodes to show arrows
    const nodeSpacing = nodeWidth + gapBetweenNodes; // Total spacing (450 pixels)
    const startY = 200; // Y position for all nodes
    const startX = 100; // Starting X position
    
    steps.forEach((step, index) => {
      const nodeId = `${index + 1}`;
      
      // Create node with all required callbacks
      nodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: startX + (index * nodeSpacing), y: startY },
        data: {
          title: step.label || '',
          description: step.instructions || '',
          sliderValue: (step.temperature || 0.5) * 100,
          numDescriptionsChars: 500,
          selectedMeasures: step.measures?.map((m: any) => m.id) || [],
          measures: measures,
          loadingMeasures: loadingMeasures,
          onDelete: handleNodeDelete,
          onTitleChange: handleTitleChange,
          onDescriptionChange: handleDescriptionChange,
          onSliderChange: handleSliderChange,
          onMeasuresChange: handleMeasuresChange,
        }
      });
      
      // Create edge to next node (if not last node)
      if (index < steps.length - 1) {
        edges.push({
          id: `edge-${nodeId}-${index + 2}`,
          source: nodeId,
          target: `${index + 2}`,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: {
            type: 'ArrowClosed' as any,
            color: '#3b82f6',
          },
        });
      }
    });
    
    return { nodes, edges };
  };

  const handleRealign = useCallback(() => {
    if (flowNodes.length === 0) return;

    const nodeWidth = 400; // Default node width
    const gapBetweenNodes = 50; // Gap between nodes to show arrows
    const nodeSpacing = nodeWidth + gapBetweenNodes; // Total spacing (450 pixels)
    const startY = 200; // Y position for all nodes
    const startX = 100; // Starting X position

    // Sort nodes by their ID (which should be numeric strings like "1", "2", etc.)
    const sortedNodes = [...flowNodes].sort((a, b) => {
      const aNum = parseInt(a.id) || 0;
      const bNum = parseInt(b.id) || 0;
      return aNum - bNum;
    });

    // Reposition all nodes to default arrangement
    const realignedNodes = sortedNodes.map((node, index) => ({
      ...node,
      position: { x: startX + (index * nodeSpacing), y: startY }
    }));

    // Update nodes state
    setFlowNodes(realignedNodes);

    // Center the view after realignment using the ReactFlow ref
    setTimeout(() => {
      if (reactFlowRef.current) {
        reactFlowRef.current.setNodesAndEdges(realignedNodes, flowEdges);
      }
    }, 100);
  }, [flowNodes, flowEdges]);

  const loadExperimentForModification = async (experimentId: string) => {
    setIsLoadingExperiment(true);
    try {
      // Clear any running simulation state when modifying an experiment
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSimulationRunning(false);
      setSimulationTaskId(null);
      setSimulationProgress(null);
      localStorage.removeItem('simulation-task-id');

      const { data, error } = await supabase
        .from("experiments")
        .select("*")
        .eq("experiment_id", experimentId)
        .single();

      if (error) {
        console.error("Error fetching experiment:", error);
        alert("Error loading experiment for modification");
        return;
      }

      const experimentData = data.experiment_data;
      
      // Store original experiment data for comparison when submitting
      originalExperimentDataRef.current = JSON.parse(JSON.stringify(experimentData));
      
      // Prepopulate form fields
      setProcessTitle(experimentData.title || "");
      setStudyIntroduction(experimentData.study_introduction || experimentData.introduction || "");
      setSelectedSample(experimentData.sample?.id || "");
      
      // Convert steps to flow nodes and edges
      if (experimentData.steps && experimentData.steps.length > 0) {
        const { nodes, edges } = convertStepsToFlow(experimentData.steps);
        
        // Update the React Flow
        if (reactFlowRef.current) {
          reactFlowRef.current.setNodesAndEdges(nodes, edges);
        }
        
        setFlowNodes(nodes);
        setFlowEdges(edges);
      }
      
    } catch (error) {
      console.error("Error loading experiment:", error);
      alert("Error loading experiment for modification");
    } finally {
      setIsLoadingExperiment(false);
    }
  };

  useEffect(() => {
    if (user && isAuthenticated && !hasInitiallyLoadedRef.current) {
      hasInitiallyLoadedRef.current = true;
      getUserData(user.user_id);
      getMeasures(user.user_id);
      getSamples(user.user_id);
    } else if (!user || !isAuthenticated) {
      // Reset the ref when user logs out
      hasInitiallyLoadedRef.current = false;
      setMeasures([]);
      setSamples([]);
      setContentLoaded(false);
    }
  }, [user?.user_id, isAuthenticated]);

  // Clear draft if starting a new simulation
  useEffect(() => {
    if (isNewSimulation && !modifyExperimentId) {
      // Clear form fields
      setProcessDescription("");
      setProcessTitle("");
      setStudyIntroduction("");
      setSelectedSample("");
      
      // Clear React Flow
      if (reactFlowRef.current) {
        reactFlowRef.current.clearFlow();
      }
      
      // Clear localStorage
      localStorage.removeItem('simulation-flow');
      localStorage.removeItem('simulation-title');
      localStorage.removeItem('simulation-introduction');
      localStorage.removeItem('simulation-sample');
      localStorage.removeItem('last-loaded-modify-experiment-id');
      
      // Reset the modify experiment ref
      loadedModifyExperimentIdRef.current = null;
      
      // Remove the 'new' parameter from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('new');
      window.history.replaceState({}, '', url.toString());
    }
  }, [isNewSimulation, modifyExperimentId]);

  // Load process title from localStorage on mount (only if not in modify mode and not new simulation)
  useEffect(() => {
    if (!modifyExperimentId && !isNewSimulation) {
      const savedTitle = localStorage.getItem('simulation-title');
      if (savedTitle) {
        setProcessTitle(savedTitle);
      }
      const savedIntroduction = localStorage.getItem('simulation-introduction');
      if (savedIntroduction) {
        setStudyIntroduction(savedIntroduction);
      }
    }
  }, [modifyExperimentId, isNewSimulation]);

  // Save process title to localStorage whenever it changes
  useEffect(() => {
    if (processTitle) {
      localStorage.setItem('simulation-title', processTitle);
    } else {
      localStorage.removeItem('simulation-title');
    }
  }, [processTitle]);

  // Save study introduction to localStorage whenever it changes
  useEffect(() => {
    if (studyIntroduction) {
      localStorage.setItem('simulation-introduction', studyIntroduction);
    } else {
      localStorage.removeItem('simulation-introduction');
    }
  }, [studyIntroduction]);

  // Load selected sample from localStorage on mount (only if not in modify mode and not new simulation)
  useEffect(() => {
    if (!modifyExperimentId && !isNewSimulation && samples.length > 0) {
      const savedSample = localStorage.getItem('simulation-sample');
      if (savedSample) {
        // Verify the saved sample still exists in the samples list
        const sampleExists = samples.some(sample => sample.id === savedSample);
        if (sampleExists) {
          setSelectedSample(savedSample);
        } else {
          // Remove invalid sample from localStorage
          localStorage.removeItem('simulation-sample');
        }
      }
    }
  }, [modifyExperimentId, isNewSimulation, samples.length]);

  // Save selected sample to localStorage whenever it changes
  useEffect(() => {
    if (selectedSample) {
      localStorage.setItem('simulation-sample', selectedSample);
    } else {
      localStorage.removeItem('simulation-sample');
    }
  }, [selectedSample]);

  // Load experiment data when in modify mode (only once per experiment ID)
  useEffect(() => {
    if (modifyExperimentId && user && isAuthenticated && samples.length > 0 && measures.length > 0 && !isLoadingExperiment) {
      // Check if we've already loaded this experiment (stored in localStorage)
      // This prevents reloading on page refresh when user has made changes
      const lastLoadedExperimentId = localStorage.getItem('last-loaded-modify-experiment-id');
      
      // Only load if this is a different experiment ID than we've already loaded
      // or if we haven't loaded any experiment yet
      if (lastLoadedExperimentId !== modifyExperimentId) {
        // Store the experiment ID we're about to load
        localStorage.setItem('last-loaded-modify-experiment-id', modifyExperimentId);
        loadedModifyExperimentIdRef.current = modifyExperimentId;
        loadExperimentForModification(modifyExperimentId);
      } else {
        // We've already loaded this experiment, just set the ref
        loadedModifyExperimentIdRef.current = modifyExperimentId;
      }
    } else if (!modifyExperimentId) {
      // Reset the ref and localStorage when not in modify mode
      loadedModifyExperimentIdRef.current = null;
      originalExperimentDataRef.current = null;
      localStorage.removeItem('last-loaded-modify-experiment-id');
    }
  }, [modifyExperimentId, user, isAuthenticated, samples.length, measures.length]);

  // Load simulation task_id from localStorage on mount (only if not in modify mode)
  useEffect(() => {
    if (user && isAuthenticated && !modifyExperimentId) {
      const savedTaskId = localStorage.getItem('simulation-task-id');
      if (savedTaskId) {
        setSimulationTaskId(savedTaskId);
        setIsSimulationRunning(true);
        setSimulationProgress(0);
      }
    }
  }, [user, isAuthenticated, modifyExperimentId]);

  // Poll for simulation progress
  useEffect(() => {
    if (!user || !isAuthenticated || !simulationTaskId || !isSimulationRunning) {
      // Clear interval if conditions not met
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before starting a new one
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Start polling every 500ms
    pollingIntervalRef.current = setInterval(() => {
      if (simulationTaskId && user.user_id) {
        checkSimulationProgress(simulationTaskId, user.user_id);
      }
    }, 500);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [simulationTaskId, isSimulationRunning, user, isAuthenticated, checkSimulationProgress]);

  if (isLoading) {
    return <AuthLoading message="Loading simulation..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout 
      currentPage="simulation" 
      headerTitle=""
      userData={userData}
    >
      <SubHeader
        title="Simulation Whiteboard"
        description="Design and visualize your simulation flow"
      >
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleSaveDraft}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </Button>
          <Button 
            onClick={handleSubmitSimulation}
            disabled={isSimulationRunning}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isSimulationRunning 
              ? `Simulation in progress: ${simulationProgress !== null ? Math.round(simulationProgress) : 0}%`
              : "Submit for Simulation"
            }
          </Button>
        </div>
      </SubHeader>

      <div className="flex h-full">
        {!contentLoaded ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-gray-500">
              <Spinner size="lg" />
              <span>Loading simulation tools...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Left Sidebar - Tools */}
            <div className={`w-56 bg-white border-r border-gray-200 p-4 space-y-6 transition-opacity duration-500 overflow-y-auto ${contentLoaded ? 'opacity-100' : 'opacity-0'}`}>
          {/* Describe Your Study */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Describe Your Study
            </h3>
            <textarea
              placeholder="Describe the study you want to simulate..."
              value={processDescription}
              onChange={(e) => setProcessDescription(e.target.value)}
              disabled={isGeneratingSteps}
              className="w-full h-32 px-3 py-2 text-sm bg-white border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed mb-2"
            />
            <Button 
              onClick={handleGenerateSteps}
              disabled={isGeneratingSteps}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isGeneratingSteps ? (
                <>
                  <Spinner size="sm" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Steps
                </>
              )}
            </Button>
          </div>

          {/* Colors Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Colors</h3>
              <div className="relative group">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  Color selection is for visual organization and does not affect simulation functionality
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { color: '#3b82f6', name: 'blue' },
                { color: '#ef4444', name: 'red' },
                { color: '#10b981', name: 'green' },
                { color: '#eab308', name: 'yellow' },
                { color: '#8b5cf6', name: 'purple' },
                { color: '#ec4899', name: 'pink' },
                { color: '#6b7280', name: 'gray' },
                { color: '#ffffff', name: 'remove', isRemove: true },
              ].map((colorOption) => (
                <div
                  key={colorOption.color}
                  onClick={() => {
                    setSelectedColor(colorOption.color);
                    setColorArmed(true); // Arm the color for application
                  }}
                  className={`w-6 h-6 rounded cursor-pointer border-2 flex items-center justify-center ${
                    colorArmed && selectedColor === colorOption.color
                      ? 'border-blue-500 ring-2 ring-blue-300' 
                      : selectedColor === colorOption.color 
                      ? 'border-gray-400 ring-2 ring-gray-300' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  title={colorArmed && selectedColor === colorOption.color 
                    ? `Click a node to apply ${colorOption.isRemove ? 'no color' : colorOption.name}` 
                    : colorOption.isRemove ? 'Remove color' : `Select ${colorOption.name}`}
                >
                  {colorOption.isRemove && (
                    <div className="text-red-500 font-bold text-sm leading-none">×</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full text-xs"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 p-1"
                onClick={() => reactFlowRef.current?.undo()}
                disabled={!reactFlowRef.current?.canUndo()}
                title="Undo"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 p-1"
                onClick={() => reactFlowRef.current?.redo()}
                disabled={!reactFlowRef.current?.canRedo()}
                title="Redo"
              >
                <RotateCw className="w-3 h-3" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              className="w-full text-xs"
              onClick={handleRealign}
            >
              Realign
            </Button>
          </div>

          {/* Pick Sample Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Sample:</h3>
            </div>
            {loadingSamples ? (
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm flex items-center justify-center">
                <Spinner size="sm" />
                <span className="ml-2 text-gray-500">Loading samples...</span>
              </div>
            ) : (
              <select 
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm"
                value={selectedSample}
                onChange={(e) => setSelectedSample(e.target.value)}
                >
                <option value="">Select a sample</option>
                {samples.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {!loadingSamples && samples.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No samples found. Create samples in the Samples page.</p>
            )}
            {selectedSample && getSelectedSampleDetails() && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                {Array.isArray(getSelectedSampleDetails()?.attributes) && getSelectedSampleDetails()!.attributes.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {getSelectedSampleDetails()!.attributes.map((attr: any, index: number) => (
                      <div key={index} className="text-blue-600">
                        <span className="font-medium">{attr.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Form Section - Title and Introduction */}
          <div className="bg-gray-50 p-3 border-b border-gray-200 flex-shrink-0">
            <div className="w-full">
              <div className="flex flex-row gap-4">
                {/* Title of Study */}
                <div className="w-[20%]">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                    Title of Study
                  </h3>
                  <input
                    type="text"
                    placeholder="Enter study title..."
                    value={processTitle}
                    onChange={(e) => setProcessTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Study Introduction */}
                <div className="w-[80%]">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                    Study Introduction
                  </h3>
                  <textarea
                    placeholder="Enter study introduction..."
                    value={studyIntroduction}
                    onChange={(e) => setStudyIntroduction(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

            {/* Whiteboard Canvas Area */}
            <div className="flex-1 relative overflow-hidden p-6">
              <div className="absolute inset-6">
                <ReactFlowApp 
                  ref={reactFlowRef}
                  onFlowDataChange={handleFlowDataChange} 
                  selectedColor={selectedColor}
                  colorArmed={colorArmed}
                  onColorApplied={() => setColorArmed(false)}
                  measures={measures}
                  loadingMeasures={loadingMeasures}
                />
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function SimulationPage() {
  return (
    <Suspense fallback={<AuthLoading message="Loading simulation..." />}>
      <SimulationPageContent />
    </Suspense>
  );
}