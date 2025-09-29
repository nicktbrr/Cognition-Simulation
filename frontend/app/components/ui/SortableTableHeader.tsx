import React from "react";
import { ArrowUpDown } from "lucide-react";

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  onSort: (key: string) => void;
}

export default function SortableTableHeader({ label, sortKey, onSort }: SortableTableHeaderProps) {
  return (
    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
      <button 
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:bg-gray-50 px-2 py-1 rounded"
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );
}