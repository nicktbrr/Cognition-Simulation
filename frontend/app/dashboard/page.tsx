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

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

// Mock data for demonstration - replace with real data
const mockProjects = [
  {
    name: "Consumer Behavior Analysis",
    sample_name: "Urban Demographics Q4",
    status: "Completed",
    downloads: [
      { date: "2024-01-08 14:30", id: 1 },
      { date: "2024-01-07 09:15", id: 2 },
      { date: "2024-01-05 16:45", id: 3 }
    ],
    steps: [
      {
        label: "This is the label of the first step",
        instructions: "this is the description of the first step",
        temperature: 50
      },
      {
        label: "This is the label of the second step",
        instructions: "this is the description of the second step",
        temperature: 50
      },
      {
        label: "Make sure to keep the first row as the header",
        instructions: " Do not remove the first row",
        temperature: 50
      }
    ]
  },
  {
    name: "Market Response Simulation",
    sample_name: "Product Launch Sample",
    status: "Running",
    downloads: [
      { date: "2024-01-08 11:20", id: 4 },
      { date: "2024-01-06 13:45", id: 5 }
    ],
    steps: [
      {
        label: "This is the label of the first step",
        instructions: "this is the description of the first step",
        temperature: 50
      },
      {
        label: "This is the label of the second step",
        instructions: "this is the description of the second step",
        temperature: 50
      },
      {
        label: "Make sure to keep the first row as the header",
        instructions: " Do not remove the first row",
        temperature: 50
      }
    ]
  },
  {
    name: "Risk Assessment Model",
    sample_name: "Financial Services Data",
    status: "Draft",
    downloads: [
      { date: "2024-01-07 08:30", id: 6 }
    ],
    steps: [
      {
        label: "This is the label of the first step",
        instructions: "this is the description of the first step",
        temperature: 50
      },
      {
        label: "This is the label of the second step",
        instructions: "this is the description of the second step",
        temperature: 50
      },
      {
        label: "Make sure to keep the first row as the header",
        instructions: " Do not remove the first row",
        temperature: 50
      }
    ]
  }
];

export default function DashboardHistory() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);

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

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
      getHistory(user.user_id);
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
        <ProjectsTable 
          projects={mockProjects}
          onDownload={handleDownload}
        />
      </div>
    </AppLayout>
  );
}