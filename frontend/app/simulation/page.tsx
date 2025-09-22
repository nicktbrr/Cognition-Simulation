"use client";

import React, { useEffect, useState } from "react";
import { Save, Download, RotateCcw, RotateCw, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";

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

  const handleSubmitSimulation = () => {
    console.log("Submit for Simulation clicked");
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
            <h3 className="text-sm font-semibold text-blue-600 mb-3">Tools</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="w-20 h-8 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-medium">
                  Step
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded flex items-center justify-center text-gray-700 text-xs">
                  Connection
                </div>
              </div>
            </div>
          </div>

          {/* Colors Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Colors</h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-red-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-green-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-yellow-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-purple-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-pink-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-gray-500 rounded cursor-pointer"></div>
              <div className="w-6 h-6 bg-black rounded cursor-pointer"></div>
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
          <div className="flex-1 bg-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gray-50">
              {/* This would be the canvas/drawing area */}
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎨</div>
                  <p className="text-lg">Design your simulation flow</p>
                  <p className="text-sm mt-2">Use the tools on the left to create steps and connections</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}