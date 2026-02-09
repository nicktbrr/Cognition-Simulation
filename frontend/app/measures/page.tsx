"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Plus, ChevronDown, ChevronRight, MoreVertical, Edit, Edit2, Copy, Trash2, Folder, FolderPlus, FolderInput, FileText, Lock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import AddMeasureModal from "../components/AddMeasureModal";
import Spinner from "../components/ui/spinner";
import SortableTableHeader from "../components/ui/SortableTableHeader";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface DesiredValue {
  value: number;
  label: string;
}

interface MeasureFolder {
  folder_id: string;
  folder_name: string;
  created_at: string;
  measure_count?: number;
}

interface Measure {
  id: string;
  title: string;
  description: string;
  range: string;
  desiredValues: DesiredValue[];
  folder_id?: string | null;
  isLocked?: boolean; // Whether the measure has been used in a simulation
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
  const [renamingMeasure, setRenamingMeasure] = useState<string | null>(null);
  const [newMeasureName, setNewMeasureName] = useState('');
  const [showLockedWarning, setShowLockedWarning] = useState(false);
  const [lockedMeasureId, setLockedMeasureId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement>>({});
  const hasInitiallyLoadedRef = useRef(false);

  // Folder state
  const [folders, setFolders] = useState<MeasureFolder[]>([]);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [measureToMove, setMeasureToMove] = useState<string | null>(null);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null);
  const [newFolderRename, setNewFolderRename] = useState("");
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedItemName, setDeletedItemName] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderDropdownOpen, setFolderDropdownOpen] = useState<string | null>(null);
  const [folderDropdownPosition, setFolderDropdownPosition] = useState({ top: 0, right: 0 });
  const folderButtonRefs = useRef<Record<string, HTMLButtonElement>>({});
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  
  // Drag and drop state
  const [draggedMeasure, setDraggedMeasure] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null | 'root'>(null);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  const getUserData = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_emails")
      .select("user_email, user_id, pic_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    } else {
      setUserData(data ?? null);
    }
  };

  const getFolders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .eq("folder_type", "measures")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching folders:", error);
        setFolders([]);
        return;
      }

      // Count measures in each folder
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          const { count, error: countError } = await supabase
            .from("measures")
            .select("*", { count: "exact", head: true })
            .eq("folder_id", folder.folder_id)
            .eq("user_id", userId);
          
          if (countError) {
            console.error("Error counting measures in folder:", countError);
          }
          
          return {
            ...folder,
            measure_count: count || 0
          };
        })
      );

      setFolders(foldersWithCounts);
    } catch (error) {
      console.error("Error processing folders data:", error);
      setFolders([]);
    }
  };

  // Check if a folder name already exists (case-insensitive)
  const isFolderNameTaken = (name: string, excludeFolderId?: string): boolean => {
    const normalizedName = name.trim().toLowerCase();
    return folders.some(folder => 
      folder.folder_name.toLowerCase() === normalizedName && 
      folder.folder_id !== excludeFolderId
    );
  };

  // Check if a measure name (title) already exists (case-insensitive)
  const isMeasureNameTaken = (title: string, excludeMeasureId?: string): boolean => {
    const normalizedTitle = title.trim().toLowerCase();
    return measures.some(measure => 
      measure.title.toLowerCase() === normalizedTitle && 
      measure.id !== excludeMeasureId
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user || isCreatingFolder) {
      return;
    }

    // Check for duplicate folder name
    if (isFolderNameTaken(newFolderName)) {
      alert(`A folder with the name "${newFolderName.trim()}" already exists. Please choose a different name.`);
      return;
    }

    setIsCreatingFolder(true);
    try {
      const folderId = crypto.randomUUID();
      const { error } = await supabase
        .from("folders")
        .insert({
          folder_id: folderId,
          folder_name: newFolderName.trim(),
          user_id: user.user_id,
          folder_type: "measures"
        });

      if (error) {
        console.error("Error creating folder:", error);
        alert("Error creating folder. Please try again.");
        return;
      }

      await getFolders(user.user_id);
      setShowNewFolderModal(false);
      setNewFolderName("");
    } catch (error) {
      console.error("Error in folder creation:", error);
      alert("Error creating folder. Please try again.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolder = (folderId: string, currentName: string) => {
    setFolderToRename({ id: folderId, name: currentName });
    setNewFolderRename(currentName);
    setShowRenameFolderModal(true);
    setFolderDropdownOpen(null);
  };

  const handleSaveRenameFolder = async () => {
    if (!folderToRename || !newFolderRename.trim() || !user) {
      return;
    }

    // Check for duplicate folder name (excluding current folder)
    if (isFolderNameTaken(newFolderRename, folderToRename.id)) {
      alert(`A folder with the name "${newFolderRename.trim()}" already exists. Please choose a different name.`);
      return;
    }

    try {
      const { error } = await supabase
        .from("folders")
        .update({ folder_name: newFolderRename.trim() })
        .eq("folder_id", folderToRename.id)
        .eq("user_id", user.user_id);

      if (error) {
        console.error("Error renaming folder:", error);
        alert("Error renaming folder. Please try again.");
        return;
      }

      await getFolders(user.user_id);
      setShowRenameFolderModal(false);
      setFolderToRename(null);
      setNewFolderRename("");
    } catch (error) {
      console.error("Error in folder rename operation:", error);
      alert("Error renaming folder. Please try again.");
    }
  };

  const handleCancelRenameFolder = () => {
    setShowRenameFolderModal(false);
    setFolderToRename(null);
    setNewFolderRename("");
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.folder_id === folderId);
    if (folder) {
      setFolderToDelete({ id: folderId, name: folder.folder_name });
      setShowDeleteFolderConfirm(true);
      setFolderDropdownOpen(null);
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete || !user || isDeletingFolder) {
      return;
    }

    setIsDeletingFolder(true);
    try {
      const { data: folderMeasures, error: fetchError } = await supabase
        .from("measures")
        .select("id")
        .eq("folder_id", folderToDelete.id)
        .eq("user_id", user.user_id);

      if (fetchError) {
        console.error("Error fetching measures in folder:", fetchError);
        alert("Error fetching measures in folder. Please try again.");
        setIsDeletingFolder(false);
        return;
      }

      if (folderMeasures && folderMeasures.length > 0) {
        const measureIds = folderMeasures.map(m => m.id);
        const { error: deleteMeasuresError } = await supabase
          .from("measures")
          .delete()
          .in("id", measureIds)
          .eq("user_id", user.user_id);

        if (deleteMeasuresError) {
          console.error("Error deleting measures in folder:", deleteMeasuresError);
          alert("Error deleting measures in folder. Please try again.");
          setIsDeletingFolder(false);
          return;
        }
      }

      const { error: deleteFolderError } = await supabase
        .from("folders")
        .delete()
        .eq("folder_id", folderToDelete.id)
        .eq("user_id", user.user_id);

      if (deleteFolderError) {
        console.error("Error deleting folder:", deleteFolderError);
        alert("Error deleting folder. Please try again.");
        setIsDeletingFolder(false);
        return;
      }

      await Promise.all([
        getMeasures(user.user_id),
        getFolders(user.user_id)
      ]);
      
      setShowDeleteFolderConfirm(false);
      setFolderToDelete(null);
    } catch (error) {
      console.error("Error in folder delete operation:", error);
      alert(`Error deleting folder: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const cancelDeleteFolder = () => {
    setShowDeleteFolderConfirm(false);
    setFolderToDelete(null);
  };

  const handleMoveToFolder = async (measureId: string, folderId: string | null) => {
    if (!user) {
      return;
    }

    try {
      const measure = measures.find(m => m.id === measureId);
      if (!measure) {
        console.error("Measure not found");
        alert("Error: Measure not found. Please try again.");
        return;
      }

      const oldFolderId = measure.folder_id || null;
      const updateData: { folder_id: string | null } = { folder_id: folderId };
      
      const { error: updateError } = await supabase
        .from("measures")
        .update(updateData)
        .eq("id", measureId)
        .eq("user_id", user.user_id);

      if (updateError) {
        console.error("Error moving measure to folder:", updateError);
        alert(`Error moving measure to folder: ${updateError.message}. Please try again.`);
        return;
      }

      setMeasures(prevMeasures => {
        return prevMeasures.map(m => {
          if (m.id === measureId) {
            return { ...m, folder_id: folderId };
          }
          return m;
        });
      });

      setFolders(prevFolders => {
        return prevFolders.map(folder => {
          if (oldFolderId && folder.folder_id === oldFolderId) {
            return { ...folder, measure_count: Math.max(0, (folder.measure_count || 0) - 1) };
          }
          if (folderId && folder.folder_id === folderId) {
            return { ...folder, measure_count: (folder.measure_count || 0) + 1 };
          }
          return folder;
        });
      });
      
      setShowMoveToFolderModal(false);
      setMeasureToMove(null);
    } catch (error) {
      console.error("Error in move to folder operation:", error);
      alert(`Error moving measure to folder: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const toggleFolderDropdown = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (folderDropdownOpen === folderId) {
      setFolderDropdownOpen(null);
    } else {
      const button = folderButtonRefs.current[folderId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setFolderDropdownPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right
        });
      }
      setFolderDropdownOpen(folderId);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, measureId: string) => {
    setDraggedMeasure(measureId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", measureId);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null | 'root') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderId === 'root' ? 'root' : folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const measureId = draggedMeasure || e.dataTransfer.getData("text/plain");
    if (measureId) {
      handleMoveToFolder(measureId, folderId);
    }
    setDraggedMeasure(null);
    setDragOverFolder(null);
  };

  const handleDragEnd = () => {
    setDraggedMeasure(null);
    setDragOverFolder(null);
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

      // Get all experiments for this user to check measure usage
      const { data: experiments, error: expError } = await supabase
        .from("experiments")
        .select("experiment_data")
        .eq("user_id", userId);

      const usedMeasureIds = new Set<string>();
      if (experiments) {
        experiments.forEach((exp: any) => {
          const ed = exp.experiment_data || {};
          // Top-level measures array
          if (Array.isArray(ed.measures)) {
            ed.measures.forEach((m: any) => {
              if (m?.id) usedMeasureIds.add(m.id);
            });
          }
          // Steps may each have measures
          if (Array.isArray(ed.steps)) {
            ed.steps.forEach((step: any) => {
              if (Array.isArray(step?.measures)) {
                step.measures.forEach((m: any) => {
                  if (m?.id) usedMeasureIds.add(m.id);
                });
              }
            });
          }
        });
      }

      const formattedMeasures: Measure[] = data.map((measure: any) => ({
        id: measure.id,
        title: measure.title,
        description: measure.definition,
        range: `${measure.min} - ${measure.max}`,
        desiredValues: measure.desired_values || [],
        folder_id: measure.folder_id || null,
        isLocked: usedMeasureIds.has(measure.id)
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

    // Validation is now handled in the modal with inline errors
    // Double-check here just in case
    if (isMeasureNameTaken(newMeasure.title)) {
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

      // Add the new measure to the local state (new measures are never locked)
      const measure: Measure = {
        id: data.id,
        title: data.title,
        description: data.definition,
        range: `${data.min} - ${data.max}`,
        desiredValues: data.desired_values || [],
        isLocked: false
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

    // Validation is now handled in the modal with inline errors
    // Double-check here just in case
    if (isMeasureNameTaken(updatedMeasure.title, id)) {
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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleDropdown = (measureId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row expansion when clicking dropdown
    
    if (openDropdown === measureId) {
      setOpenDropdown(null);
    } else {
      const button = buttonRefs.current[measureId] || event.currentTarget as HTMLButtonElement;
      if (button) {
        const rect = button.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right
        });
      }
      setOpenDropdown(measureId);
    }
  };

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

  const handleRenameMeasure = (measureId: string) => {
    const measure = measures.find(m => m.id === measureId);
    if (measure) {
      if (measure.isLocked) {
        setLockedMeasureId(measureId);
        setShowLockedWarning(true);
        setOpenDropdown(null);
      } else {
        setRenamingMeasure(measureId);
        setNewMeasureName(measure.title);
        setOpenDropdown(null);
      }
    }
  };

  const saveRename = async () => {
    if (!renamingMeasure || !newMeasureName.trim()) return;

    // Check for duplicate measure name (excluding current measure)
    if (isMeasureNameTaken(newMeasureName, renamingMeasure)) {
      alert(`A measure with the name "${newMeasureName.trim()}" already exists. Please choose a different name.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('measures')
        .update({ title: newMeasureName.trim() })
        .eq('id', renamingMeasure);

      if (error) {
        console.error('Error renaming measure:', error);
        alert('Failed to rename measure. Please try again.');
        return;
      }

      // Update the local state
      setMeasures(prev => prev.map(measure => 
        measure.id === renamingMeasure 
          ? { ...measure, title: newMeasureName.trim() }
          : measure
      ));

      setRenamingMeasure(null);
      setNewMeasureName('');
    } catch (error) {
      console.error('Error renaming measure:', error);
      alert('Failed to rename measure. Please try again.');
    }
  };

  const cancelRename = () => {
    setRenamingMeasure(null);
    setNewMeasureName('');
  };

  const handleEditMeasure = (id: string) => {
    const measureToEdit = measures.find(m => m.id === id);
    if (measureToEdit) {
      if (measureToEdit.isLocked) {
        setLockedMeasureId(id);
        setShowLockedWarning(true);
        setOpenDropdown(null);
      } else {
        setEditingMeasure(measureToEdit);
        setIsAddModalOpen(true);
      }
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

    // Generate a unique name for the duplicate
    let baseName = `${measureToDuplicate.title} (Copy)`;
    let duplicateTitle = baseName;
    let counter = 1;
    while (isMeasureNameTaken(duplicateTitle)) {
      counter++;
      duplicateTitle = `${measureToDuplicate.title} (Copy ${counter})`;
    }

    try {
      // Parse the range to get min and max values
      const [min, max] = measureToDuplicate.range.split(' - ').map(val => parseFloat(val.trim()));

      const { data, error } = await supabase
        .from("measures")
        .insert({
          user_id: user.user_id,
          title: duplicateTitle,
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

      // Add the duplicated measure to the local state (new copy is never locked)
      const duplicatedMeasure: Measure = {
        id: data.id,
        title: data.title,
        description: data.definition,
        range: `${data.min} - ${data.max}`,
        desiredValues: data.desired_values || [],
        folder_id: data.folder_id || null,
        isLocked: false
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

    // Get the measure name before deleting
    const measure = measures.find(m => m.id === measureToDelete);
    const measureName = measure?.title || "Measure";

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
      setDeletedItemName(measureName);
      setShowDeleteSuccess(true);
    } catch (error) {
      console.error("Error in confirmDelete:", error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setMeasureToDelete(null);
  };

  useEffect(() => {
    if (user && isAuthenticated && !hasInitiallyLoadedRef.current) {
      hasInitiallyLoadedRef.current = true;
      getUserData(user.user_id);
      // Wait for both measures and folders so table renders with items already in folders (no flash)
      Promise.all([
        getMeasures(user.user_id),
        getFolders(user.user_id)
      ]).then(() => setContentLoaded(true));
    } else if (!user || !isAuthenticated) {
      // Reset the ref when user logs out
      hasInitiallyLoadedRef.current = false;
      setMeasures([]);
      setFolders([]);
      setContentLoaded(false);
    }
  }, [user?.user_id, isAuthenticated]);

  // Close folder dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!folderDropdownOpen) return;

      const target = event.target as Node;
      
      if (folderDropdownRef.current && folderDropdownRef.current.contains(target)) {
        return;
      }

      const clickedButton = Object.values(folderButtonRefs.current).find(
        button => button && button.contains(target)
      );
      
      if (!clickedButton) {
        setFolderDropdownOpen(null);
      }
    };

    if (folderDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [folderDropdownOpen]);

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
      headerTitle=""
      userData={userData}
    >
      <SubHeader
        title="Measures"
        description="Define and track key performance indicators for your simulations"
      >
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowNewFolderModal(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </Button>
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
        </div>
      </SubHeader>

      {/* Content */}
      <div className="flex-1 p-8 bg-gray-100">
        <Card className="shadow-md">
          <CardContent>
            {loadingMeasures ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-3 text-gray-500">
                  <Spinner size="md" />
                  <span>Loading measures...</span>
                </div>
              </div>
            ) : measures.length === 0 && folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
                <FileText className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No measures yet</h3>
                <p className="text-gray-500 mb-4">Create your first measure to get started</p>
                <Button 
                  onClick={() => {
                    setEditingMeasure(null);
                    setIsAddModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Measure
                </Button>
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
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Render folders first - sorted based on sortConfig */}
                  {[...folders].sort((a, b) => {
                    if (!sortConfig) {
                      return a.folder_name.localeCompare(b.folder_name);
                    }
                    const { key, direction } = sortConfig;
                    if (key === 'name') {
                      return direction === 'asc'
                        ? a.folder_name.localeCompare(b.folder_name)
                        : b.folder_name.localeCompare(a.folder_name);
                    }
                    // For other columns, folders don't have values, so keep alphabetical
                    return a.folder_name.localeCompare(b.folder_name);
                  }).map((folder) => {
                    const folderMeasures = measures.filter(m => m.folder_id === folder.folder_id);
                    const isExpanded = expandedFolders.has(folder.folder_id);
                    
                    return (
                      <React.Fragment key={`folder-${folder.folder_id}`}>
                        {/* Folder row */}
                        <TableRow 
                          className={`group hover:bg-accent/50 transition-fast bg-gray-50 ${dragOverFolder === folder.folder_id ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDragOver(e, folder.folder_id);
                          }}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDrop(e, folder.folder_id);
                          }}
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-8 w-8"
                              onClick={() => toggleFolderExpansion(folder.folder_id)}
                            >
                              <ChevronRight 
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? 'rotate-90' : ''
                                }`}
                              />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Folder className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-foreground">{folder.folder_name}</span>
                                <span className="text-xs text-gray-500">
                                  ({folderMeasures.length} measure{folderMeasures.length !== 1 ? 's' : ''})
                                </span>
                              </div>
                              <div className="relative flex-shrink-0">
                                <Button
                                  ref={(el) => {
                                    if (el) {
                                      folderButtonRefs.current[folder.folder_id] = el;
                                    } else {
                                      delete folderButtonRefs.current[folder.folder_id];
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => toggleFolderDropdown(folder.folder_id, e)}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">—</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">—</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">—</span>
                          </TableCell>
                        </TableRow>
                        
                        {/* Measures inside the folder (when expanded) - sorted based on sortConfig */}
                        {isExpanded && [...folderMeasures].sort((a, b) => {
                          if (!sortConfig) return 0;
                          const { key, direction } = sortConfig;
                          const multiplier = direction === 'asc' ? 1 : -1;
                          
                          if (key === 'name') {
                            return multiplier * a.title.localeCompare(b.title);
                          } else if (key === 'description') {
                            return multiplier * a.description.localeCompare(b.description);
                          } else if (key === 'range') {
                            return multiplier * a.range.localeCompare(b.range);
                          }
                          return 0;
                        }).map((measure) => (
                          <React.Fragment key={measure.id}>
                            <TableRow 
                              className={`group hover:bg-accent/50 transition-fast cursor-grab ${draggedMeasure === measure.id ? 'opacity-50' : ''}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, measure.id)}
                              onDragEnd={handleDragEnd}
                            >
                              <TableCell>
                                <div className="ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 h-8 w-8"
                                    onClick={() => toggleRowExpansion(measure.id)}
                                  >
                                    <ChevronDown 
                                      className={`h-4 w-4 transition-transform ${
                                        expandedRows.has(measure.id) ? '' : '-rotate-90'
                                      }`}
                                    />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-between ml-4">
                                  {renamingMeasure === measure.id ? (
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="text"
                                        value={newMeasureName}
                                        onChange={(e) => setNewMeasureName(e.target.value)}
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
                                    <span className="font-medium text-foreground">{measure.title}</span>
                                  )}
                                  <div className="relative flex-shrink-0" ref={openDropdown === measure.id ? dropdownRef : null}>
                                    <Button
                                      ref={(el) => {
                                        if (el) {
                                          buttonRefs.current[measure.id] = el;
                                        } else {
                                          delete buttonRefs.current[measure.id];
                                        }
                                      }}
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
                              <TableCell>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      {measure.isLocked ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 cursor-help">
                                          Locked
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 cursor-help">
                                          Unlocked
                                        </span>
                                      )}
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      {measure.isLocked
                                        ? "Has been used in a simulation and cannot be edited."
                                        : "Has not been used in a simulation and can be edited."}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                            {expandedRows.has(measure.id) && (
                              <TableRow>
                                <TableCell colSpan={5} className="bg-muted/30 p-4">
                                  <div className="space-y-2" style={{marginLeft: '85px'}}>
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
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Render measures not in any folder - sorted based on sortConfig */}
                  {[...measures.filter(m => !m.folder_id)].sort((a, b) => {
                    if (!sortConfig) return 0;
                    const { key, direction } = sortConfig;
                    const multiplier = direction === 'asc' ? 1 : -1;
                    
                    if (key === 'name') {
                      return multiplier * a.title.localeCompare(b.title);
                    } else if (key === 'description') {
                      return multiplier * a.description.localeCompare(b.description);
                    } else if (key === 'range') {
                      return multiplier * a.range.localeCompare(b.range);
                    }
                    return 0;
                  }).map((measure) => (
                  <React.Fragment key={measure.id}>
                    <TableRow 
                      className={`group hover:bg-accent/50 transition-fast cursor-grab ${draggedMeasure === measure.id ? 'opacity-50' : ''}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, measure.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-8 w-8"
                          onClick={() => toggleRowExpansion(measure.id)}
                        >
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedRows.has(measure.id) ? '' : '-rotate-90'
                            }`}
                          />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between">
                          {renamingMeasure === measure.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={newMeasureName}
                                onChange={(e) => setNewMeasureName(e.target.value)}
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
                            <span className="font-medium text-foreground">{measure.title}</span>
                          )}
                          <div className="relative flex-shrink-0" ref={openDropdown === measure.id ? dropdownRef : null}>
                            <Button
                              ref={(el) => {
                                if (el) {
                                  buttonRefs.current[measure.id] = el;
                                } else {
                                  delete buttonRefs.current[measure.id];
                                }
                              }}
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
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {measure.isLocked ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 cursor-help">
                                  Locked
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 cursor-help">
                                  Unlocked
                                </span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              {measure.isLocked
                                ? "Has been used in a simulation and cannot be edited."
                                : "Has not been used in a simulation and can be edited."}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(measure.id) && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
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
        checkNameExists={isMeasureNameTaken}
      />

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
          {/* 1. Rename */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRenameMeasure(openDropdown);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Edit2 className="w-4 h-4 mr-3" />
            Rename
          </button>
          {/* 2. Copy & Edit */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDuplicateMeasure(openDropdown);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Copy className="w-4 h-4 mr-3" />
            Copy & Edit
          </button>
          {/* 4. Move to Folder */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMeasureToMove(openDropdown);
              setShowMoveToFolderModal(true);
              setOpenDropdown(null);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FolderInput className="w-4 h-4 mr-3" />
            Move to folder
          </button>
          <hr className="my-1 border-gray-100" />
          {/* 5. Delete */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteMeasure(openDropdown);
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

      {/* Locked Measure Warning Modal */}
      {showLockedWarning && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Measure is Locked</h3>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Measures may be edited up until the first time they are used in a simulation. You may &quot;Make a copy&quot; of the measure to edit at any point.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowLockedWarning(false);
                  setLockedMeasureId(null);
                }}
                variant="outline"
                className="px-4 py-2"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (lockedMeasureId) {
                    handleDuplicateMeasure(lockedMeasureId);
                  }
                  setShowLockedWarning(false);
                  setLockedMeasureId(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Make a copy
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

      {/* Folder Dropdown Portal */}
      {folderDropdownOpen && createPortal(
        <div 
          ref={folderDropdownRef}
          className="fixed w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-[99999]"
          style={{
            top: folderDropdownPosition.top,
            right: folderDropdownPosition.right
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const folder = folders.find(f => f.folder_id === folderDropdownOpen);
              if (folder) {
                handleRenameFolder(folderDropdownOpen, folder.folder_name);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
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
              handleDeleteFolder(folderDropdownOpen);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-3" />
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Folder</h3>
            <div className="mb-6">
              <label htmlFor="folder-name" className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name
              </label>
              <input
                id="folder-name"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  } else if (e.key === 'Escape') {
                    setShowNewFolderModal(false);
                    setNewFolderName("");
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName("");
                }}
                variant="outline"
                className="px-4 py-2"
                disabled={isCreatingFolder}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                disabled={!newFolderName.trim() || isCreatingFolder}
              >
                {isCreatingFolder ? (
                  <>
                    <Spinner size="sm" />
                    <span>Creating...</span>
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move to Folder Modal */}
      {showMoveToFolderModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Move to Folder</h3>
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">Select a folder to move this measure to:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Option to remove from folder */}
                {measures.find(m => m.id === measureToMove)?.folder_id && (
                  <>
                    <button
                      onClick={() => {
                        if (measureToMove) {
                          handleMoveToFolder(measureToMove, null);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Remove from folder</span>
                    </button>
                    <hr className="my-2 border-gray-100" />
                  </>
                )}
                {folders.map((folder) => (
                  <button
                    key={folder.folder_id}
                    onClick={() => {
                      if (measureToMove) {
                        handleMoveToFolder(measureToMove, folder.folder_id);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <Folder className="w-4 h-4 text-blue-600" />
                    <span>{folder.folder_name}</span>
                    {folder.measure_count !== undefined && (
                      <span className="ml-auto text-xs text-gray-500">
                        ({folder.measure_count} {folder.measure_count === 1 ? 'measure' : 'measures'})
                      </span>
                    )}
                  </button>
                ))}
                {folders.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No folders yet. Create a folder first.</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowMoveToFolderModal(false);
                  setMeasureToMove(null);
                }}
                variant="outline"
                className="px-4 py-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rename Folder Modal */}
      {showRenameFolderModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename Folder</h3>
            <div className="mb-6">
              <label htmlFor="new-folder-name" className="block text-sm font-medium text-gray-700 mb-2">
                New Name
              </label>
              <input
                id="new-folder-name"
                type="text"
                value={newFolderRename}
                onChange={(e) => setNewFolderRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRenameFolder();
                  } else if (e.key === 'Escape') {
                    handleCancelRenameFolder();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleCancelRenameFolder}
                variant="outline"
                className="px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveRenameFolder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!newFolderRename.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Folder Confirmation Modal */}
      {showDeleteFolderConfirm && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Folder</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the folder <strong className="font-semibold">"{folderToDelete?.name}"</strong>? <strong className="text-red-600">All measures inside this folder will be permanently deleted.</strong> This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={cancelDeleteFolder}
                variant="outline"
                className="px-4 py-2"
                disabled={isDeletingFolder}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteFolder}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                disabled={isDeletingFolder}
              >
                {isDeletingFolder ? (
                  <>
                    <Spinner size="sm" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete Folder"
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fixed drop zone portal for removing from folders */}
      {draggedMeasure && measures.find(m => m.id === draggedMeasure)?.folder_id && createPortal(
        <div
          className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50 ${dragOverFolder === 'root' ? 'bg-blue-50' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'root')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className={`flex items-center justify-center gap-2 text-sm border-2 border-dashed rounded-lg py-4 max-w-4xl mx-auto ${dragOverFolder === 'root' ? 'border-blue-400 text-blue-600 bg-blue-100' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
            <FileText className="w-4 h-4" />
            <span>Drop here to remove from folder</span>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Success Popup */}
      {showDeleteSuccess && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Success</h3>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              "{deletedItemName}" has been deleted successfully!
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowDeleteSuccess(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                OK
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppLayout>
  );
}