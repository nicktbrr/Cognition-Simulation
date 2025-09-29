"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import { Button } from "../components/ui/button";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import ProjectsTable from "../components/ProjectsTable";

interface SimulationHistoryItem {
  created_at: string;
  name: string;
  url: string;
  sample_name?: string;
  status?: string;
}

interface Download {
  date: string;
  id: number;
  url?: string;
  filename?: string;
}

interface SimulationStep {
  label: string;
  instructions: string;
  temperature: number;
}

interface Project {
  name: string;
  sample_name: string;
  status: string;
  downloads: Download[];
  steps: SimulationStep[];
  created_at?: string;
  id?: number;
}

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

// Mock data for demonstration - replace with real data


export default function DashboardHistory() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const getHistory = async (userId: string) => {
    const { data, error } = await supabase.from("dashboard").select("created_at, name, url").eq("user_id", userId);
    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data);
    }
  };

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

  const getProjects = async (userId: string) => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from("experiments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching projects:", error);
        setProjects([]);
        return;
      }

      const formattedProjects: Project[] = data.map((experiment: any, index: number) => {
        const experimentData = experiment.experiment_data || {};
        return {
          name: experimentData.title || experiment.simulation_name || `Simulation ${index + 1}`,
          sample_name: experiment.sample_name || experiment.description || "No seed",
          status: experiment.status || "Draft",
          created_at: experiment.created_at,
          id: experiment.id,
          downloads: experiment.url ? [
            {
              date: new Date(experiment.created_at).toLocaleString(),
              id: experiment.id || index + 1,
              url: experiment.url,
              filename: experimentData.title || experiment.simulation_name || `simulation_${experiment.id}`
            }
          ] : [],
          steps: experimentData.steps && Array.isArray(experimentData.steps) ? 
            experimentData.steps.map((step: any, stepIndex: number) => ({
              label: step.label || `Step ${stepIndex + 1}`,
              instructions: step.instructions || "No instructions provided",
              temperature: (step.temperature * 100) || 50
            })) : 
            [
              {
                label: "Default Step",
                instructions: "No steps defined for this experiment",
                temperature: 50
              }
            ]
        };
      });

      setProjects(formattedProjects);
    } catch (error) {
      console.error("Error processing projects data:", error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleDownload = async (public_url: string, filename: string) => {
    try {
      const response = await fetch(public_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `cogsim_${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const handleRename = async (projectId: number, newName: string) => {
    try {
      const { data, error } = await supabase
        .from("experiments")
        .select("experiment_data")
        .eq("id", projectId)
        .single();

      if (error) {
        console.error("Error fetching experiment:", error);
        return false;
      }

      const updatedExperimentData = {
        ...data.experiment_data,
        title: newName
      };

      const { error: updateError } = await supabase
        .from("experiments")
        .update({ experiment_data: updatedExperimentData })
        .eq("id", projectId);

      if (updateError) {
        console.error("Error updating experiment:", updateError);
        return false;
      }

      // Refresh projects after successful update
      if (user) {
        await getProjects(user.user_id);
      }
      return true;
    } catch (error) {
      console.error("Error in rename operation:", error);
      return false;
    }
  };

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
      // getHistory(user.user_id);
      getProjects(user.user_id);
    }
  }, [user, isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <AuthLoading message="Loading dashboard..." />;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout 
      currentPage="dashboard" 
      headerTitle="Dashboard"
      userData={userData}
    >
      <SubHeader
        title="Simulation Projects"
        description="Manage and monitor your simulation projects"
      >
        <Link href="/simulation">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2">
            <Play className="w-4 h-4" />
            New Simulation
          </Button>
        </Link>
      </SubHeader>

      {/* Content */}
      <div className="flex-1 p-8 bg-gray-100">
        {loadingProjects ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading projects...</div>
          </div>
        ) : (
          <ProjectsTable 
            projects={projects}
            onDownload={handleDownload}
            onRename={handleRename}
          />
        )}
      </div>
    </AppLayout>
  );
}