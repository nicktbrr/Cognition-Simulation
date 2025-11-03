"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import { Button } from "../components/ui/button";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import ProjectsTable from "../components/ProjectsTable";
import Spinner from "../components/ui/spinner";

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
  sample_size?: number; // Sample size for the simulation
  status: string;
  progress?: number; // Progress percentage for running simulations
  downloads: Download[];
  steps: SimulationStep[];
  created_at?: string;
  id?: string;
  experiment_id?: string; // Backend experiment ID for polling
}

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

// Mock data for demonstration - replace with real data


export default function DashboardHistory() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [projectToRename, setProjectToRename] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to check if a project was created within the last 20 minutes
  const isRecentProject = (createdAt: string | undefined): boolean => {
    if (!createdAt) return false;
    const createdTime = new Date(createdAt).getTime();
    const now = Date.now();
    const twentyMinutesAgo = now - (20 * 60 * 1000); // 20 minutes in milliseconds
    return createdTime >= twentyMinutesAgo;
  };

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
        // Determine status and progress
        let status = experiment.status || "Draft";
        let progress: number | undefined = undefined;
        
        // Normalize status and check for progress
        const statusLower = status.toLowerCase();
        if (statusLower === 'running' || statusLower === 'started' || statusLower === 'in_progress') {
          status = 'Running';
          // Progress might be stored in experiment.progress, experiment.progress_percent, or calculated
          progress = experiment.progress !== undefined ? experiment.progress : 
                     experiment.progress_percent !== undefined ? experiment.progress_percent : 
                     0;
        } else if (statusLower === 'completed' || statusLower === 'done' || statusLower === 'finished') {
          status = 'Completed';
        } else if (statusLower === 'failed' || statusLower === 'error') {
          status = 'Failed';
        }
        
        return {
          name: experimentData.title || experiment.simulation_name || `Simulation ${index + 1}`,
          sample_name: experiment.sample_name || experiment.description || "No seed",
          sample_size: experiment.sample_size ?? experiment.experiment_data?.sample_size ?? 10, // Default to 10
          status: status,
          progress: progress,
          created_at: experiment.created_at,
          id: experiment.experiment_id,
          experiment_id: experiment.experiment_id,
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
      setContentLoaded(true);
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

  const handleStartRename = (projectId: string, currentName: string) => {
    setProjectToRename({ id: projectId, name: currentName });
    setNewName(currentName);
    setShowRenameModal(true);
  };

  const handleSaveRename = async () => {
    if (!projectToRename || !newName.trim()) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from("experiments")
        .select("experiment_data")
        .eq("experiment_id", projectToRename.id)
        .single();

      if (error) {
        console.error("Error fetching experiment:", error);
        alert("Error renaming project. Please try again.");
        return;
      }

      const updatedExperimentData = {
        ...data.experiment_data,
        title: newName.trim()
      };

      const { error: updateError } = await supabase
        .from("experiments")
        .update({ experiment_data: updatedExperimentData })
        .eq("experiment_id", projectToRename.id);

      if (updateError) {
        console.error("Error updating experiment:", updateError);
        alert("Error renaming project. Please try again.");
        return;
      }

      // Refresh projects after successful update
      if (user) {
        await getProjects(user.user_id);
      }
      
      // Close modal
      setShowRenameModal(false);
      setProjectToRename(null);
      setNewName("");
    } catch (error) {
      console.error("Error in rename operation:", error);
      alert("Error renaming project. Please try again.");
    }
  };

  const handleCancelRename = () => {
    setShowRenameModal(false);
    setProjectToRename(null);
    setNewName("");
  };

  const handleModify = async (projectId: string) => {
    // Redirect to simulation page with the experiment ID
    router.push(`/simulation?modify=${projectId}`);
    return true;
  };

  const handleDelete = async (projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteConfirm(true);
    return true;
  };

  const confirmDelete = async () => {
    if (projectToDelete && user) {
      try {
        const { error } = await supabase
          .from("experiments")
          .delete()
          .eq("experiment_id", projectToDelete);

        if (error) {
          console.error("Error deleting project:", error);
          alert("Error deleting project. Please try again.");
        } else {
          // Refresh projects after successful deletion
          await getProjects(user.user_id);
          alert("Project deleted successfully!");
        }
      } catch (error) {
        console.error("Error in delete operation:", error);
        alert("Error deleting project. Please try again.");
      }
    }
    
    // Close modal
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  };

  // Function to check progress for a running simulation by querying Supabase directly
  const checkProgress = async (experimentId: string, userId: string) => {
    try {
      console.log(`[Polling] Checking progress for experiment: ${experimentId}`);
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
        
        // Update the project with new progress
        setProjects(prev => prev.map(project => {
          if (project.experiment_id === experimentId) {
            // Stop polling immediately when progress reaches 100%
            const isFailed = statusLower === 'failed';
            const isComplete = progressPercent >= 100 || statusLower === 'completed';
            
            // If progress >= 100, mark as completed immediately to stop polling
            const shouldStopPolling = progressPercent >= 100 || isComplete;
            
            return {
              ...project,
              status: isFailed ? 'Failed' : 
                     isComplete ? 'Completed' : 'Running',
              // Clear progress when >= 100 to stop polling
              progress: shouldStopPolling ? undefined : progressPercent
            };
          }
          return project;
        }));

        // If completed or failed, refresh the projects list after a delay
        if (progressPercent >= 100 || statusLower === 'completed' || statusLower === 'failed') {
          console.log(`[Polling] Experiment ${experimentId} completed (progress: ${progressPercent}%, status: ${status}). Polling will stop.`);
          setTimeout(() => {
            if (user) {
              getProjects(user.user_id);
            }
          }, 1000);
        } else {
          console.log(`[Polling] Experiment ${experimentId} progress: ${progressPercent}%, status: ${status}`);
        }
      }
    } catch (error) {
      console.error("Error checking progress:", error);
    }
  };

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
      // getHistory(user.user_id);
      getProjects(user.user_id);
    }
  }, [user, isAuthenticated]);

  // Poll for progress on running simulations
  useEffect(() => {
    if (!user || !isAuthenticated) {
      // Clear interval if user is not authenticated
      if (pollingIntervalRef.current) {
        console.log('[Polling] User not authenticated. Stopping polling interval.');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const pollInterval = () => {
      // Check current state on each poll to avoid closure issues
      setProjects(currentProjects => {
        // Only poll projects that are Running with progress < 100 AND created within last 20 minutes
        // Exclude Completed/Failed statuses (they stop polling)
        // Exclude old/stuck simulations (older than 20 minutes)
        // If progress is undefined, still poll (might be just started)
        // But if progress is a number >= 100, don't poll
        const allRunningProjects = currentProjects.filter(p => 
          p.experiment_id && 
          p.status === 'Running' && 
          (p.progress === undefined || (typeof p.progress === 'number' && p.progress < 100))
        );
        
        const runningProjects = allRunningProjects.filter(p => isRecentProject(p.created_at));
        
        // Log if we filtered out any old projects
        const oldProjects = allRunningProjects.filter(p => !isRecentProject(p.created_at));
        if (oldProjects.length > 0) {
          oldProjects.forEach(p => {
            const ageMinutes = p.created_at 
              ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60))
              : 'unknown';
            console.log(`[Polling] Skipping old project ${p.experiment_id} (created ${ageMinutes} minutes ago, older than 20 minutes)`);
          });
        }

        // If no running projects, stop polling
        if (runningProjects.length === 0) {
          if (pollingIntervalRef.current) {
            console.log('[Polling] No recent running projects found (within last 20 minutes). Stopping polling interval.');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return currentProjects;
        }

        console.log(`[Polling] Polling ${runningProjects.length} running project(s)`);
        // Poll each running project
        runningProjects.forEach(project => {
          if (project.experiment_id && user.user_id) {
            checkProgress(project.experiment_id, user.user_id);
          }
        });

        // Return unchanged state (we're just reading it)
        return currentProjects;
      });
    };

    // Clear any existing interval before starting a new one
    if (pollingIntervalRef.current) {
      console.log('[Polling] Clearing existing polling interval');
      clearInterval(pollingIntervalRef.current);
    }

    // Check if there are any running projects (created within last 20 minutes) before starting polling
    const hasRunningProjects = projects.some(p => 
      p.experiment_id && 
      p.status === 'Running' && 
      (p.progress === undefined || (typeof p.progress === 'number' && p.progress < 100)) &&
      isRecentProject(p.created_at)
    );

    // Only start polling if there are running projects
    if (hasRunningProjects) {
      const runningCount = projects.filter(p => 
        p.experiment_id && 
        p.status === 'Running' && 
        (p.progress === undefined || (typeof p.progress === 'number' && p.progress < 100)) &&
        isRecentProject(p.created_at)
      ).length;
      console.log(`[Polling] Starting polling interval for ${runningCount} running project(s) (created within last 20 minutes)`);
      pollingIntervalRef.current = setInterval(pollInterval, 500);
    } else {
      console.log('[Polling] No running projects (created within last 20 minutes). Polling not started.');
    }

    return () => {
      if (pollingIntervalRef.current) {
        console.log('[Polling] Component unmounting or dependencies changed. Cleaning up polling interval.');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [projects, user, isAuthenticated]);


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
      <div className="flex-1 p-8 bg-gray-100 overflow-y-auto">
        {loadingProjects ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-gray-500">
              <Spinner size="md" />
              <span>Loading projects...</span>
            </div>
          </div>
        ) : (
          <div className={`transition-opacity duration-500 ${contentLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <ProjectsTable 
              projects={projects}
              onDownload={handleDownload}
              onRename={handleStartRename}
              onModify={handleModify}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {showRenameModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename Simulation</h3>
            <div className="mb-6">
              <label htmlFor="new-name" className="block text-sm font-medium text-gray-700 mb-2">
                New Name
              </label>
              <input
                id="new-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename();
                  } else if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter simulation name"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleCancelRename}
                variant="outline"
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRename}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!newName.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Simulation</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this simulation? This will permanently remove it from your projects list.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={cancelDelete}
                variant="outline"
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}