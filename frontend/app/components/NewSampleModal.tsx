"use client";

import React, { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import otherAttributesData from "../data/attributes/other.json";
import demographicsAttributesData from "../data/attributes/demographics.json";
import healthAttributesData from "../data/attributes/health.json";
import languageAttributesData from "../data/attributes/language.json";
import workAttributesData from "../data/attributes/work.json";
import educationAttributesData from "../data/attributes/education.json";
import beliefsAttributesData from "../data/attributes/belief.json";
import geographyAttributesData from "../data/attributes/geographic.json";
import familyAttributesData from "../data/attributes/family.json";
import shoppingAttributesData from "../data/attributes/shopping.json";
import financeAttributesData from "../data/attributes/finance.json";
import lifestyleAttributesData from "../data/attributes/lifestyle.json";
import technologyAttributesData from "../data/attributes/technology.json";

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

interface NewSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedAttributes: Attribute[], attributeSelections: AttributeSelection[]) => void;
}

const demographicsAttributes: Attribute[] = demographicsAttributesData as Attribute[];

const healthAttributes: Attribute[] = healthAttributesData as Attribute[];

const workAttributes: Attribute[] = workAttributesData as Attribute[];

const educationAttributes: Attribute[] = educationAttributesData as Attribute[];


const beliefsAttributes: Attribute[] = beliefsAttributesData as Attribute[];


const familyAttributes: Attribute[] = familyAttributesData as Attribute[];

const shoppingAttributes: Attribute[] = shoppingAttributesData as Attribute[];


const financeAttributes: Attribute[] = financeAttributesData as Attribute[];


const lifestyleAttributes: Attribute[] = lifestyleAttributesData as Attribute[];


const technologyAttributes: Attribute[] = technologyAttributesData as Attribute[];


const geographicAttributes: Attribute[] = geographyAttributesData as Attribute[];

const languageAttributes: Attribute[] = languageAttributesData as Attribute[];
  


const otherAttributes: Attribute[] = otherAttributesData as Attribute[];

const allCategories = [
  { name: "Demographics", attributes: demographicsAttributes, expanded: true },
  { name: "Health", attributes: healthAttributes, expanded: false },
  { name: "Work", attributes: workAttributes, expanded: false },
  { name: "Education", attributes: educationAttributes, expanded: false },
  { name: "Beliefs", attributes: beliefsAttributes, expanded: false },
  { name: "Family & Relationships", attributes: familyAttributes, expanded: false },
  { name: "Shopping and consumer habits", attributes: shoppingAttributes, expanded: false },
  { name: "Finance", attributes: financeAttributes, expanded: false },
  { name: "Lifestyle and Interests", attributes: lifestyleAttributes, expanded: false },
  { name: "Technology and Online Behavior", attributes: technologyAttributes, expanded: false },
  { name: "Geographic", attributes: geographicAttributes, expanded: false },
  { name: "Languages", attributes: languageAttributes, expanded: false },
  { name: "Other", attributes: otherAttributes, expanded: false },
];

export default function NewSampleModal({ isOpen, onClose, onSave }: NewSampleModalProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Attribute[]>([]);
  const [attributeSelections, setAttributeSelections] = useState<AttributeSelection[]>([]);
  const [activeAttributePanel, setActiveAttributePanel] = useState<Attribute | null>(null);
  const [tempSelectedOptions, setTempSelectedOptions] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState({ min: 18, max: 82 });
  const [tempAgeRange, setTempAgeRange] = useState({ min: 18, max: 82 });
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const [categoryExpanded, setCategoryExpanded] = useState<{ [key: string]: boolean }>({
    "Demographics": true,
    "Health": false,
    "Work": false,
    "Education": false,
    "Beliefs": false,
    "Family & Relationships": false,
    "Shopping and consumer habits": false,
    "Finance": false,
    "Lifestyle and Interests": false,
    "Technology and Online Behavior": false,
    "Geographic": false,
    "Languages": false,
    "Other": false,
  });

  if (!isOpen) return null;

  const handleAttributeClick = (attribute: Attribute, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const panelWidth = 384; // 24rem (w-96)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate initial position to the right of the clicked element
    let left = rect.right + 8;
    let top = rect.top + window.scrollY;
    
    // If panel would go off the right edge, position it to the left of the element
    if (left + panelWidth > viewportWidth) {
      left = rect.left - panelWidth - 8;
    }
    
    // Ensure the panel doesn't go off the left edge
    if (left < 8) {
      left = 8;
    }
    
    const position = { top, left };
    setPanelPosition(position);

    if (attribute.id === 'age') {
      // Handle age attribute specially with range inputs
      setActiveAttributePanel(attribute);
      const existingSelection = attributeSelections.find(sel => sel.attributeId === attribute.id);
      if (existingSelection && existingSelection.selectedOptions.length >= 2) {
        const minAge = Math.min(parseInt(existingSelection.selectedOptions[0]), parseInt(existingSelection.selectedOptions[1]));
        const maxAge = Math.max(parseInt(existingSelection.selectedOptions[0]), parseInt(existingSelection.selectedOptions[1]));
        setTempAgeRange({ min: minAge, max: maxAge });
      } else {
        setTempAgeRange({ min: 18, max: 82 });
      }
    } else if (attribute.options) {
      // If attribute has options, open the detail panel
      setActiveAttributePanel(attribute);
      const existingSelection = attributeSelections.find(sel => sel.attributeId === attribute.id);
      setTempSelectedOptions(existingSelection?.selectedOptions || []);
    } else {
      // If no options, toggle selection directly
      const isSelected = selectedAttributes.some(attr => attr.id === attribute.id);
      if (isSelected) {
        setSelectedAttributes(selectedAttributes.filter(attr => attr.id !== attribute.id));
      } else {
        setSelectedAttributes([...selectedAttributes, attribute]);
      }
    }
  };

  const toggleCategoryExpansion = (categoryName: string) => {
    setCategoryExpanded(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleOptionToggle = (optionId: string) => {
    setTempSelectedOptions(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSelectAll = () => {
    if (activeAttributePanel?.options) {
      setTempSelectedOptions(activeAttributePanel.options.map(option => option.id));
    }
  };

  const handleClearAll = () => {
    setTempSelectedOptions([]);
  };

  const handleAddToSelection = () => {
    if (activeAttributePanel) {
      if (activeAttributePanel.id === 'age') {
        // Handle age range selection
        const newSelection: AttributeSelection = {
          attributeId: activeAttributePanel.id,
          selectedOptions: [tempAgeRange.min.toString(), tempAgeRange.max.toString()]
        };

        setAttributeSelections(prev => {
          const filtered = prev.filter(sel => sel.attributeId !== activeAttributePanel.id);
          return [...filtered, newSelection];
        });

        // Add to selected attributes if not already there
        if (!selectedAttributes.some(attr => attr.id === activeAttributePanel.id)) {
          setSelectedAttributes(prev => [...prev, activeAttributePanel]);
        }

        // Close panel
        setActiveAttributePanel(null);
        setTempAgeRange({ min: 18, max: 82 });
      } else if (tempSelectedOptions.length > 0) {
        // Handle regular options selection
        const newSelection: AttributeSelection = {
          attributeId: activeAttributePanel.id,
          selectedOptions: tempSelectedOptions
        };

        setAttributeSelections(prev => {
          const filtered = prev.filter(sel => sel.attributeId !== activeAttributePanel.id);
          return [...filtered, newSelection];
        });

        // Add to selected attributes if not already there
        if (!selectedAttributes.some(attr => attr.id === activeAttributePanel.id)) {
          setSelectedAttributes(prev => [...prev, activeAttributePanel]);
        }

        // Close panel
        setActiveAttributePanel(null);
        setTempSelectedOptions([]);
      }
    }
  };

  const handleCloseAttributePanel = () => {
    setActiveAttributePanel(null);
    setTempSelectedOptions([]);
    setTempAgeRange({ min: 18, max: 82 });
    setPanelPosition(null);
  };

  const handleSave = () => {
    onSave(selectedAttributes, attributeSelections);
    setSelectedAttributes([]);
    setAttributeSelections([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedAttributes([]);
    setAttributeSelections([]);
    setActiveAttributePanel(null);
    setTempSelectedOptions([]);
    setTempAgeRange({ min: 18, max: 82 });
    setPanelPosition(null);
    onClose();
  };

  const getSelectedOptionsForAttribute = (attributeId: string) => {
    const selection = attributeSelections.find(sel => sel.attributeId === attributeId);
    if (!selection) return [];
    
    if (attributeId === 'age') {
      // For age, create a display format for the range
      if (selection.selectedOptions.length >= 2) {
        const minAge = Math.min(parseInt(selection.selectedOptions[0]), parseInt(selection.selectedOptions[1]));
        const maxAge = Math.max(parseInt(selection.selectedOptions[0]), parseInt(selection.selectedOptions[1]));
        return [{ id: 'age-range', label: `${minAge} - ${maxAge} years old` }];
      }
      return [];
    }
    
    const attribute = selectedAttributes.find(attr => attr.id === attributeId);
    if (!attribute || !attribute.options) return [];
    
    return attribute.options.filter(option => selection.selectedOptions.includes(option.id));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
        <div className="bg-white h-screen flex flex-col shadow-2xl" style={{width: 'calc(100% - 224px)'}}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-blue-600">New Sample</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Explore Attributes Header */}
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-lg font-semibold text-blue-600">Explore Attributes</h3>
          </div>

          {/* Main Content Area - Split into two halves */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            {/* Top Half - Scrollable Categories */}
            <div className="flex-1 overflow-y-auto border-b border-gray-200" style={{ minHeight: 0 }}>
              <div className="p-6">
                {allCategories.map((category) => (
                  <div key={category.name} className="mb-6">
                    <button
                      onClick={() => toggleCategoryExpansion(category.name)}
                      className="flex items-center justify-between w-full text-left font-medium text-blue-600 mb-3 hover:text-blue-800 transition-colors"
                    >
                      <span>{category.name}</span>
                      {categoryExpanded[category.name] ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {categoryExpanded[category.name] && (
                      <div className="grid grid-cols-2 gap-2 ml-4">
                        {category.attributes.map((attribute) => {
                          const isSelected = selectedAttributes.some(attr => attr.id === attribute.id);
                          return (
                            <div
                              key={attribute.id}
                              onClick={(e) => handleAttributeClick(attribute, e)}
                              className={`p-3 rounded border cursor-pointer transition-colors text-sm ${isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                              {attribute.label}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Half - Selected Attributes */}
            <div className="flex-1 p-6 bg-white overflow-y-auto" style={{ minHeight: 0 }}>
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Selected Attributes</h3>
            {selectedAttributes.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">No attributes selected. Click attributes above to add them here.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto mb-4">
                <div className="grid grid-cols-3 gap-4">
                  {selectedAttributes.map((attribute) => {
                    const selectedOptions = getSelectedOptionsForAttribute(attribute.id);
                    return (
                      <div
                        key={attribute.id}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 mb-1">{attribute.category}</div>
                            <div className="text-base font-semibold text-blue-600 truncate">{attribute.label}</div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedAttributes(prev => prev.filter(attr => attr.id !== attribute.id));
                              setAttributeSelections(prev => prev.filter(sel => sel.attributeId !== attribute.id));
                            }}
                            className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {selectedOptions.length > 0 && (
                          <div className="space-y-2">
                            {selectedOptions.slice(0, 8).map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center space-x-2 text-sm text-gray-900"
                              >
                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <span className="truncate">{option.label}</span>
                              </div>
                            ))}
                            {selectedOptions.length > 8 && (
                              <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs">...</span>
                                </div>
                                <span className="text-xs">+{selectedOptions.length - 8} more</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedOptions.length === 0 && !attribute.options && (
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
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
              <Button
                onClick={handleClose}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={selectedAttributes.length === 0}
              >
                Create Sample
              </Button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Attribute Detail Tooltip */}
      {activeAttributePanel && panelPosition && (
        <div className="fixed inset-0 z-[60]" onClick={handleCloseAttributePanel}>
          <div
            className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-[80vh] flex flex-col"
            style={{
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tooltip Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-sm font-medium text-gray-600">{activeAttributePanel.category}</h3>
                <h2 className="text-lg font-semibold text-blue-600">{activeAttributePanel.label}</h2>
              </div>
              <button
                onClick={handleCloseAttributePanel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options List / Age Range Inputs */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {activeAttributePanel.id === 'age' ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Select the age range for your sample (18-82 years):
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Age
                      </label>
                      <input
                        type="number"
                        min="18"
                        max="82"
                        value={tempAgeRange.min}
                        onChange={(e) => {
                          const value = Math.max(18, Math.min(82, parseInt(e.target.value) || 18));
                          setTempAgeRange(prev => ({ 
                            ...prev, 
                            min: value,
                            max: Math.max(value, prev.max)
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Age
                      </label>
                      <input
                        type="number"
                        min="18"
                        max="82"
                        value={tempAgeRange.max}
                        onChange={(e) => {
                          const value = Math.max(18, Math.min(82, parseInt(e.target.value) || 82));
                          setTempAgeRange(prev => ({ 
                            ...prev, 
                            max: value,
                            min: Math.min(value, prev.min)
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="text-sm text-gray-500">
                      Selected range: {tempAgeRange.min} - {tempAgeRange.max} years old
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAttributePanel.options?.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={tempSelectedOptions.includes(option.id)}
                        onChange={() => handleOptionToggle(option.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900">{option.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tooltip Footer */}
            <div className="border-t border-gray-200 p-4 flex-shrink-0 bg-white">
              {activeAttributePanel.id === 'age' ? (
                <Button
                  onClick={handleAddToSelection}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  + Add Age Range to Selection
                </Button>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <Button
                      onClick={handleSelectAll}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Select All
                    </Button>
                    <Button
                      onClick={handleClearAll}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Clear All
                    </Button>
                  </div>
                  <Button
                    onClick={handleAddToSelection}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={tempSelectedOptions.length === 0}
                  >
                    + Add to Selection
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}