"use client";

import React, { useEffect, useState } from "react";
import { Save, Download, RotateCcw, RotateCw, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import ReactFlowApp from "../components/react-flow";
import { Node, Edge } from "@xyflow/react";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

export default function SimulationPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [processDescription, setProcessDescription] = useState("");
  const [selectedSample, setSelectedSample] = useState("");
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#3b82f6');

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

  const handleGenerateSteps = () => {
    console.log("Generate Steps clicked with:", processDescription);
  };

  const handleSaveDraft = () => {
    console.log("Save Draft clicked");
  };

  const convertFlowNodesToSteps = (nodes: Node[], edges: Edge[]) => {
    const orderedSteps: Array<{ label: string; instructions: string; temperature: number }> = [];
    
    if (nodes.length === 0) return orderedSteps;
    
    // Find the starting node (no incoming edges)
    const targetNodes = new Set(edges.map(edge => edge.target));
    const startingNodes = nodes.filter(node => !targetNodes.has(node.id));
    
    if (startingNodes.length === 0) {
      // If no clear starting node, just use the first node
      const firstNode = nodes[0];
      orderedSteps.push({
        label: (firstNode.data?.title as string) || `Step ${firstNode.id}`,
        instructions: (firstNode.data?.description as string) || '',
        temperature: (firstNode.data?.sliderValue as number) ? (firstNode.data.sliderValue as number) / 100 : 0.5
      });
    } else {
      // Traverse from the starting node
      const visited = new Set<string>();
      const traverse = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          orderedSteps.push({
            label: (node.data?.title as string) || `Step ${node.id}`,
            instructions: (node.data?.description as string) || '',
            temperature: (node.data?.sliderValue as number) ? (node.data.sliderValue as number) / 100 : 0.5
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
    console.log("Submit for Simulation clicked");
    console.log("Flow Nodes:", flowNodes);
    console.log("Flow Edges:", flowEdges);
    console.log("Process Description:", processDescription);
    console.log("Selected Sample:", selectedSample);
    
    // Validate the flow
    const validation = validateFlow();
    
    if (!validation.isValid) {
      alert("Validation failed:\n" + validation.errors.join('\n'));
      return;
    }
    
    // If validation passes, proceed with submission
    console.log("Validation passed! Proceeding with simulation submission...");
    
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
      
      // Convert React Flow nodes to the expected format
      const orderedSteps = convertFlowNodesToSteps(flowNodes, flowEdges);
      
      // Construct the JSON payload for the simulation
      const jsonData = {
        seed: "no-seed",
        steps: orderedSteps,
        metrics: [], // TODO: Add metrics selection if needed
        iters: 10,
        temperature: 0.5,
        user_id: parsedUser.id,
        title: processDescription || "Simulation Flow",
      };
      
      // Define backend URL based on environment
      const prod = process.env.NEXT_PUBLIC_DEV || "production";
      const url =
        prod === "development"
          ? "http://127.0.0.1:5000/api/evaluate"
          : "https://cognition-backend-81313456654.us-west1.run.app/api/evaluate";
      
      // Generate UUID for the simulation
      const uuid = crypto.randomUUID();
      
      // Send the simulation request to the backend API
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: uuid, data: jsonData }),
      });
      
      const result = await response.json();
      
      if (result.status === "started") {
        console.log("Simulation started successfully with task ID:", result.task_id);
        alert("Simulation submitted successfully! Task ID: " + result.task_id);
      } else {
        throw new Error(result.message || 'Simulation failed to start');
      }
      
    } catch (error) {
      console.error("Error in simulation submission:", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFlowDataChange = (nodes: Node[], edges: Edge[]) => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  };

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
    }
  }, [user, isAuthenticated]);

  if (isLoading) {
    return <AuthLoading message="Loading simulation..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout 
      currentPage="simulation" 
      headerTitle="Dashboard"
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
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Submit for Simulation
          </Button>
        </div>
      </SubHeader>

      <div className="flex h-full">
        {/* Left Sidebar - Tools */}
        <div className="w-56 bg-white border-r border-gray-200 p-4 space-y-6">
          {/* Tools Section */}
          <div>
            {/* <h3 className="text-sm font-semibold text-blue-600 mb-3">Tools</h3>
            <div className="space-y-2">
              {/* <div className="flex gap-2">
                <div className="w-20 h-8 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-medium">
                  Step
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded flex items-center justify-center text-gray-700 text-xs">
                  Connection
                </div>
              </div> 
            </div> */}
          </div>

          {/* Colors Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Colors</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { color: '#3b82f6', name: 'blue' },
                { color: '#ef4444', name: 'red' },
                { color: '#10b981', name: 'green' },
                { color: '#eab308', name: 'yellow' },
                { color: '#8b5cf6', name: 'purple' },
                { color: '#ec4899', name: 'pink' },
                { color: '#6b7280', name: 'gray' },
                { color: '#000000', name: 'black' },
              ].map((colorOption) => (
                <div
                  key={colorOption.color}
                  onClick={() => {
                    setSelectedColor(colorOption.color);
                    console.log(`Selected color: ${colorOption.name} (${colorOption.color})`);
                  }}
                  className={`w-6 h-6 rounded cursor-pointer border-2 ${
                    selectedColor === colorOption.color 
                      ? 'border-gray-400 ring-2 ring-gray-300' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  title={`Select ${colorOption.name}`}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full text-xs">
              Clear All
            </Button>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="flex-1 p-1">
                <RotateCcw className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="flex-1 p-1">
                <RotateCw className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Pick Sample Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Pick your sample</h3>
              <HelpCircle className="w-3 h-3 text-gray-400" />
            </div>
            <select 
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm"
              value={selectedSample}
              onChange={(e) => setSelectedSample(e.target.value)}
            >
              <option value="">Select a sample</option>
              <option value="sample1">Sample 1</option>
              <option value="sample2">Sample 2</option>
              <option value="sample3">Sample 3</option>
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Process Description Section */}
          <div className="bg-gray-50 p-6 border-b border-gray-200">
            <div className="max-w-4xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Enter a description of your process
              </h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <textarea
                    placeholder="Describe the process you want to simulate..."
                    value={processDescription}
                    onChange={(e) => setProcessDescription(e.target.value)}
                    className="w-full h-24 px-4 py-3 bg-white border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <Button 
                  onClick={handleGenerateSteps}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 h-auto flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Steps
                </Button>
              </div>
            </div>
          </div>

          {/* Whiteboard Canvas Area */}
          <div className="flex-1 relative overflow-hidden p-6">
            <div className="absolute inset-6">
              <ReactFlowApp onFlowDataChange={handleFlowDataChange} selectedColor={selectedColor} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}