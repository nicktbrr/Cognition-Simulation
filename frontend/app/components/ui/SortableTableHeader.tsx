import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  onSort: (key: string) => void;
  currentSort?: { key: string; direction: 'asc' | 'desc' } | null;
}

export default function SortableTableHeader({ label, sortKey, onSort, currentSort }: SortableTableHeaderProps) {
  const isActive = currentSort?.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
      <button 
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:bg-gray-50 px-2 py-1 rounded"
      >
        {label}
        {direction === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : direction === 'desc' ? (
          <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </button>
    </th>
  );
}