"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, ChevronDown, MoreVertical, Edit, Copy, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import AddMeasureModal from "../components/AddMeasureModal";
import Spinner from "../components/ui/spinner";

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
  const [editingMeasure, setEditingMeasure] = useState<Measure | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [loadingMeasures, setLoadingMeasures] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [measureToDelete, setMeasureToDelete] = useState<string | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
      setContentLoaded(true);
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
      setEditingMeasure(null);
    } catch (error) {
      console.error("Error in handleAddMeasure:", error);
    }
  };

  const handleUpdateMeasure = async (id: string, updatedMeasure: Omit<Measure, 'id'>) => {
    if (!user) {
      console.error("No user found");
      return;
    }

    try {
      // Parse the range to get min and max values
      const [min, max] = updatedMeasure.range.split(' - ').map(val => parseFloat(val.trim()));

      const { data, error } = await supabase
        .from("measures")
        .update({
          title: updatedMeasure.title,
          definition: updatedMeasure.description,
          min: min,
          max: max,
          desired_values: updatedMeasure.desiredValues
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating measure:", error);
        return;
      }

      // Update the measure in local state
      const updated: Measure = {
        id: data.id,
        title: data.title,
        description: data.definition,
        range: `${data.min} - ${data.max}`,
        desiredValues: data.desired_values || []
      };
      
      setMeasures(measures.map(m => m.id === id ? updated : m));
      setEditingMeasure(null);
    } catch (error) {
      console.error("Error in handleUpdateMeasure:", error);
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

  const toggleDropdown = (measureId: string, event: React.MouseEvent) => {
    if (openDropdown === measureId) {
      setOpenDropdown(null);
    } else {
      const button = event.currentTarget as HTMLButtonElement;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
      setOpenDropdown(measureId);
    }
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
    const measureToEdit = measures.find(m => m.id === id);
    if (measureToEdit) {
      setEditingMeasure(measureToEdit);
      setIsAddModalOpen(true);
    }
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
    setMeasureToDelete(id);
    setShowDeleteConfirm(true);
    setOpenDropdown(null);
  };

  const confirmDelete = async () => {
    if (!measureToDelete) return;

    try {
      const { error } = await supabase
        .from("measures")
        .delete()
        .eq("id", measureToDelete);

      if (error) {
        console.error("Error deleting measure:", error);
        return;
      }

      // Remove from local state
      setMeasures(measures.filter(m => m.id !== measureToDelete));
      setShowDeleteConfirm(false);
      setMeasureToDelete(null);
    } catch (error) {
      console.error("Error in confirmDelete:", error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setMeasureToDelete(null);
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
    >
      <SubHeader
        title="Measures"
        description="Define and track key performance indicators for your simulations"
      >
        <Button 
          onClick={() => {
            setEditingMeasure(null);
            setIsAddModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Measure
        </Button>
      </SubHeader>

      {/* Content */}
      <div className="flex-1 p-8 bg-gray-100">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-blue-600">Measures Overview</CardTitle>
            <CardDescription>
              View and manage your performance measures. Click on a measure name to expand and see anchor points.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMeasures ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-3 text-gray-500">
                  <Spinner size="md" />
                  <span>Loading measures...</span>
                </div>
              </div>
            ) : (
              <div className={`transition-opacity duration-500 ${contentLoaded ? 'opacity-100' : 'opacity-0'}`}>
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
                              ref={buttonRef}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => toggleDropdown(measure.id, e)}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
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
                          <div className="space-y-2" style={{marginLeft: '65px'}}>
                            <h4 className="font-medium text-sm text-muted-foreground mb-3">Anchor Points:</h4>
                            <div className="space-y-1">
                              {measure.desiredValues.map((desired, index) => (
                                <div key={index} className="flex items-center text-sm">
                                  <span className="bg-blue-400 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center mr-3">
                                    {desired.value}
                                  </span>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Measure Modal */}
      <AddMeasureModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingMeasure(null);
        }}
        onAdd={handleAddMeasure}
        editingMeasure={editingMeasure}
        onUpdate={handleUpdateMeasure}
      />

      {/* Portal-based Dropdown */}
      {openDropdown && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-[99999]"
          style={{
            top: dropdownPosition.top,
            right: dropdownPosition.right
          }}
        >
          <div className="py-1">
            <button
              onClick={() => handleEditMeasure(openDropdown)}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => handleDuplicateMeasure(openDropdown)}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Copy className="h-4 w-4" />
              Make a copy
            </button>
            <button
              onClick={() => handleDeleteMeasure(openDropdown)}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
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
                <h3 className="text-lg font-semibold text-gray-900">Delete Measure</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this measure? This will permanently remove it from your measures list.
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