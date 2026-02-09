"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Folder } from "lucide-react";
import StatusBadge from "./ui/StatusBadge";
import DownloadButton from "./ui/DownloadButton";
import ProjectDropdown from "./ui/ProjectDropdown";
import FolderDropdown from "@/app/components/ui/FolderDropdown";
import SortableTableHeader from "./ui/SortableTableHeader";
import SimulationSteps from "./ui/SimulationSteps";

interface Download {
  date: string;
  id: number;
  url?: string;
  filename?: string;
  created_at?: string;
}

interface SimulationStep {
  label: string;
  instructions: string;
  temperature: number;
  measures?: Array<{ id: string; title: string; description: string; range: string }>;
}

interface Folder {
  folder_id: string;
  folder_name: string;
  created_at: string;
  project_count?: number;
}

interface Project {
  name: string;
  sample_name: string;
  sample_size?: number; // Sample size for the simulation
  status: string;
  progress?: number; // Progress percentage for running simulations
  downloads: Download[];
  steps: SimulationStep[];
  id?: string;
  experiment_id?: string; // Backend experiment ID for polling
  folder_id?: string | null;
}

interface ProjectsTableProps {
  projects: Project[];
  folders?: Folder[];
  onDownload: (url: string, filename: string) => void;
  onRename: (projectId: string, currentName: string) => void;
  onModify?: (projectId: string) => Promise<boolean>;
  onDelete?: (projectId: string) => Promise<boolean>;
  onReplicate?: (projectId: string) => Promise<boolean>;
  onMoveToFolder?: (projectId: string) => void;
  onDropToFolder?: (projectId: string, folderId: string | null) => void;
  onRenameFolder?: (folderId: string, currentName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  /** In-place rename: which project row is being renamed (experiment_id) */
  renamingProjectId?: string | null;
  /** In-place rename: current input value */
  renameValue?: string;
  onRenameValueChange?: (value: string) => void;
  onSaveRename?: () => void;
  onCancelRename?: () => void;
}

export default function ProjectsTable({ 
  projects, 
  folders = [],
  onDownload, 
  onRename, 
  onModify, 
  onDelete, 
  onReplicate,
  onMoveToFolder,
  onDropToFolder,
  onRenameFolder,
  onDeleteFolder,
  renamingProjectId = null,
  renameValue = "",
  onRenameValueChange,
  onSaveRename,
  onCancelRename
}: ProjectsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [projectDropdowns, setProjectDropdowns] = useState<Set<string>>(new Set());
  const [folderDropdowns, setFolderDropdowns] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [sortedProjects, setSortedProjects] = useState(projects);
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null | 'root'>(null);

  // Update sortedProjects when projects prop changes or sortConfig changes
  React.useEffect(() => {
    if (!sortConfig) {
      setSortedProjects(projects);
      return;
    }

    const sorted = [...projects].sort((a, b) => {
      const { key, direction } = sortConfig;
      
      if (key === 'name') {
        return direction === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
      
      if (key === 'sample_name') {
        return direction === 'asc' 
          ? a.sample_name.localeCompare(b.sample_name) 
          : b.sample_name.localeCompare(a.sample_name);
      }
      
      if (key === 'status') {
        return direction === 'asc' 
          ? a.status.localeCompare(b.status) 
          : b.status.localeCompare(a.status);
      }
      
      if (key === 'download_date') {
        // Sort by the most recent download date
        // Projects with no downloads go to the end
        const aHasDownloads = a.downloads.length > 0;
        const bHasDownloads = b.downloads.length > 0;
        
        // If one has downloads and the other doesn't, prioritize the one with downloads
        if (aHasDownloads && !bHasDownloads) return -1;
        if (!aHasDownloads && bHasDownloads) return 1;
        if (!aHasDownloads && !bHasDownloads) return 0;
        
        // Both have downloads, sort by date
        const aDate = new Date(a.downloads[0].created_at || a.downloads[0].date).getTime();
        const bDate = new Date(b.downloads[0].created_at || b.downloads[0].date).getTime();
        
        return direction === 'asc' 
          ? aDate - bDate 
          : bDate - aDate;
      }
      
      return 0;
    });
    
    setSortedProjects(sorted);
  }, [projects, sortConfig]);

  const toggleRowExpansion = (projectId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(projectId)) {
      newExpandedRows.delete(projectId);
    } else {
      newExpandedRows.add(projectId);
    }
    setExpandedRows(newExpandedRows);
  };

  const toggleProjectDropdown = (projectId: string) => {
    const newProjectDropdowns = new Set(projectDropdowns);
    if (projectDropdowns.has(projectId)) {
      newProjectDropdowns.delete(projectId);
    } else {
      newProjectDropdowns.add(projectId);
    }
    setProjectDropdowns(newProjectDropdowns);
  };

  const toggleFolderDropdown = (folderId: string) => {
    const newFolderDropdowns = new Set(folderDropdowns);
    if (folderDropdowns.has(folderId)) {
      newFolderDropdowns.delete(folderId);
    } else {
      newFolderDropdowns.add(folderId);
    }
    setFolderDropdowns(newFolderDropdowns);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    // The actual sorting is handled in the useEffect above
  };

  const toggleFolderExpansion = (folderId: string) => {
    const newExpandedFolders = new Set(expandedFolders);
    if (expandedFolders.has(folderId)) {
      newExpandedFolders.delete(folderId);
    } else {
      newExpandedFolders.add(folderId);
    }
    setExpandedFolders(newExpandedFolders);
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProject(projectId);
    e.dataTransfer.effectAllowed = "move";
    // Store the project ID in dataTransfer for better compatibility
    e.dataTransfer.setData("text/plain", projectId);
    // Allow dragging from anywhere
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
    // Get project ID from either draggedProject state or dataTransfer
    const projectId = draggedProject || e.dataTransfer.getData("text/plain");
    if (projectId && onDropToFolder) {
      onDropToFolder(projectId, folderId);
    }
    setDraggedProject(null);
    setDragOverFolder(null);
  };

  const handleDragEnd = () => {
    setDraggedProject(null);
    setDragOverFolder(null);
  };

  // Group sorted projects by folder
  const projectsByFolder = new Map<string | null, Project[]>();
  sortedProjects.forEach(project => {
    // Handle both undefined and null folder_id - treat both as root (null)
    const folderId = (project.folder_id === undefined || project.folder_id === null) ? null : project.folder_id;
    if (!projectsByFolder.has(folderId)) {
      projectsByFolder.set(folderId, []);
    }
    projectsByFolder.get(folderId)!.push(project);
  });

  // Get folder name by ID
  const getFolderName = (folderId: string | null): string => {
    if (!folderId) return "Root";
    const folder = folders.find(f => f.folder_id === folderId);
    return folder ? folder.folder_name : "Unknown Folder";
  };

  const renderProjectRow = (project: Project, index: number, isInFolder: boolean = false, totalInGroup: number = 0) => {
    const projectIndex = sortedProjects.findIndex(p => p.id === project.id);
    // Use experiment_id if available, otherwise fall back to id
    const projectId = project.experiment_id || project.id;
    return (
      <React.Fragment key={project.id || index}>
        <tr 
          className={`${isInFolder ? 'bg-gray-50 hover:bg-gray-100' : 'hover:bg-gray-50'} ${draggedProject === projectId ? 'opacity-50' : ''}`}
          draggable={true}
          onDragStart={(e) => {
            if (projectId) {
              handleDragStart(e, projectId);
            }
          }}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            // Prevent default to allow drop
            e.preventDefault();
          }}
        >
          <td className={`px-6 py-4 ${isInFolder ? 'pl-12' : ''}`}>
            <div className="flex items-center justify-between">
              {renamingProjectId && (project.id === renamingProjectId || project.experiment_id === renamingProjectId) ? (
                <>
                  <button
                    onClick={(e) => {
                      if (draggedProject) {
                        e.preventDefault();
                        return;
                      }
                      toggleRowExpansion(project.id!);
                    }}
                    onMouseDown={(e) => {
                      if (!draggedProject) e.stopPropagation();
                    }}
                    className="flex items-center gap-2 text-left"
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center"
                      style={{ borderRadius: 'calc(var(--radius) - 2px)' }}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedRows.has(project.id!) ? '' : '-rotate-90'
                        }`}
                      />
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => onRenameValueChange?.(e.target.value)}
                      className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onSaveRename?.();
                        } else if (e.key === 'Escape') {
                          onCancelRename?.();
                        }
                      }}
                    />
                    <button
                      onClick={onSaveRename}
                      className="text-green-600 hover:text-green-800 text-xs font-medium flex-shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={onCancelRename}
                      className="text-gray-500 hover:text-gray-700 text-xs font-medium flex-shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button 
                onClick={(e) => {
                  // Don't trigger expand when dragging
                  if (draggedProject) {
                    e.preventDefault();
                    return;
                  }
                  toggleRowExpansion(project.id!);
                }}
                onMouseDown={(e) => {
                  // Allow drag to start even if button is pressed
                  if (!draggedProject) {
                    e.stopPropagation();
                  }
                }}
                className="flex items-center gap-2 text-left"
              >
                <div 
                  className="w-8 h-8 flex items-center justify-center"
                  style={{
                    borderRadius: 'calc(var(--radius) - 2px)'
                  }}
                >
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform ${
                      expandedRows.has(project.id!) ? '' : '-rotate-90'
                    }`}
                  />
                </div>
                <span className="font-medium text-gray-900">{project.name}</span>
              </button>
              
              <ProjectDropdown
                isOpen={projectDropdowns.has(project.id!)}
                onToggle={() => toggleProjectDropdown(project.id!)}
                position={projectIndex >= projects.length - 2 ? 'top' : 'bottom'}
                onRename={() => {
                      onRename(project.id!, project.name);
                      toggleProjectDropdown(project.id!);
                    }}
                onReplicate={() => onReplicate?.(project.id!)}
                onModify={() => onModify?.(project.id!)}
                onDelete={() => onDelete?.(project.id!)}
                onMoveToFolder={(folderId) => {
                  if (projectId && onDropToFolder) {
                    onDropToFolder(projectId, folderId);
                  }
                }}
                folders={folders}
                currentFolderId={project.folder_id}
              />
                </>
              )}
            </div>
          </td>
          <td className="px-6 py-4">
            <StatusBadge status={project.status} progress={project.progress} />
          </td>
          <td className="px-6 py-4 text-sm text-gray-900">
            {project.sample_size ?? 10}
          </td>
          <td className="px-6 py-4 text-sm text-gray-900">
            {project.sample_name}
          </td>
          <td className="px-6 py-4">
            <div className="space-y-1">
              {project.downloads.slice(0, 3).map((download, idx) => (
                <DownloadButton 
                  key={download.id}
                  date={download.date}
                  onClick={() => onDownload(download.url || '', download.filename || project.name)}
                />
              ))}
            </div>
          </td>
          <td className="px-6 py-4"></td>
        </tr>
        
        {expandedRows.has(project.id!) && (
          <tr>
            <td colSpan={6} className={`px-6 py-4 bg-gray-50 ${isInFolder ? 'pl-12' : ''}`}>
              <div className="flex gap-6" style={{marginLeft: isInFolder ? '64px' : '40px'}}>
                <SimulationSteps steps={project.steps} />
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // Get root projects
  const rootProjects = projectsByFolder.get(null) || [];
  
  // Sort folders alphabetically by name
  const sortedFolders = [...folders].sort((a, b) => 
    a.folder_name.localeCompare(b.folder_name)
  );
  
  // Check if we have any projects at all
  const hasAnyProjects = projects.length > 0;
  const hasRootProjects = rootProjects.length > 0;
  const hasFolderProjects = folders.some(folder => (projectsByFolder.get(folder.folder_id) || []).length > 0);

  return (
    <div className="rounded-lg border border-gray-200" style={{ backgroundColor: 'hsl(0, 0%, 100%)' }}>
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <SortableTableHeader label="Simulation Name" sortKey="name" onSort={handleSort} currentSort={sortConfig} />
              <SortableTableHeader label="Status" sortKey="status" onSort={handleSort} currentSort={sortConfig} />
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Sample Size</th>
              <SortableTableHeader label="Sample Name" sortKey="sample_name" onSort={handleSort} currentSort={sortConfig} />
              <SortableTableHeader label="Data Download" sortKey="download_date" onSort={handleSort} currentSort={sortConfig} />
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Render folders with their projects - at the top, sorted alphabetically */}
            {sortedFolders.map((folder) => {
              const folderProjects = projectsByFolder.get(folder.folder_id) || [];
              // Always show folders, even if empty

              return (
                <React.Fragment key={folder.folder_id}>
                  <tr
                    className={`bg-gray-50 hover:bg-accent/50 ${dragOverFolder === folder.folder_id ? 'bg-blue-50' : ''}`}
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
                    <td 
                      className="px-6 py-3 bg-gray-50"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDragOver(e, folder.folder_id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop(e, folder.folder_id);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={(e) => {
                            // Don't trigger drag when clicking
                            if (draggedProject) {
                              e.preventDefault();
                              return;
                            }
                            toggleFolderExpansion(folder.folder_id);
                          }}
                          className="flex items-center gap-2 text-left pointer-events-auto"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDragOver(e, folder.folder_id);
                          }}
                          onMouseDown={(e) => {
                            // Allow drag to work even when button is pressed
                            if (draggedProject) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <div className="w-6 h-6 flex items-center justify-center">
                            <ChevronDown 
                              className={`w-4 h-4 transition-transform ${
                                expandedFolders.has(folder.folder_id) ? '' : '-rotate-90'
                              }`}
                            />
                          </div>
                          <Folder className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-gray-900">{folder.folder_name}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({folderProjects.length} {folderProjects.length === 1 ? 'project' : 'projects'})
                          </span>
                        </button>
                        <FolderDropdown
                          isOpen={folderDropdowns.has(folder.folder_id)}
                          onToggle={() => toggleFolderDropdown(folder.folder_id)}
                          position={sortedFolders.indexOf(folder) >= sortedFolders.length - 2 ? 'top' : 'bottom'}
                          onRename={() => onRenameFolder?.(folder.folder_id, folder.folder_name)}
                          onDelete={() => onDeleteFolder?.(folder.folder_id)}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3 bg-gray-50"></td>
                    <td className="px-6 py-3 bg-gray-50"></td>
                    <td className="px-6 py-3 bg-gray-50"></td>
                    <td className="px-6 py-3 bg-gray-50"></td>
                    <td className="px-6 py-3 bg-gray-50"></td>
                  </tr>
                  {expandedFolders.has(folder.folder_id) && folderProjects.map((project, idx) => 
                    renderProjectRow(project, idx, true, folderProjects.length)
                  )}
                </React.Fragment>
              );
            })}
            
            {/* Render root projects (no folder) - after folders, without header */}
            {rootProjects.map((project, idx) => 
              renderProjectRow(project, idx, false, rootProjects.length)
            )}
            
            {/* Fallback: if no projects are showing and we have projects, show them all as root */}
            {hasAnyProjects && !hasRootProjects && !hasFolderProjects && (
              <>
                {sortedProjects.map((project, idx) => 
                  renderProjectRow(project, idx, false, sortedProjects.length)
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Fixed drop zone portal for removing from folders - shows when dragging a project that's in a folder */}
      {draggedProject && sortedProjects.find(p => (p.experiment_id || p.id) === draggedProject)?.folder_id && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-50 ${dragOverFolder === 'root' ? 'bg-blue-50' : ''}`}
          onDragOver={(e) => handleDragOver(e, 'root')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className={`flex items-center justify-center gap-2 text-sm border-2 border-dashed rounded-lg py-4 max-w-4xl mx-auto ${dragOverFolder === 'root' ? 'border-blue-400 text-blue-600 bg-blue-100' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
            <Folder className="w-4 h-4 text-blue-600" />
            <span>Drop here to remove from folder</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}