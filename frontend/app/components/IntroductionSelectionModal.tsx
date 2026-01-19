import React, { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import { Button } from "@/components/ui/button";

interface IntroductionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldIntroduction: string;
  newIntroduction: string;
  onSelect: (introduction: string) => void;
}

export default function IntroductionSelectionModal({
  isOpen,
  onClose,
  oldIntroduction,
  newIntroduction,
  onSelect,
}: IntroductionSelectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<"old" | "new">("old");

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOption("old");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedOption === "old") {
      onSelect(oldIntroduction);
    } else {
      onSelect(newIntroduction);
    }
    onClose();
  };

  const handleCancel = () => {
    // Keep old text (don't call onSelect, just close)
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Select Introduction"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 mb-4">
          A new introduction has been generated based on your study description. Please choose which one to use:
        </p>

        {/* Old Introduction */}
        <div
          onClick={() => setSelectedOption("old")}
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            selectedOption === "old"
              ? "border-blue-500 bg-blue-50 shadow-md"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${
              selectedOption === "old" ? "text-blue-700" : "text-gray-700"
            }`}>
              Current Introduction
            </h3>
            {selectedOption === "old" && (
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
          </div>
          <div className={`rounded p-3 text-sm text-gray-700 min-h-[80px] max-h-[200px] overflow-y-auto whitespace-pre-wrap ${
            selectedOption === "old" ? "bg-white border border-blue-200" : "bg-gray-50"
          }`}>
            {oldIntroduction || "(Empty)"}
          </div>
        </div>

        {/* New Introduction */}
        <div
          onClick={() => setSelectedOption("new")}
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            selectedOption === "new"
              ? "border-blue-500 bg-blue-50 shadow-md"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${
              selectedOption === "new" ? "text-blue-700" : "text-gray-700"
            }`}>
              Generated Introduction (Recommended)
            </h3>
            {selectedOption === "new" && (
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
          </div>
          <div className={`rounded p-3 text-sm text-gray-700 min-h-[80px] max-h-[200px] overflow-y-auto whitespace-pre-wrap ${
            selectedOption === "new" ? "bg-white border border-blue-200" : "bg-gray-50"
          }`}>
            {newIntroduction}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
