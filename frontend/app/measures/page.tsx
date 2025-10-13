"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, ChevronDown, MoreVertical, Edit, Copy, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import AddMeasureModal from "../components/AddMeasureModal";

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


export default function MeasuresPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [loadingMeasures, setLoadingMeasures] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getUserData = async (userId: string) => {
    setLoadingUserData(true);
    try {
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
    } finally {
      setLoadingUserData(false);
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
    }
  };

  const handleAddMeasure = async (newMeasure: Omit<Measure, 'id'>) => {
    if (!user) {
      console.error("No user found");
      return;
    }

    try {
      // Parse the range to get min and max values
      const [min, max] = newMeasure.range.split(' - ').map(val => parseFloat(val.trim()));

      const { data, error } = await supabase
        .from("measures")
        .insert({
          user_id: user.user_id,
          title: newMeasure.title,
          definition: newMeasure.description,
          min: min,
          max: max,
          desired_values: newMeasure.desiredValues
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating measure:", error);
        return;
      }

      // Add the new measure to the local state
      const measure: Measure = {
        id: data.id,
        title: data.title,
        description: data.definition,
        range: `${data.min} - ${data.max}`,
        desiredValues: data.desired_values || []
      };
      
      setMeasures([measure, ...measures]);
    } catch (error) {
      console.error("Error in handleAddMeasure:", error);
    }
  };

  const toggleRowExpansion = (measureId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(measureId)) {
      newExpandedRows.delete(measureId);
    } else {
      newExpandedRows.add(measureId);
    }
    setExpandedRows(newExpandedRows);
  };

  const toggleDropdown = (measureId: string) => {
    setOpenDropdown(openDropdown === measureId ? null : measureId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleEditMeasure = (id: string) => {
    // TODO: Implement edit functionality
    setOpenDropdown(null);
  };

  const handleDuplicateMeasure = async (id: string) => {
    if (!user) {
      console.error("No user found");
      return;
    }

    const measureToDuplicate = measures.find(m => m.id === id);
    if (!measureToDuplicate) {
      console.error("Measure not found");
      return;
    }

    try {
      // Parse the range to get min and max values
      const [min, max] = measureToDuplicate.range.split(' - ').map(val => parseFloat(val.trim()));

      const { data, error } = await supabase
        .from("measures")
        .insert({
          user_id: user.user_id,
          title: `${measureToDuplicate.title} (Copy)`,
          definition: measureToDuplicate.description,
          min: min,
          max: max,
          desired_values: measureToDuplicate.desiredValues
        })
        .select()
        .single();

      if (error) {
        console.error("Error duplicating measure:", error);
        return;
      }

      // Add the duplicated measure to the local state
      const duplicatedMeasure: Measure = {
        id: data.id,
        title: data.title,
        description: data.definition,
        range: `${data.min} - ${data.max}`,
        desiredValues: data.desired_values || []
      };
      
      setMeasures([duplicatedMeasure, ...measures]);
      setOpenDropdown(null);
    } catch (error) {
      console.error("Error in handleDuplicateMeasure:", error);
    }
  };

  const handleDeleteMeasure = async (id: string) => {
    try {
      const { error } = await supabase
        .from("measures")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting measure:", error);
        return;
      }

      // Remove from local state
      setMeasures(measures.filter(m => m.id !== id));
      setOpenDropdown(null);
    } catch (error) {
      console.error("Error in handleDeleteMeasure:", error);
    }
  };

  useEffect(() => {
    if (user && isAuthenticated) {
      getUserData(user.user_id);
      getMeasures(user.user_id);
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
      headerTitle="Dashboard"
      userData={userData}
      isLoading={loadingUserData}
    >
      <SubHeader
        title="Measures"
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
      <div className="flex-1 p-8 bg-gray-100 animate-in fade-in duration-500 delay-300">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Measures Overview</CardTitle>
            <CardDescription>
              View and manage your performance measures. Click on a measure name to expand and see desired values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMeasures ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Loading measures...</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Definition</TableHead>
                    <TableHead>Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {measures.map((measure) => (
                  <React.Fragment key={measure.id}>
                    <TableRow className="group hover:bg-accent/50 transition-fast">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-8 w-8"
                          onClick={() => toggleRowExpansion(measure.id)}
                        >
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedRows.has(measure.id) ? 'rotate-180' : ''
                            }`}
                          />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{measure.title}</span>
                          <div className="relative flex-shrink-0" ref={openDropdown === measure.id ? dropdownRef : null}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleDropdown(measure.id)}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                            {openDropdown === measure.id && (
                              <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleEditMeasure(measure.id)}
                                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateMeasure(measure.id)}
                                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <Copy className="h-4 w-4" />
                                    Duplicate
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMeasure(measure.id)}
                                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{measure.description}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{measure.range}</span>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(measure.id) && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/30 p-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground mb-3">Desired Values:</h4>
                            <div className="space-y-1">
                              {measure.desiredValues.map((desired, index) => (
                                <div key={index} className="flex items-center text-sm">
                                  <Badge className="mr-3 min-w-[60px] text-center">
                                    {desired.value}
                                  </Badge>
                                  <span>{desired.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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