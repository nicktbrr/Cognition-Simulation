"use client";

import React, { useEffect, useState, useRef } from "react";
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
  id: number;
  label: string;
  desc: string;
};

export const samples: Sample[] = [
  {
    id: 1,
    label: "Sample 1",
    desc: "A young Black woman working in healthcare in the South. High school educated, compassionate, and community-focused."
  },
  {
    id: 2,
    label: "Sample 2",
    desc: "A Hispanic teenage girl working retail while attending high school in a Spanish-speaking household. Balances family responsibilities with big dreams for the future."
  },
  {
    id: 3,
    label: "Sample 3",
    desc: "An Asian female medical doctor in her late 50s living in New England. Fluent in English and driven by a lifelong commitment to care."
  },
  {
    id: 4,
    label: "Sample 4",
    desc: "A Native male manufacturing supervisor in his late 60s from a remote part of Alaska. Has some college education and carries deep cultural and technical knowledge."
  },
  {
    id: 5,
    label: "Sample 5",
    desc: "A retired white male lawyer in his late 60s, living in the Southwest. Values justice, debate, and a strong sense of civic duty."
  },
  {
    id: 6,
    label: "Sample 6",
    desc: "A young foreign-born woman with a Master's in psychology who works with people with disabilities. Spanish-speaking and empathetic by nature."
  },
  {
    id: 7,
    label: "Sample 7",
    desc: "An elderly white woman with a high school diploma working in a religious setting in the Midwest. Grounded in faith and community."
  },
  {
    id: 8,
    label: "Sample 8",
    desc: "A white male plumber in his 50s, with a high school diploma and strong ties to his rural community. Practical and proud of his trade."
  },
  {
    id: 9,
    label: "Sample 9",
    desc: "A white male in construction with a bachelor's degree and a pioneering spirit, living in the northern Rockies. Enjoys building both structures and relationships."
  },
  {
    id: 10,
    label: "Sample 10",
    desc: "A retired Asian female architect in her 60s, Hawaiian by residence, fluent in Tagalog. Creative, cultured, and design-driven."
  },
  {
    id: 11,
    label: "Sample 11",
    desc: "A middle-aged foreign-born social worker, Spanish-speaking, living in Florida. Grounded in empathy and focused on immigrant family well-being."
  },
  {
    id: 12,
    label: "Sample 12",
    desc: "A white male farmer in his 50s with a high school diploma, deeply rooted in North Dakota. Values tradition, land, and independence."
  },
  {
    id: 13,
    label: "Sample 13",
    desc: "A young Black female teacher in the South with a bachelor's degree. Passionate about equity and education."
  },
  {
    id: 14,
    label: "Sample 14",
    desc: "A middle-aged white male engineer in manufacturing with a Slavic background. High school educated and detail-oriented."
  },
  {
    id: 15,
    label: "Sample 15",
    desc: "A young Asian female artist with a bachelor's degree, living in Hawaii. Creative, introspective, and culturally diverse."
  },
  {
    id: 16,
    label: "Sample 16",
    desc: "A Hispanic teenage male soccer coach currently unemployed and living in Puerto Rico. Speaks Spanish and thrives on teamwork and youth mentorship."
  },
  {
    id: 17,
    label: "Sample 17",
    desc: "A white male sales representative in his 20s with a high school diploma, based in the Midwest. Energetic, persuasive, and always on the move."
  },
  {
    id: 18,
    label: "Sample 18",
    desc: "A Black female HR manager in Texas, fluent in French and holding a bachelor's degree. Values structure, diplomacy, and inclusion in the workplace."
  },
  {
    id: 19,
    label: "Sample 19",
    desc: "A white male in his early 30s with a high school diploma working in manufacturing in the rural Midwest. Speaks English and values hands-on experience over formal education."
  },
  {
    id: 20,
    label: "Sample 20",
    desc: "A Chinese male accountant in his 40s living in the Pacific Northwest. Holds a bachelor's degree and approaches life with precision and discipline."
  }
];

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

export default function SimulationPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [processDescription, setProcessDescription] = useState("");
  const [processTitle, setProcessTitle] = useState("");
  const [selectedSample, setSelectedSample] = useState("");
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#3b82f6');
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [loadingMeasures, setLoadingMeasures] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const reactFlowRef = useRef<ReactFlowRef>(null);

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

  const handleGenerateSteps = () => {
    // TODO: Implement generate steps functionality
  };

  const handleSaveDraft = () => {
    // TODO: Implement save draft functionality
  };

  const handleClearAll = () => {
    // Clear form fields
    setProcessDescription("");
    setProcessTitle("");
    setSelectedSample("");
    
    // Clear React Flow
    if (reactFlowRef.current) {
      reactFlowRef.current.clearFlow();
    }
    
    // Clear localStorage simulation-flow
    localStorage.removeItem('simulation-flow');
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
    
    // If validation passes, proceed with submission
    
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
        iters: 10,
        temperature: 0.5,
        user_id: parsedUser.id,
        title: processTitle || "Simulation Flow",
      };
      
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
        alert("Simulation submitted successfully! Task ID: " + result.task_id);
      } else {
        throw new Error(result.message || 'Simulation failed to start');
      }
      
    } catch (error) {
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
      getMeasures(user.user_id);
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
            <div className={`w-56 bg-white border-r border-gray-200 p-4 space-y-6 transition-opacity duration-500 ${contentLoaded ? 'opacity-100' : 'opacity-0'}`}>
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
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Colors</h3>
              <div className="relative group">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  Color selection is for visual organization only and does not affect your simulation results
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
                  }}
                  className={`w-6 h-6 rounded cursor-pointer border-2 flex items-center justify-center ${
                    selectedColor === colorOption.color 
                      ? 'border-gray-400 ring-2 ring-gray-300' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  title={colorOption.isRemove ? 'Remove color' : `Select ${colorOption.name}`}
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
                {samples.map((s) => (
                  <option key={s.id} value={s.id}>
                  {s.label}
                </option>
                ))}
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Process Description Section */}
          <div className="bg-gray-50 p-6 border-b border-gray-200">
            <div className="max-w-4xl space-y-6">
              {/* Process Description Section */}
              <div>
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
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Steps
                  </Button>
                </div>
              </div>

              {/* Process Title Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Title of the process
                </h3>
                <input
                  type="text"
                  placeholder="Enter process title..."
                  value={processTitle}
                  onChange={(e) => setProcessTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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