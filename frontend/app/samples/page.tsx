"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus, Users, MoreVertical, Trash2, Edit, Edit2, Copy, Lock, Folder, FolderPlus, FolderInput, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import NewSampleModal from "../components/NewSampleModal";
import Spinner from "../components/ui/spinner";
import SortableTableHeader from "../components/ui/SortableTableHeader";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface Folder {
  folder_id: string;
  folder_name: string;
  created_at: string;
  sample_count?: number;
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
  isLocked?: boolean; // Whether the sample has been used in an experiment
  folder_id?: string | null; // Folder ID if sample is in a folder
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

  const [showLockedWarning, setShowLockedWarning] = useState(false);
  const [lockedSampleId, setLockedSampleId] = useState<string | null>(null);

  // Folder state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [sampleToMove, setSampleToMove] = useState<string | null>(null);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null);
  const [newFolderRename, setNewFolderRename] = useState("");
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedItemName, setDeletedItemName] = useState<string>("");
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Helper function to show error popup
  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorPopup(true);
  };
  const [folderDropdownOpen, setFolderDropdownOpen] = useState<string | null>(null);
  const [folderDropdownPosition, setFolderDropdownPosition] = useState({ top: 0, right: 0 });
  const folderButtonRefs = useRef<Record<string, HTMLButtonElement>>({});
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  
  // Drag and drop state
  const [draggedSample, setDraggedSample] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null | 'root'>(null);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  // Table sort: 'name' | 'date' | 'attributes', direction asc/desc
  type SortColumn = 'name' | 'date' | 'attributes';
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedSamples = useMemo(() => {
    if (!sortColumn) return samples;
    const sorted = [...samples].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      } else if (sortColumn === 'date') {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        cmp = da - db;
      } else if (sortColumn === 'attributes') {
        const na = Array.isArray(a.attributes) ? a.attributes.length : 0;
        const nb = Array.isArray(b.attributes) ? b.attributes.length : 0;
        cmp = na - nb;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [samples, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => (
    <TableHead>
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 font-medium hover:text-blue-600 transition-colors text-left w-full"
      >
        {children}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        ) : (
          <span className="w-4 h-4 inline-block opacity-30">
            <ChevronDown className="w-4 h-4" />
          </span>
        )}
      </button>
    </TableHead>
  );

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
        .eq("folder_type", "samples")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching folders:", error);
        setFolders([]);
        return;
      }

      // Count samples in each folder
      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          const { count, error: countError } = await supabase
            .from("samples")
            .select("*", { count: "exact", head: true })
            .eq("folder_id", folder.folder_id)
            .eq("user_id", userId);
          
          if (countError) {
            console.error("Error counting samples in folder:", countError);
          }
          
          return {
            ...folder,
            sample_count: count || 0
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

  // Check if a sample name already exists (case-insensitive)
  const isSampleNameTaken = (name: string, excludeSampleId?: string): boolean => {
    const normalizedName = name.trim().toLowerCase();
    return samples.some(sample => 
      sample.name.toLowerCase() === normalizedName && 
      sample.id !== excludeSampleId
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user || isCreatingFolder) {
      return;
    }

    // Check for duplicate folder name
    if (isFolderNameTaken(newFolderName)) {
      showError(`A folder with the name "${newFolderName.trim()}" already exists. Please choose a different name.`);
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
          folder_type: "samples"
        });

      if (error) {
        console.error("Error creating folder:", error);
        showError("Error creating folder. Please try again.");
        return;
      }

      // Refresh folders list
      await getFolders(user.user_id);
      
      // Close modal and reset
      setShowNewFolderModal(false);
      setNewFolderName("");
    } catch (error) {
      console.error("Error in folder creation:", error);
      showError("Error creating folder. Please try again.");
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
      showError(`A folder with the name "${newFolderRename.trim()}" already exists. Please choose a different name.`);
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
        showError("Error renaming folder. Please try again.");
        return;
      }

      // Refresh folders after successful update
      await getFolders(user.user_id);
      
      // Close modal
      setShowRenameFolderModal(false);
      setFolderToRename(null);
      setNewFolderRename("");
    } catch (error) {
      console.error("Error in folder rename operation:", error);
      showError("Error renaming folder. Please try again.");
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
      // First, delete all samples in the folder
      const { data: folderSamples, error: fetchError } = await supabase
        .from("samples")
        .select("id")
        .eq("folder_id", folderToDelete.id)
        .eq("user_id", user.user_id);

      if (fetchError) {
        console.error("Error fetching samples in folder:", fetchError);
        showError("Error fetching samples in folder. Please try again.");
        setIsDeletingFolder(false);
        return;
      }

      // Delete all samples in the folder
      const sampleIds = folderSamples ? folderSamples.map(s => s.id) : [];
      if (sampleIds.length > 0) {
        const { error: deleteSamplesError } = await supabase
          .from("samples")
          .delete()
          .in("id", sampleIds)
          .eq("user_id", user.user_id);

        if (deleteSamplesError) {
          console.error("Error deleting samples in folder:", deleteSamplesError);
          showError("Error deleting samples in folder. Please try again.");
          setIsDeletingFolder(false);
          return;
        }
      }

      // Then delete the folder itself
      const { error: deleteFolderError } = await supabase
        .from("folders")
        .delete()
        .eq("folder_id", folderToDelete.id)
        .eq("user_id", user.user_id);

      if (deleteFolderError) {
        console.error("Error deleting folder:", deleteFolderError);
        showError("Error deleting folder. Please try again.");
        setIsDeletingFolder(false);
        return;
      }

      // Update local state instead of refetching to avoid table flash
      // Remove samples that were in the deleted folder
      setSamples(prevSamples => 
        prevSamples.filter(s => s.folder_id !== folderToDelete.id)
      );
      
      // Remove the folder from folders state
      setFolders(prevFolders => 
        prevFolders.filter(f => f.folder_id !== folderToDelete.id)
      );
      
      // Close modal
      setShowDeleteFolderConfirm(false);
      setFolderToDelete(null);
    } catch (error) {
      console.error("Error in folder delete operation:", error);
      showError(`Error deleting folder: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const cancelDeleteFolder = () => {
    setShowDeleteFolderConfirm(false);
    setFolderToDelete(null);
  };

  const handleMoveToFolder = async (sampleId: string, folderId: string | null) => {
    if (!user) {
      return;
    }

    try {
      const sample = samples.find(s => s.id === sampleId);
      if (!sample) {
        console.error("Sample not found");
        showError("Error: Sample not found. Please try again.");
        return;
      }

      const oldFolderId = sample.folder_id || null;
      const updateData: { folder_id: string | null } = { folder_id: folderId };
      
      const { error: updateError } = await supabase
        .from("samples")
        .update(updateData)
        .eq("id", sampleId)
        .eq("user_id", user.user_id);

      if (updateError) {
        console.error("Error moving sample to folder:", updateError);
        showError(`Error moving sample to folder: ${updateError.message}. Please try again.`);
        return;
      }

      // Update local state
      setSamples(prevSamples => {
        return prevSamples.map(s => {
          if (s.id === sampleId) {
            return {
              ...s,
              folder_id: folderId
            };
          }
          return s;
        });
      });

      // Update folder counts locally
      setFolders(prevFolders => {
        return prevFolders.map(folder => {
          if (oldFolderId && folder.folder_id === oldFolderId) {
            return {
              ...folder,
              sample_count: Math.max(0, (folder.sample_count || 0) - 1)
            };
          }
          if (folderId && folder.folder_id === folderId) {
            return {
              ...folder,
              sample_count: (folder.sample_count || 0) + 1
            };
          }
          return folder;
        });
      });
      
      setShowMoveToFolderModal(false);
      setSampleToMove(null);
    } catch (error) {
      console.error("Error in move to folder operation:", error);
      showError(`Error moving sample to folder: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
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
  const handleDragStart = (e: React.DragEvent, sampleId: string) => {
    setDraggedSample(sampleId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sampleId);
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
    const sampleId = draggedSample || e.dataTransfer.getData("text/plain");
    if (sampleId) {
      handleMoveToFolder(sampleId, folderId);
    }
    setDraggedSample(null);
    setDragOverFolder(null);
  };

  const handleDragEnd = () => {
    setDraggedSample(null);
    setDragOverFolder(null);
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

      // Get all experiments for this user to check sample usage more efficiently
      const { data: experiments, error: expError } = await supabase
        .from("experiments")
        .select("experiment_data")
        .eq("user_id", userId);

      // Create a set of used sample IDs
      const usedSampleIds = new Set<string>();
      if (experiments) {
        experiments.forEach((exp: any) => {
          if (exp.experiment_data?.sample?.id) {
            usedSampleIds.add(exp.experiment_data.sample.id);
          }
        });
      }

      // Transform Supabase data to match our interface and check if samples are locked
      return data.map((sample: any) => ({
        ...sample,
        expanded: false,
        isLocked: usedSampleIds.has(sample.id),
        folder_id: sample.folder_id || null,
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
      // Wait for both samples and folders so table renders with items already in folders (no flash)
      Promise.all([
        loadSamples(user.user_id),
        getFolders(user.user_id)
      ]).then(() => setContentLoaded(true));
    } else if (!user || !isAuthenticated) {
      // Reset the ref when user logs out
      hasInitiallyLoadedRef.current = false;
      setSamples([]);
      setFolders([]);
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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDeleteSample = async (sampleId: string) => {
    // Get the sample name before deleting
    const sample = samples.find(s => s.id === sampleId);
    const sampleName = sample?.name || "Sample";
    
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
        showError('Failed to delete sample. Please try again.');
        return;
      }

      // Remove the sample from the local state
      setSamples(prev => prev.filter(sample => sample.id !== sampleId));
      setOpenDropdown(null); // Close the dropdown
      setDeletedItemName(sampleName);
      setShowDeleteSuccess(true);
    } catch (error) {
      console.error('Error deleting sample:', error);
      showError('Failed to delete sample. Please try again.');
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
      if (sample.isLocked) {
        setLockedSampleId(sampleId);
        setShowLockedWarning(true);
        setOpenDropdown(null);
      } else {
        setEditingSample(sample);
        setIsEditModalOpen(true);
        setOpenDropdown(null);
      }
    }
  };

  const handleDuplicateSample = async (sampleId: string) => {
    const sample = samples.find(s => s.id === sampleId);
    if (!sample || !user) return;

    // Generate a unique name for the duplicate
    let baseName = `${sample.name} (Copy)`;
    let duplicateName = baseName;
    let counter = 1;
    while (isSampleNameTaken(duplicateName)) {
      counter++;
      duplicateName = `${sample.name} (Copy ${counter})`;
    }

    try {
      const duplicateData = {
        name: duplicateName,
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
      showError('Failed to duplicate sample. Please try again.');
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
        showError('Failed to update sample. Please try again.');
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
      showError('Failed to update sample. Please try again.');
    }
  };

  const saveRename = async () => {
    if (!renamingSample || !newSampleName.trim()) return;

    // Check for duplicate sample name (excluding current sample)
    if (isSampleNameTaken(newSampleName, renamingSample)) {
      showError(`A sample with the name "${newSampleName.trim()}" already exists. Please choose a different name.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('samples')
        .update({ name: newSampleName.trim() })
        .eq('id', renamingSample);

      if (error) {
        console.error('Error renaming sample:', error);
        showError('Failed to rename sample. Please try again.');
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
      showError('Failed to rename sample. Please try again.');
    }
  };

  const cancelRename = () => {
    setRenamingSample(null);
    setNewSampleName('');
  };

  const handleNewSample = async (sampleName: string, selectedAttributes: Attribute[], attributeSelections: AttributeSelection[]) => {
    if (!user) return;

    // Generate sample name if not provided
    const finalSampleName = sampleName || `Sample ${samples.length + 1}`;

    // Validation is now handled in the modal with inline errors
    // Double-check here just in case
    if (isSampleNameTaken(finalSampleName)) {
      return;
    }

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
        name: finalSampleName,
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

  const handleUpdateSample = async (sampleName: string, selectedAttributes: Attribute[], attributeSelections: AttributeSelection[]) => {
    if (!user || !editingSample) return;

    // Validation is now handled in the modal with inline errors
    // Double-check here just in case
    const finalSampleName = sampleName || editingSample.name;
    if (isSampleNameTaken(finalSampleName, editingSample.id)) {
      return;
    }

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
        .update({ 
          name: sampleName || editingSample.name,
          attributes: attributesJson 
        })
        .eq('id', editingSample.id);

      if (error) {
        console.error('Error updating sample:', error);
        showError('Failed to update sample. Please try again.');
        return;
      }

      // Update local state
      setSamples(prev => prev.map(sample => 
        sample.id === editingSample.id 
          ? { 
              ...sample, 
              name: sampleName || editingSample.name,
              attributes: attributesJson,
              attributeCategories: extractAttributeCategories(attributesJson)
            }
          : sample
      ));

      setIsEditModalOpen(false);
      setEditingSample(null);
    } catch (error) {
      console.error("Error updating sample:", error);
      showError('Failed to update sample. Please try again.');
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
      headerTitle=""
      userData={userData}
    >
      <SubHeader
        title="Samples"
        description="View and manage your simulated samples."
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
            onClick={() => setIsNewSampleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Sample
          </Button>
        </div>
      </SubHeader>

      {/* Content */}
      <div className="flex-1 p-8 bg-gray-100">
        <Card className="shadow-md">
          <CardContent>
            {isLoadingSamples ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-3 text-gray-500">
                  <Spinner size="md" />
                  <span>Loading samples...</span>
                </div>
              </div>
            ) : samples.length === 0 && folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
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
            ) : (
              <div className={`transition-opacity duration-500 ${contentLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <SortableTableHeader label="Name" sortKey="name" onSort={handleSort} currentSort={sortConfig} />
                      <SortableTableHeader label="Created Date" sortKey="created_date" onSort={handleSort} currentSort={sortConfig} />
                      <SortableTableHeader label="Attributes" sortKey="attributes" onSort={handleSort} currentSort={sortConfig} />
                      <SortableTableHeader label="Status" sortKey="status" onSort={handleSort} currentSort={sortConfig} />
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
                      const folderSamples = samples.filter(s => s.folder_id === folder.folder_id);
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
                                    ({folderSamples.length} sample{folderSamples.length !== 1 ? 's' : ''})
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
                              <span className="text-sm">{new Date(folder.created_at).toLocaleDateString()}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-500">—</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-500">—</span>
                            </TableCell>
                          </TableRow>
                          
                          {/* Samples inside the folder (when expanded) - sorted based on sortConfig */}
                          {isExpanded && [...folderSamples].sort((a, b) => {
                            if (!sortConfig) return 0;
                            const { key, direction } = sortConfig;
                            const multiplier = direction === 'asc' ? 1 : -1;
                            
                            if (key === 'name') {
                              return multiplier * a.name.localeCompare(b.name);
                            } else if (key === 'created_date') {
                              const dateA = new Date(a.created_at).getTime();
                              const dateB = new Date(b.created_at).getTime();
                              return multiplier * (dateA - dateB);
                            } else if (key === 'attributes') {
                              const countA = Array.isArray(a.attributes) ? a.attributes.length : 0;
                              const countB = Array.isArray(b.attributes) ? b.attributes.length : 0;
                              return multiplier * (countA - countB);
                            } else if (key === 'status') {
                              const statusA = a.isLocked ? 'Locked' : 'Unlocked';
                              const statusB = b.isLocked ? 'Locked' : 'Unlocked';
                              return multiplier * statusA.localeCompare(statusB);
                            }
                            return 0;
                          }).map((sample) => (
                            <React.Fragment key={sample.id}>
                              <TableRow 
                                className={`group hover:bg-accent/50 transition-fast cursor-grab ${draggedSample === sample.id ? 'opacity-50' : ''}`}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, sample.id)}
                                onDragEnd={handleDragEnd}
                              >
                                <TableCell>
                                  <div className="ml-4">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="p-1 h-8 w-8"
                                      onClick={() => toggleSampleExpansion(sample.id)}
                                    >
                                      <ChevronDown 
                                        className={`h-4 w-4 transition-transform ${
                                          sample.expanded ? '' : '-rotate-90'
                                        }`}
                                      />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-between ml-4">
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
                                      <span className="font-medium text-foreground">{sample.name}</span>
                                    )}
                                    <div className="relative flex-shrink-0" ref={openDropdown === sample.id ? dropdownRef : null}>
                                      <Button
                                        ref={(el) => {
                                          if (el) {
                                            buttonRefs.current[sample.id] = el;
                                          } else {
                                            delete buttonRefs.current[sample.id];
                                          }
                                        }}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => toggleDropdown(sample.id, e)}
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">{new Date(sample.created_at).toLocaleDateString()}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">{Array.isArray(sample.attributes) ? sample.attributes.length : 0} attribute{Array.isArray(sample.attributes) && sample.attributes.length !== 1 ? 's' : ''}</span>
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        {sample.isLocked ? (
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
                                        {sample.isLocked
                                          ? "Has been used in a simulation and cannot be edited."
                                          : "Has not been used in a simulation and can be edited."}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                              </TableRow>
                              {sample.expanded && (
                                <TableRow>
                                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                                    <div className="space-y-2" style={{marginLeft: '85px'}}>
                                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Selected Attributes:</h4>
                                      <div className="grid grid-cols-3 gap-4">
                                        {Array.isArray(sample.attributes) && sample.attributes.map((attribute: any, attributeIndex: number) => (
                                          <div key={attributeIndex} className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                                            <div className="flex items-start justify-between mb-3">
                                              <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 mb-1">{attribute.category}</div>
                                                <div className="text-base font-semibold text-blue-600 truncate">{attribute.label}</div>
                                              </div>
                                            </div>
                                            
                                            {attribute.values && attribute.values.length > 0 && (
                                              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                                {attribute.values.map((value: string, valueIndex: number) => (
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
                                              </div>
                                            )}
                                            
                                            {(!attribute.values || attribute.values.length === 0) && (
                                              <div className="flex items-center space-x-2 text-sm text-gray-900">
                                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                </div>
                                                <span>Selected</span>
                                              </div>
                                            )}
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
                    
                    {/* Render samples not in any folder - sorted based on sortConfig */}
                    {[...samples.filter(s => !s.folder_id)].sort((a, b) => {
                      if (!sortConfig) return 0;
                      const { key, direction } = sortConfig;
                      const multiplier = direction === 'asc' ? 1 : -1;
                      
                      if (key === 'name') {
                        return multiplier * a.name.localeCompare(b.name);
                      } else if (key === 'created_date') {
                        const dateA = new Date(a.created_at).getTime();
                        const dateB = new Date(b.created_at).getTime();
                        return multiplier * (dateA - dateB);
                      } else if (key === 'attributes') {
                        const countA = Array.isArray(a.attributes) ? a.attributes.length : 0;
                        const countB = Array.isArray(b.attributes) ? b.attributes.length : 0;
                        return multiplier * (countA - countB);
                      } else if (key === 'status') {
                        const statusA = a.isLocked ? 'Locked' : 'Unlocked';
                        const statusB = b.isLocked ? 'Locked' : 'Unlocked';
                        return multiplier * statusA.localeCompare(statusB);
                      }
                      return 0;
                    }).map((sample) => (
                      <React.Fragment key={sample.id}>
                        <TableRow 
                          className={`group hover:bg-accent/50 transition-fast cursor-grab ${draggedSample === sample.id ? 'opacity-50' : ''}`}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, sample.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-8 w-8"
                              onClick={() => toggleSampleExpansion(sample.id)}
                            >
                              <ChevronDown 
                                className={`h-4 w-4 transition-transform ${
                                  sample.expanded ? '' : '-rotate-90'
                                }`}
                              />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-between">
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
                                <span className="font-medium text-foreground">{sample.name}</span>
                              )}
                              <div className="relative flex-shrink-0" ref={openDropdown === sample.id ? dropdownRef : null}>
                                <Button
                                  ref={(el) => {
                                    if (el) {
                                      buttonRefs.current[sample.id] = el;
                                    } else {
                                      delete buttonRefs.current[sample.id];
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => toggleDropdown(sample.id, e)}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{new Date(sample.created_at).toLocaleDateString()}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{Array.isArray(sample.attributes) ? sample.attributes.length : 0} attribute{Array.isArray(sample.attributes) && sample.attributes.length !== 1 ? 's' : ''}</span>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {sample.isLocked ? (
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
                                  {sample.isLocked
                                    ? "Has been used in a simulation and cannot be edited."
                                    : "Has not been used in a simulation and can be edited."}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                        {sample.expanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/30 p-4">
                              <div className="space-y-2" style={{marginLeft: '65px'}}>
                                <h4 className="font-medium text-sm text-muted-foreground mb-3">Selected Attributes:</h4>
                                <div className="grid grid-cols-3 gap-4">
                                  {Array.isArray(sample.attributes) && sample.attributes.map((attribute: any, attributeIndex: number) => (
                                    <div key={attributeIndex} className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-gray-900 mb-1">{attribute.category}</div>
                                          <div className="text-base font-semibold text-blue-600 truncate">{attribute.label}</div>
                                        </div>
                                      </div>
                                      
                                      {attribute.values && attribute.values.length > 0 && (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                          {attribute.values.map((value: string, valueIndex: number) => (
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
                                        </div>
                                      )}
                                      
                                      {(!attribute.values || attribute.values.length === 0) && (
                                        <div className="flex items-center space-x-2 text-sm text-gray-900">
                                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                          <span>Selected</span>
                                        </div>
                                      )}
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

      {/* Fixed drop zone portal for removing from folders - shows when dragging a sample that's in a folder */}
      {draggedSample && samples.find(s => s.id === draggedSample)?.folder_id && createPortal(
        <div
          className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50 ${dragOverFolder === 'root' ? 'bg-blue-50' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'root')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className={`flex items-center justify-center gap-2 text-sm border-2 border-dashed rounded-lg py-4 max-w-4xl mx-auto ${dragOverFolder === 'root' ? 'border-blue-400 text-blue-600 bg-blue-100' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
            <Users className="w-4 h-4" />
            <span>Drop here to remove from folder</span>
          </div>
        </div>,
        document.body
      )}

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
          {/* 2. Copy & Edit */}
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
            Copy & Edit
          </button>
          {/* 4. Move to Folder */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSampleToMove(openDropdown);
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
        checkNameExists={isSampleNameTaken}
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
          checkNameExists={isSampleNameTaken}
        />
      )}

      {/* Locked Sample Warning Modal */}
      {showLockedWarning && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Sample is Locked</h3>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Samples may be edited up until the first time they are used. You may "Copy & Edit" the sample to edit at any point.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowLockedWarning(false);
                  setLockedSampleId(null);
                }}
                variant="outline"
                className="px-4 py-2"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (lockedSampleId) {
                    handleDuplicateSample(lockedSampleId);
                  }
                  setShowLockedWarning(false);
                  setLockedSampleId(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Copy & Edit
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
              <p className="text-sm text-gray-600 mb-4">Select a folder to move this sample to:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Option to remove from folder */}
                {samples.find(s => s.id === sampleToMove)?.folder_id && (
                  <>
                    <button
                      onClick={() => {
                        if (sampleToMove) {
                          handleMoveToFolder(sampleToMove, null);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                    >
                      <Users className="w-4 h-4" />
                      <span>Remove from folder</span>
                    </button>
                    <hr className="my-2 border-gray-100" />
                  </>
                )}
                {folders.map((folder) => (
                  <button
                    key={folder.folder_id}
                    onClick={() => {
                      if (sampleToMove) {
                        handleMoveToFolder(sampleToMove, folder.folder_id);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <Folder className="w-4 h-4 text-blue-600" />
                    <span>{folder.folder_name}</span>
                    {folder.sample_count !== undefined && (
                      <span className="ml-auto text-xs text-gray-500">
                        ({folder.sample_count} {folder.sample_count === 1 ? 'sample' : 'samples'})
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
                  setSampleToMove(null);
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
              Are you sure you want to delete the folder <strong className="font-semibold">"{folderToDelete?.name}"</strong>? <strong className="text-red-600">All samples inside this folder will be permanently deleted.</strong> This action cannot be undone.
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

      {/* Error Popup */}
      {showErrorPopup && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Error</h3>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowErrorPopup(false)}
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