import React from "react";
import { Download } from "lucide-react";

interface DownloadButtonProps {
  date: string;
  onClick: () => void;
  sampleSize?: number;
  sampleName?: string;
  textModel?: string;
  evaluationsModel?: string;
}

function formatModelName(model: string): string {
  if (!model) return "—";
  const modelMap: Record<string, string> = {
    gemini: "Gemini",
    "gpt-4": "GPT-4",
    "gpt-3.5": "GPT-3.5",
    claude: "Claude",
  };
  return modelMap[model.toLowerCase()] || model.charAt(0).toUpperCase() + model.slice(1);
}

export default function DownloadButton({
  date,
  onClick,
  sampleSize,
  sampleName,
  textModel,
  evaluationsModel,
}: DownloadButtonProps) {
  const hasMetadata = sampleSize !== undefined || sampleName || textModel || evaluationsModel;

  return (
    <div className="relative group inline-block">
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-black hover:text-gray-700 px-2 py-1 rounded-xl transition-colors"
        style={{
          backgroundColor: "hsl(236, 25%, 95%)",
          borderRadius: ".75rem",
        }}
      >
        <Download className="w-3 h-3" />
        <span className="text-xs">{date}</span>
      </button>
      {hasMetadata && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 bg-gray-800 text-white text-xs rounded px-2.5 py-2 whitespace-nowrap shadow-lg pointer-events-none">
          {sampleName && (
            <div className="mb-0.5">
              <span className="text-gray-400">Sample:</span> {sampleName}
            </div>
          )}
          {sampleSize !== undefined && (
            <div className="mb-0.5">
              <span className="text-gray-400">Size:</span> {sampleSize}
            </div>
          )}
          {textModel && (
            <div className="mb-0.5">
              <span className="text-gray-400">Text Model:</span> {formatModelName(textModel)}
            </div>
          )}
          {evaluationsModel && (
            <div>
              <span className="text-gray-400">Eval Model:</span> {formatModelName(evaluationsModel)}
            </div>
          )}
          <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
