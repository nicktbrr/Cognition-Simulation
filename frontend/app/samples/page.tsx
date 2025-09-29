"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

export default function SamplesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);

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

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
    }
  }, [user, isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <AuthLoading message="Loading samples..." />;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout 
      currentPage="samples" 
      headerTitle="Samples"
      userData={userData}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Samples</h1>
            <p className="text-gray-600 mt-1">Manage datasets and sample configurations for your research</p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Samples Coming Soon</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              This section will provide tools for managing datasets, participant samples, 
              and data configurations for your cognitive simulation research.
            </p>
            <div className="space-y-4 text-left max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-900">Planned Features:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                  Dataset upload and management
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                  Sample size calculations and power analysis
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                  Data preprocessing and cleaning tools
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                  Participant demographics and sampling strategies
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                  Data validation and quality checks
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                  Integration with external data sources
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}