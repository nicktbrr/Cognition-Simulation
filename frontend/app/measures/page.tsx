"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import AddMeasureModal from "../components/AddMeasureModal";
import MeasureCard from "../components/ui/MeasureCard";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface Measure {
  id: string;
  title: string;
  description: string;
  metric: string;
  target: string;
}

// Mock data for demonstration
const mockMeasures: Measure[] = [
  {
    id: "1",
    title: "Customer Satisfaction",
    description: "Measure overall customer satisfaction through post-interaction surveys",
    metric: "CSAT Score",
    target: "≥ 4.5/5.0"
  },
  {
    id: "2",
    title: "Response Time",
    description: "Average time to respond to customer inquiries across all channels",
    metric: "Response Time",
    target: "< 2 hours"
  }
];

export default function MeasuresPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [measures, setMeasures] = useState<Measure[]>(mockMeasures);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const measuresPerPage = 6;

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

  const handleAddMeasure = (newMeasure: Omit<Measure, 'id'>) => {
    const measure: Measure = {
      id: Date.now().toString(),
      ...newMeasure
    };
    setMeasures([...measures, measure]);
  };

  const handleEditMeasure = (id: string) => {
    // TODO: Implement edit functionality
    console.log('Edit measure:', id);
  };

  const handleDeleteMeasure = (id: string) => {
    setMeasures(measures.filter(m => m.id !== id));
  };

  // Pagination
  const totalPages = Math.ceil(measures.length / measuresPerPage);
  const startIndex = (currentPage - 1) * measuresPerPage;
  const endIndex = startIndex + measuresPerPage;
  const currentMeasures = measures.slice(startIndex, endIndex);

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
    }
  }, [user, isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <AuthLoading message="Loading measures..." />;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout 
      currentPage="measures" 
      headerTitle="Performance Measures"
      userData={userData}
    >
      <SubHeader
        title="Performance Measures"
        description="Define and track key performance indicators for your simulations"
      >
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Measure
        </Button>
      </SubHeader>

      {/* Content */}
      <div className="flex-1 p-8 bg-gray-50">
        {measures.length > 0 ? (
          <>
            {/* Pagination Info */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {startIndex + 1} of {measures.length}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Measures Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentMeasures.map((measure) => (
                <MeasureCard
                  key={measure.id}
                  title={measure.title}
                  description={measure.description}
                  metric={measure.metric}
                  target={measure.target}
                  onEdit={() => handleEditMeasure(measure.id)}
                  onDelete={() => handleDeleteMeasure(measure.id)}
                />
              ))}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No measures defined</h3>
              <p className="text-gray-600 mb-4">
                Start by adding your first performance measure to track simulation results.
              </p>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Measure
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Measure Modal */}
      <AddMeasureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddMeasure}
      />
    </AppLayout>
  );
}