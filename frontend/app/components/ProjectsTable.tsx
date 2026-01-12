"use client";

import React, { useState } from "react";
import { ChevronDown, Folder } from "lucide-react";
import StatusBadge from "./ui/StatusBadge";
import DownloadButton from "./ui/DownloadButton";
import ProjectDropdown from "./ui/ProjectDropdown";
import SortableTableHeader from "./ui/SortableTableHeader";
import SimulationSteps from "./ui/SimulationSteps";

interface Download {
  date: string;
  id: number;
  url?: string;
  filename?: string;
}

interface SimulationStep {
  label: string;
  instructions: string;
  temperature: number;
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
  onDropToFolder
}: ProjectsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [projectDropdowns, setProjectDropdowns] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [sortedProjects, setSortedProjects] = useState(projects);
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null | 'root'>(null);

  // Update sortedProjects when projects prop changes
  React.useEffect(() => {
    setSortedProjects(projects);
  }, [projects]);

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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sorted = [...projects].sort((a, b) => {
      if (key === 'name') {
        return direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (key === 'sample_name') {
        return direction === 'asc' ? a.sample_name.localeCompare(b.sample_name) : b.sample_name.localeCompare(a.sample_name);
      }
      if (key === 'status') {
        return direction === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
      }
      return 0;
    });
    setSortedProjects(sorted);
  };

  const handleStartRename = (projectId: string, currentName: string) => {
    onRename(projectId, currentName);
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

  // Group projects by folder
  const projectsByFolder = new Map<string | null, Project[]>();
  projects.forEach(project => {
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
    const projectIndex = projects.findIndex(p => p.id === project.id);
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
                  className={`w-8 h-8 flex items-center justify-center transition-transform ${expandedRows.has(project.id!) ? 'rotate-180' : ''}`}
                  style={{
                    borderRadius: 'calc(var(--radius) - 2px)'
                  }}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-900">{project.name}</span>
              </button>
              
              <ProjectDropdown
                isOpen={projectDropdowns.has(project.id!)}
                onToggle={() => toggleProjectDropdown(project.id!)}
                position={projectIndex >= projects.length - 2 ? 'top' : 'bottom'}
                onRename={() => handleStartRename(project.id!, project.name)}
                onReplicate={() => onReplicate?.(project.id!)}
                onModify={() => onModify?.(project.id!)}
                onDelete={() => onDelete?.(project.id!)}
                onMoveToFolder={() => onMoveToFolder?.(project.id!)}
                folders={folders}
              />
            </div>
          </td>
          <td className={`px-6 py-4 ${isInFolder ? 'pl-12' : ''}`}>
            <StatusBadge status={project.status} progress={project.progress} />
          </td>
          <td className={`px-6 py-4 text-sm text-gray-900 ${isInFolder ? 'pl-12' : ''}`}>
            {project.sample_size ?? 10}
          </td>
          <td className={`px-6 py-4 text-sm text-gray-900 ${isInFolder ? 'pl-12' : ''}`}>
            {project.sample_name}
          </td>
          <td className={`px-6 py-4 ${isInFolder ? 'pl-12' : ''}`}>
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
          <td className={`px-6 py-4 ${isInFolder ? 'pl-12' : ''}`}></td>
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
              <SortableTableHeader label="Simulation Name" sortKey="name" onSort={handleSort} />
              <SortableTableHeader label="Status" sortKey="status" onSort={handleSort} />
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Sample Size</th>
              <SortableTableHeader label="Sample Name" sortKey="sample_name" onSort={handleSort} />
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Data Download</th>
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
                    className={`hover:bg-gray-50 ${dragOverFolder === folder.folder_id ? 'bg-blue-50' : ''}`}
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
                      colSpan={6} 
                      className="px-6 py-3 bg-gray-100"
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
                      <button
                        onClick={(e) => {
                          // Don't trigger drag when clicking
                          if (draggedProject) {
                            e.preventDefault();
                            return;
                          }
                          toggleFolderExpansion(folder.folder_id);
                        }}
                        className="flex items-center gap-2 text-left w-full pointer-events-auto"
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
                        <div 
                          className={`w-6 h-6 flex items-center justify-center transition-transform ${expandedFolders.has(folder.folder_id) ? 'rotate-90' : ''}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                        <Folder className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">{folder.folder_name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({folderProjects.length} {folderProjects.length === 1 ? 'project' : 'projects'})
                        </span>
                      </button>
                    </td>
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
            
            {/* Show root drop zone when dragging even if no root projects exist */}
            {!hasRootProjects && draggedProject && (
              <tr
                className={`${dragOverFolder === 'root' ? 'bg-blue-50' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'root')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
              >
                <td colSpan={6} className="px-6 py-2 bg-gray-50">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Folder className="w-4 h-4" />
                    <span>Drop here to remove from folder</span>
                  </div>
                </td>
              </tr>
            )}
            
            {/* Fallback: if no projects are showing and we have projects, show them all as root */}
            {hasAnyProjects && !hasRootProjects && !hasFolderProjects && (
              <>
                {projects.map((project, idx) => 
                  renderProjectRow(project, idx, false, projects.length)
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}