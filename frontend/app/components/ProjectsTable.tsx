"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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

interface Project {
  name: string;
  sample_name: string;
  status: string;
  downloads: Download[];
  steps: SimulationStep[];
  id?: string;
}

interface ProjectsTableProps {
  projects: Project[];
  onDownload: (url: string, filename: string) => void;
  onRename: (projectId: string, currentName: string) => void;
  onModify?: (projectId: string) => Promise<boolean>;
  onDelete?: (projectId: string) => Promise<boolean>;
}

export default function ProjectsTable({ projects, onDownload, onRename, onModify, onDelete }: ProjectsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [projectDropdowns, setProjectDropdowns] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [sortedProjects, setSortedProjects] = useState(projects);

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
    console.log('Starting rename for projectId:', projectId, 'name:', currentName);
    onRename(projectId, currentName);
  };

  return (
    <div className="rounded-lg border border-gray-200" style={{ backgroundColor: 'hsl(0, 0%, 100%)' }}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 
          className="text-xl font-semibold"
          style={{
            fontFamily: 'Barlow, sans-serif',
            background: 'linear-gradient(135deg, #396af1 10%, #a665f6 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Recent Projects
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          View and manage your simulation projects. Click on a project name to edit or expand for details.
        </p>
      </div>
      
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <SortableTableHeader label="Simulation Name" sortKey="name" onSort={handleSort} />
              <SortableTableHeader label="Sample Name" sortKey="sample_name" onSort={handleSort} />
              <SortableTableHeader label="Status" sortKey="status" onSort={handleSort} />
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Data Downloads</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedProjects.map((project, index) => (
              <React.Fragment key={index}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => toggleRowExpansion(project.id!)}
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
                        position={index >= sortedProjects.length - 2 ? 'top' : 'bottom'}
                        onRename={() => handleStartRename(project.id!, project.name)}
                        onReplicate={() => console.log('Replicate', project.name)}
                        onModify={() => onModify?.(project.id!)}
                        onDelete={() => onDelete?.(project.id!)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link href="#" className="text-blue-600 hover:text-blue-800 underline">
                      {project.sample_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={project.status} />
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
                    <td colSpan={5} className="px-6 py-4 bg-gray-50">
                      <div className="flex gap-6" style={{marginLeft: '40px'}}>
                        <SimulationSteps steps={project.steps} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}