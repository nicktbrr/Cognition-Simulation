import React from "react";
import { Download } from "lucide-react";

interface DownloadButtonProps {
  date: string;
  onClick: () => void;
}

export default function DownloadButton({ date, onClick }: DownloadButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-1 text-black hover:text-gray-700 px-2 py-1 rounded-xl transition-colors"
      style={{
        backgroundColor: 'hsl(236, 25%, 95%)',
        borderRadius: '.75rem'
      }}
    >
      <Download className="w-3 h-3" />
      <span className="text-xs">{date}</span>
    </button>
  );
}