"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import NewSampleModal from "../components/NewSampleModal";
import Spinner from "../components/ui/spinner";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface Sample {
  id: number;
  name: string;
  createdDate: string;
  attributes: number;
  expanded?: boolean;
  selectedAttributes?: string[];
  attributeCategories?: {
    name: string;
    attributeType: string;
    values: string[];
  }[];
}

interface Attribute {
  id: string;
  label: string;
  category: string;
}

export default function SamplesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([
    {
      id: 1,
      name: "Sample 1",
      createdDate: "12/31/2024",
      attributes: 2,
      expanded: false,
      attributeCategories: [
        {
          name: "Demographics",
          attributeType: "Age",
          values: ["18-24", "25-34"]
        },
        {
          name: "Geography",
          attributeType: "Region",
          values: ["North America"]
        }
      ]
    },
    {
      id: 2,
      name: "Sample 2",
      createdDate: "1/1/2025",
      attributes: 1,
      expanded: false,
      attributeCategories: [
        {
          name: "Education",
          attributeType: "Degree Level",
          values: ["Bachelor's Degree"]
        }
      ]
    }
  ]);
  const [isNewSampleModalOpen, setIsNewSampleModalOpen] = useState(false);

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
    setContentLoaded(true);
  };

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
    }
  }, [user, isAuthenticated]);

  const toggleSampleExpansion = (sampleId: number) => {
    setSamples(samples.map(sample => 
      sample.id === sampleId 
        ? { ...sample, expanded: !sample.expanded }
        : sample
    ));
  };

  const handleNewSample = (selectedAttributes: Attribute[]) => {
    // Group attributes by category
    const groupedAttributes = selectedAttributes.reduce((acc, attr) => {
      if (!acc[attr.category]) {
        acc[attr.category] = [];
      }
      acc[attr.category].push(attr.label);
      return acc;
    }, {} as Record<string, string[]>);

    // Convert to category format
    const attributeCategories = Object.entries(groupedAttributes).map(([category, values]) => ({
      name: category,
      attributeType: values[0]?.split(' - ')[0] || category, // Extract attribute type from label
      values: values
    }));

    const newSample: Sample = {
      id: samples.length + 1,
      name: `Sample ${samples.length + 1}`,
      createdDate: new Date().toLocaleDateString(),
      attributes: selectedAttributes.length,
      expanded: false,
      selectedAttributes: selectedAttributes.map(attr => attr.label),
      attributeCategories
    };
    
    setSamples([newSample, ...samples]);
  };

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
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ 
              fontFamily: 'Barlow, sans-serif',
              background: 'linear-gradient(135deg, rgb(57, 106, 241) 10%, rgb(166, 101, 246) 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Samples</h1>
          </div>
          <Button 
            onClick={() => setIsNewSampleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Sample
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-gray-50 p-8">
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Samples Overview Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-[#6366f1]">Samples Overview</h2>
            <p className="text-gray-600 text-sm mt-1">View and manage your samples. Click on a sample name to expand and see attributes.</p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attributes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {samples.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Users className="w-12 h-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No samples yet</h3>
                        <p className="text-gray-500 mb-4">Create your first sample to get started</p>
                        <Button 
                          onClick={() => setIsNewSampleModalOpen(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Sample
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  samples.map((sample) => (
                    <React.Fragment key={sample.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSampleExpansion(sample.id)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <ChevronRight 
                              className={`w-4 h-4 text-gray-400 mr-2 transition-transform ${sample.expanded ? 'rotate-90' : ''}`} 
                            />
                            <span className="text-sm font-medium text-gray-900">{sample.name}</span>
                            <div className="ml-auto">
                              <button className="text-gray-400 hover:text-gray-600">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sample.createdDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sample.attributes} attribute{sample.attributes !== 1 ? 's' : ''}
                        </td>
                      </tr>
                      {sample.expanded && (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 bg-gray-50">
                            <div className="text-sm text-gray-600">
                              <p className="font-medium text-[#6366f1] mb-3">Selected Attributes:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sample.attributeCategories?.map((category, categoryIndex) => (
                                  <div key={categoryIndex} className="bg-white rounded-lg border border-gray-200 p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">{category.name}</h4>
                                    <div className="text-[#6366f1] text-sm mb-2">{category.attributeType}</div>
                                    <ul className="space-y-1">
                                      {category.values.map((value, valueIndex) => (
                                        <li key={valueIndex} className="text-gray-700 text-sm flex items-center">
                                          <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                          {value}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Sample Modal */}
      <NewSampleModal
        isOpen={isNewSampleModalOpen}
        onClose={() => setIsNewSampleModalOpen(false)}
        onSave={handleNewSample}
      />
    </AppLayout>
  );
}