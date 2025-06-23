"use client";

// Dashboard page for the application.
// It displays the main components of the application.
// It is used in the app/dashboard/page.tsx file.

import { useState, useEffect } from "react";
import Header from "../components/header";
import CollapsibleNav from "../components/collapsible-nav";
import CognitiveProcess from "../components/cognitive-process";
import EvaluationCriteria from "../components/evaluation-criteria";
import ActionButtons from "../components/action-buttons";
import SimulationStatusIndicator from "../components/indicator";
import { Button } from "../components/ui/button"
import { LogOut } from "lucide-react"
import { useRouter } from 'next/navigation'

// Step interface to track the steps of the cognitive process.
interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

// Edge interface to track connections between steps.
// Define an Edge interface to track connections
interface Edge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  animated?: boolean;
  style?: any;
  markerEnd?: any;
}

// GoogleUser interface to track the user who is logged in.
interface GoogleUser {
    name: string
    email: string
    picture: string
    sub: string // Google's user ID
  }
  

// Dashboard page component.
export default function Dashboard() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<any[]>([]);
  const [temperature, setTemperature] = useState<number>(50);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [title, setTitle] = useState<string>("");
  // Add state for tracking edges
  const [edges, setEdges] = useState<Edge[]>([]);

  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [hasUrls, setHasUrls] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const router = useRouter()

  // Update steps when they change.
  const handleStepsUpdate = (updatedSteps: Step[]) => {
    setSteps(updatedSteps);
  };

  // Update selected evaluation criteria (metrics).
  const handleMetricsUpdate = (metrics: any[]) => {
    setSelectedMetrics(metrics);
  };

  // Update global temperature when changed.
  const handleTemperatureChange = (newTemperature: number) => {
    setTemperature(newTemperature);
  };

  // Add handler for edge updates.
  const handleEdgesUpdate = (updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  };

  // Add handler for URL detection.
  const handleUrlDetection = (detected: boolean) => {
    setHasUrls(detected);
  };

  // Update title when it changes.
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  // When the submit button is pressed, log and alert the data.
  const handleSubmit = () => {
    // Create a map of step connections for easier understanding.
    const connections = edges.map((edge) => ({
      from:
        steps.find((step) => step.id.toString() === edge.source)?.label ||
        edge.source,
      to:
        steps.find((step) => step.id.toString() === edge.target)?.label ||
        edge.target,
    }));

    // Create the Excel filename with the title.
    const excelFilename = `cogsim_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`;

    alert("Steps submitted! Check console for output.");
  };

  // Use effect to check if the user is logged in.
  useEffect(() => {
    const storedUser = localStorage.getItem("googleUser")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (e) {
        localStorage.removeItem("googleUser")
      }
    }
  }, [])

  // Handle sign out.
  const handleSignOut = async () => {
    if (window.google && scriptLoaded) {
      window.google.accounts.id.disableAutoSelect()
      window.google.accounts.id.revoke(user?.sub || "", () => {
        setUser(null)
        localStorage.removeItem("googleUser")
        router.push('/')

      })
    } else {
      setUser(null)
      localStorage.removeItem("googleUser")
      window.location.replace('/');      

    }
  }

  return (
    <>
    {/* If the user is logged in, display the dashboard. */}
    {user ? (
        <>
      <SimulationStatusIndicator isActive={simulationActive} />
      <div className="max-w-6xl mx-auto p-6 space-y-8">
      <Button
                variant="outline"
                size="sm"
                className="border-[#6a03ab] bg-[#6a03ab] text-white hover:bg-[#6a03abe6] hover:text-white"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
        <Header name={user.name} />
        <CollapsibleNav />
        <main className="space-y-8">
          <CognitiveProcess
            onStepsChange={handleStepsUpdate}
            onTemperatureChange={handleTemperatureChange}
            edges={edges}
            onEdgesChange={handleEdgesUpdate}
            simulationActive={simulationActive}
            onTitleChange={handleTitleChange}
          />
          <EvaluationCriteria
            onMetricsChange={handleMetricsUpdate}
            simulationActive={simulationActive}
            onUrlDetected={handleUrlDetection}
          />
          <ActionButtons
            onSubmit={handleSubmit}
            steps={steps}
            metrics={selectedMetrics}
            edges={edges}
            setSimulationActive={setSimulationActive}
            hasUrls={hasUrls}
            title={title}
          />
        </main>
        </div>
        </>
    ) : (
      // If the user is not logged in, display a message to sign in.
      <div>
        <h1>Please sign in to continue</h1>
      </div>
    )}
    </>
  );
}
