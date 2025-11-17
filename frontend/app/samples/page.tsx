"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronRight, Plus, Users, MoreHorizontal, Trash2, Edit2, Copy } from "lucide-react";
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
  id: string; // Changed to string for uuid
  user_id: string;
  created_at: string; // Changed to match Supabase field
  name: string;
  attributes: any; // JSON object from Supabase
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
  options?: AttributeOption[];
}

interface AttributeOption {
  id: string;
  label: string;
}

interface AttributeSelection {
  attributeId: string;
  selectedOptions: string[];
}

export default function SamplesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [isNewSampleModalOpen, setIsNewSampleModalOpen] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [renamingSample, setRenamingSample] = useState<string | null>(null);
  const [newSampleName, setNewSampleName] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement>>({});
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const hasInitiallyLoadedRef = useRef(false);

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

  const fetchSamples = async (userId: string) => {
    const { data, error } = await supabase
      .from("samples")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching samples:", error);
      return [];
    }

    // Transform Supabase data to match our interface
    return data.map((sample: any) => ({
      ...sample,
      expanded: false,
      // Parse attributes if it's a JSON string
      attributes: typeof sample.attributes === 'string' ? JSON.parse(sample.attributes) : sample.attributes,
      // Convert created_at to a readable date format
      createdDate: new Date(sample.created_at).toLocaleDateString(),
      // Extract attribute categories for display
      attributeCategories: extractAttributeCategories(sample.attributes)
    }));
  };

  const insertSample = async (sampleData: { name: string; attributes: any; user_id: string }) => {
    const { data, error } = await supabase
      .from("samples")
      .insert([sampleData])
      .select()
      .single();

    if (error) {
      console.error("Error inserting sample:", error);
      throw error;
    }

    return data;
  };

  const extractAttributeCategories = (attributes: any) => {
    if (!attributes || typeof attributes !== 'object') return [];
    
    // Check if attributes is already in the structured format (array of objects with label, category, values)
    if (Array.isArray(attributes)) {
      // Group attributes by category for display
      const groupedByCategory = attributes.reduce((acc, attr) => {
        if (!acc[attr.category]) {
          acc[attr.category] = [];
        }
        acc[attr.category].push(attr);
        return acc;
      }, {} as Record<string, any[]>);

      // Convert to display format
      return Object.entries(groupedByCategory).map(([category, attrs]) => ({
        name: category,
        attributeType: (attrs as any[]).map((attr: any) => attr.label).join(', '),
        values: (attrs as any[]).flatMap((attr: any) => attr.values)
      }));
    }
    
    // Handle legacy flat key-value format
    // Group attributes by category
    const groupedAttributes = Object.entries(attributes).reduce((acc, [key, value]) => {
      // Extract category from attribute key (assuming format like "category_attributeType")
      const [category, attributeType] = key.split('_');
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ attributeType, value });
      return acc;
    }, {} as Record<string, any[]>);

    // Convert to category format
    return Object.entries(groupedAttributes).map(([category, attrs]) => ({
      name: category,
      attributeType: attrs[0]?.attributeType || category,
      values: attrs.map(attr => String(attr.value))
    }));
  };

  useEffect(() => {
    if (user && isAuthenticated && !hasInitiallyLoadedRef.current) {
      hasInitiallyLoadedRef.current = true;
      getUserData(user.user_id);
      loadSamples(user.user_id);
    } else if (!user || !isAuthenticated) {
      // Reset the ref when user logs out
      hasInitiallyLoadedRef.current = false;
      setSamples([]);
      setContentLoaded(false);
    }
  }, [user?.user_id, isAuthenticated]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openDropdown) return;

      const target = event.target as Node;
      
      // Check if click is inside the dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }

      // Check if click is on any dropdown toggle button
      const clickedButton = Object.values(buttonRefs.current).find(
        button => button && button.contains(target)
      );
      
      if (!clickedButton) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      // Use click event in bubble phase so button onClick processes first
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openDropdown]);

  const loadSamples = async (userId: string) => {
    setIsLoadingSamples(true);
    try {
      const fetchedSamples = await fetchSamples(userId);
      setSamples(fetchedSamples);
    } catch (error) {
      console.error("Error loading samples:", error);
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const toggleSampleExpansion = (sampleId: string) => {
    setSamples(samples.map(sample => 
      sample.id === sampleId 
        ? { ...sample, expanded: !sample.expanded }
        : sample
    ));
  };

  const handleDeleteSample = async (sampleId: string) => {
    if (!confirm('Are you sure you want to delete this sample? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('samples')
        .delete()
        .eq('id', sampleId);

      if (error) {
        console.error('Error deleting sample:', error);
        alert('Failed to delete sample. Please try again.');
        return;
      }

      // Remove the sample from the local state
      setSamples(prev => prev.filter(sample => sample.id !== sampleId));
      setOpenDropdown(null); // Close the dropdown
    } catch (error) {
      console.error('Error deleting sample:', error);
      alert('Failed to delete sample. Please try again.');
    }
  };

  const toggleDropdown = (sampleId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion when clicking dropdown
    
    if (openDropdown === sampleId) {
      setOpenDropdown(null);
    } else {
      const button = buttonRefs.current[sampleId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right
        });
      }
      setOpenDropdown(sampleId);
    }
  };

  const handleRenameSample = (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (sample) {
      setRenamingSample(sampleId);
      setNewSampleName(sample.name);
      setOpenDropdown(null);
    }
  };

  const handleEditSample = (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (sample) {
      setEditingSample(sample);
      setIsEditModalOpen(true);
      setOpenDropdown(null);
    }
  };

  const handleDuplicateSample = async (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (!sample || !user) return;

    try {
      const duplicateData = {
        name: `${sample.name} (Copy)`,
        attributes: sample.attributes,
        user_id: user.user_id
      };

      const insertedSample = await insertSample(duplicateData);
      const transformedSample: Sample = {
        ...insertedSample,
        expanded: false,
        createdDate: new Date(insertedSample.created_at).toLocaleDateString(),
        attributeCategories: extractAttributeCategories(insertedSample.attributes)
      };

      setSamples([transformedSample, ...samples]);
      setOpenDropdown(null);
    } catch (error) {
      console.error('Error duplicating sample:', error);
      alert('Failed to duplicate sample. Please try again.');
    }
  };

  const toggleAttributeValue = async (sampleId: string, categoryIndex: number, valueIndex: number) => {
    const sample = samples.find(s => s.id === sampleId);
    if (!sample || !sample.attributeCategories) return;

    const category = sample.attributeCategories[categoryIndex];
    if (!category || !category.values[valueIndex]) return;

    const valueToToggle = category.values[valueIndex];
    
    // Update the attributes array
    const updatedAttributes = Array.isArray(sample.attributes) ? [...sample.attributes] : [];
    
    // Find the attribute that contains this value
    const attrIndex = updatedAttributes.findIndex(
      (attr: any) => attr.category === category.name && attr.values?.includes(valueToToggle)
    );

    if (attrIndex !== -1) {
      const attribute = updatedAttributes[attrIndex];
      const valueIndexInAttr = attribute.values.indexOf(valueToToggle);
      
      if (valueIndexInAttr !== -1) {
        // Remove the value
        attribute.values = attribute.values.filter((v: string) => v !== valueToToggle);
        
        // If no values left, remove the attribute entirely
        if (attribute.values.length === 0) {
          updatedAttributes.splice(attrIndex, 1);
        }
      }
    }

    // Update in database
    try {
      const { error } = await supabase
        .from('samples')
        .update({ attributes: updatedAttributes })
        .eq('id', sampleId);

      if (error) {
        console.error('Error updating sample:', error);
        alert('Failed to update sample. Please try again.');
        return;
      }

      // Update local state
      setSamples(prev => prev.map(s => 
        s.id === sampleId 
          ? { ...s, attributes: updatedAttributes, attributeCategories: extractAttributeCategories(updatedAttributes) }
          : s
      ));
    } catch (error) {
      console.error('Error updating sample:', error);
      alert('Failed to update sample. Please try again.');
    }
  };

  const saveRename = async () => {
    if (!renamingSample || !newSampleName.trim()) return;

    try {
      const { error } = await supabase
        .from('samples')
        .update({ name: newSampleName.trim() })
        .eq('id', renamingSample);

      if (error) {
        console.error('Error renaming sample:', error);
        alert('Failed to rename sample. Please try again.');
        return;
      }

      // Update the local state
      setSamples(prev => prev.map(sample => 
        sample.id === renamingSample 
          ? { ...sample, name: newSampleName.trim() }
          : sample
      ));

      setRenamingSample(null);
      setNewSampleName('');
    } catch (error) {
      console.error('Error renaming sample:', error);
      alert('Failed to rename sample. Please try again.');
    }
  };

  const cancelRename = () => {
    setRenamingSample(null);
    setNewSampleName('');
  };

  const handleNewSample = async (selectedAttributes: Attribute[], attributeSelections: AttributeSelection[]) => {
    if (!user) return;

    try {
      // Process each selected attribute with its selected options
      const attributesJson = selectedAttributes.map(attr => {
        // Find the selections for this attribute
        const selection = attributeSelections.find(sel => sel.attributeId === attr.id);
        
        // Special handling for Age attribute
        if (attr.id === 'age' && selection?.selectedOptions.length === 2) {
          const minAge = Math.min(parseInt(selection.selectedOptions[0]), parseInt(selection.selectedOptions[1]));
          const maxAge = Math.max(parseInt(selection.selectedOptions[0]), parseInt(selection.selectedOptions[1]));
          return {
            label: attr.label,
            category: attr.category,
            values: [`${minAge} - ${maxAge} years old`] // Single range value
          };
        }
        
        // Get the actual option labels from the selected option IDs for other attributes
        const selectedValues = selection?.selectedOptions.map(optionId => {
          const option = attr.options?.find(opt => opt.id === optionId);
          return option?.label || optionId; // Fallback to ID if option not found
        }) || [];

        return {
          label: attr.label, // The attribute name (e.g., "Age", "Gender")
          category: attr.category, // The category (e.g., "demographics")
          values: selectedValues // The actual selected option labels (e.g., ["25", "30", "35"])
        };
      });

      // Insert into Supabase
      const newSampleData = {
        name: `Sample ${samples.length + 1}`,
        attributes: attributesJson,
        user_id: user.user_id
      };

      const insertedSample = await insertSample(newSampleData);

      // Transform the inserted sample to match our interface
      const transformedSample: Sample = {
        ...insertedSample,
        expanded: false,
        createdDate: new Date(insertedSample.created_at).toLocaleDateString(),
        attributeCategories: extractAttributeCategories(insertedSample.attributes),
        selectedAttributes: selectedAttributes.map(attr => attr.label)
      };

      // Add to local state
      setSamples([transformedSample, ...samples]);
    } catch (error) {
      console.error("Error creating new sample:", error);
      // You might want to show an error message to the user here
    }
  };

  const handleUpdateSample = async (selectedAttributes: Attribute[], attributeSelections: AttributeSelection[]) => {
    if (!user || !editingSample) return;

    try {
      // Process each selected attribute with its selected options
      const attributesJson = selectedAttributes.map(attr => {
        // Find the selections for this attribute
        const selection = attributeSelections.find(sel => sel.attributeId === attr.id);
        
        // Special handling for Age attribute
        if (attr.id === 'age' && selection?.selectedOptions.length === 2) {
          const minAge = Math.min(parseInt(selection.selectedOptions[0]), parseInt(selection.selectedOptions[1]));
          const maxAge = Math.max(parseInt(selection.selectedOptions[0]), parseInt(selection.selectedOptions[1]));
          return {
            label: attr.label,
            category: attr.category,
            values: [`${minAge} - ${maxAge} years old`] // Single range value
          };
        }
        
        // Get the actual option labels from the selected option IDs for other attributes
        const selectedValues = selection?.selectedOptions.map(optionId => {
          const option = attr.options?.find(opt => opt.id === optionId);
          return option?.label || optionId; // Fallback to ID if option not found
        }) || [];

        return {
          label: attr.label,
          category: attr.category,
          values: selectedValues
        };
      });

      // Update in Supabase
      const { error } = await supabase
        .from('samples')
        .update({ attributes: attributesJson })
        .eq('id', editingSample.id);

      if (error) {
        console.error('Error updating sample:', error);
        alert('Failed to update sample. Please try again.');
        return;
      }

      // Update local state
      setSamples(prev => prev.map(sample => 
        sample.id === editingSample.id 
          ? { 
              ...sample, 
              attributes: attributesJson,
              attributeCategories: extractAttributeCategories(attributesJson)
            }
          : sample
      ));

      setIsEditModalOpen(false);
      setEditingSample(null);
    } catch (error) {
      console.error("Error updating sample:", error);
      alert('Failed to update sample. Please try again.');
    }
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
      <div className="flex-1 bg-gray-50 p-8 overflow-y-auto" style={{ minHeight: 0 }}>
        <div className="bg-white rounded-lg border border-gray-200" style={{ overflow: 'visible' }}>
          {/* Samples Overview Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-[#6366f1]">Samples Overview</h2>
            <p className="text-gray-600 text-sm mt-1">View and manage your samples. Click on a sample name to expand and see attributes.</p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attributes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoadingSamples ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Spinner />
                        <p className="text-gray-500 mt-4">Loading samples...</p>
                      </div>
                    </td>
                  </tr>
                ) : samples.length === 0 ? (
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
{renamingSample === sample.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={newSampleName}
                                  onChange={(e) => setNewSampleName(e.target.value)}
                                  className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveRename();
                                    } else if (e.key === 'Escape') {
                                      cancelRename();
                                    }
                                  }}
                                />
                                <button
                                  onClick={saveRename}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelRename}
                                  className="text-gray-500 hover:text-gray-700 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{sample.name}</span>
                            )}
                            <div className="ml-auto relative">
                              <button 
                                ref={(el) => {
                                  if (el) {
                                    buttonRefs.current[sample.id] = el;
                                  } else {
                                    delete buttonRefs.current[sample.id];
                                  }
                                }}
                                onClick={(e) => toggleDropdown(sample.id, e)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(sample.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sample.attributeCategories?.length || 0} attribute{(sample.attributeCategories?.length || 0) !== 1 ? 's' : ''}
                        </td>
                      </tr>
                      {sample.expanded && (
                        <tr>
                          <td colSpan={3} className="px-6 py-4 bg-gray-50">
                            <div className="text-sm text-gray-600">
                              <p className="font-medium text-[#6366f1] mb-4">Selected Attributes:</p>
                              <div className="grid grid-cols-3 gap-4">
                                {sample.attributeCategories?.map((category, categoryIndex) => (
                                  <div key={categoryIndex} className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 mb-1">{category.name}</div>
                                        <div className="text-base font-semibold text-blue-600 truncate">{category.attributeType}</div>
                                      </div>
                                    </div>
                                    
                                    {category.values.length > 0 && (
                                      <div className="space-y-2">
                                        {category.values.slice(0, 8).map((value, valueIndex) => (
                                          <div
                                            key={valueIndex}
                                            className="flex items-center space-x-2 text-sm text-gray-900"
                                          >
                                            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                            <span className="truncate">{value}</span>
                                          </div>
                                        ))}
                                        {category.values.length > 8 && (
                                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                              <span className="text-xs">...</span>
                                            </div>
                                            <span className="text-xs">+{category.values.length - 8} more</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
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

      {/* Portal-based Dropdown */}
      {openDropdown && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-[99999]"
          style={{
            top: dropdownPosition.top,
            right: dropdownPosition.right
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleEditSample(openDropdown);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Edit2 className="w-4 h-4 mr-3" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDuplicateSample(openDropdown);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Copy className="w-4 h-4 mr-3" />
            Duplicate
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRenameSample(openDropdown);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Edit2 className="w-4 h-4 mr-3" />
            Rename
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteSample(openDropdown);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-3" />
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* New Sample Modal */}
      <NewSampleModal
        isOpen={isNewSampleModalOpen}
        onClose={() => setIsNewSampleModalOpen(false)}
        onSave={handleNewSample}
      />

      {/* Edit Sample Modal */}
      {editingSample && (
        <NewSampleModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSample(null);
          }}
          onSave={handleUpdateSample}
          initialSample={editingSample}
        />
      )}
    </AppLayout>
  );
}