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
import ProgressBanner from "../components/progress-banner";
import { Button } from "../components/ui/button"
import { LogOut } from "lucide-react"
import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";

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
interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
  name?: string; // Add optional name property
  sub?: string; // Add optional sub property for Google ID
}

// Progress data interface
interface ProgressData {
  id: string;
  user_id: string;
  task_id: string;
  progress: number;
  status: 'started' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}
  

// Dashboard page component.
export default function Dashboard() {
  const { user, isLoading, isAuthenticated, signOut } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<any[]>([]);
  const [temperature, setTemperature] = useState<number>(50);
  const [title, setTitle] = useState<string>("");
  // Add state for tracking edges
  const [edges, setEdges] = useState<Edge[]>([]);

  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [hasUrls, setHasUrls] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [showProgressBanner, setShowProgressBanner] = useState(false);

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

  // Handle progress updates from ActionButtons
  const handleProgressUpdate = (newProgress: ProgressData | null) => {
    setProgress(newProgress);
    setShowProgressBanner(newProgress !== null);
  };

  // Handle closing the progress banner
  const handleCloseProgressBanner = () => {
    setShowProgressBanner(false);
    setProgress(null);
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

  // Show loading state while checking authentication
  if (isLoading) {
    return <AuthLoading message="Loading simulation..." />;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
    {/* If the user is logged in, display the dashboard. */}
    {user ? (
        <>
      <ProgressBanner
        progress={progress}
        isVisible={showProgressBanner}
        onClose={handleCloseProgressBanner}
      />
      <div className={`max-w-6xl mx-auto p-6 space-y-8 ${showProgressBanner ? 'pt-28' : ''}`}>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-[#6a03ab] bg-[#6a03ab] text-white hover:bg-[#6a03abe6] hover:text-white"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[#6a03ab] bg-[#6a03ab] text-white hover:bg-[#6a03abe6] hover:text-white"
        >
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
        <Header name={user.name || user.user_email} />
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
            onProgressUpdate={handleProgressUpdate}
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
