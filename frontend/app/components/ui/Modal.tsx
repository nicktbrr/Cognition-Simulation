import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** When provided, rendered at the bottom of the modal (always visible, not scrollable) */
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 flex flex-col ${footer ? 'max-h-[90vh] overflow-hidden' : 'max-h-[90vh] overflow-y-auto'}`}>
        {/* Header with Close Button */}
        <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-blue-600 mb-2">{title}</h2>
            <p className="text-gray-600 text-sm">
              Define a performance measure for your simulation project.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content - scrollable when footer is present */}
        <div className={`px-6 ${footer ? 'flex-1 min-h-0 overflow-y-auto pb-4' : 'pb-6'}`}>
          {children}
        </div>

        {/* Optional footer - fixed at bottom */}
        {footer != null && (
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}