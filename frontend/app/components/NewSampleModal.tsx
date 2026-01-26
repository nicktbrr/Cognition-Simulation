"use client";

import React, { useState, useEffect } from "react";
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

interface Sample {
  id: string;
  name: string;
  attributes: any;
}

interface NewSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sampleName: string, selectedAttributes: Attribute[], attributeSelections: AttributeSelection[]) => void;
  initialSample?: Sample | null;
  checkNameExists?: (name: string, excludeId?: string) => boolean;
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

export default function NewSampleModal({ isOpen, onClose, onSave, initialSample, checkNameExists }: NewSampleModalProps) {
  const [sampleName, setSampleName] = useState<string>('');
  const [selectedAttributes, setSelectedAttributes] = useState<Attribute[]>([]);
  const [attributeSelections, setAttributeSelections] = useState<AttributeSelection[]>([]);
  const [activeAttributePanel, setActiveAttributePanel] = useState<Attribute | null>(null);
  const [tempSelectedOptions, setTempSelectedOptions] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState({ min: 5, max: 82 });
  const [tempAgeRange, setTempAgeRange] = useState({ min: 5, max: 82 });
  const [tempAgeInput, setTempAgeInput] = useState({ min: '5', max: '82' });
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const [checkedOptions, setCheckedOptions] = useState<Set<string>>(new Set());
  const [nameError, setNameError] = useState<string>('');
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

  // Initialize with initialSample data when in edit mode
  useEffect(() => {
    if (isOpen) {
      if (initialSample) {
        setSampleName(initialSample.name || '');
      } else {
        setSampleName('');
      }
      setNameError(''); // Reset error when modal opens
    }
  }, [isOpen, initialSample]);

  // Check for duplicate name when sample name changes
  const handleSampleNameChange = (name: string) => {
    setSampleName(name);
    
    // Check for duplicate name if the function is provided
    if (checkNameExists && name.trim()) {
      const excludeId = initialSample?.id;
      if (checkNameExists(name, excludeId)) {
        setNameError(`A sample with the name "${name.trim()}" already exists.`);
      } else {
        setNameError('');
      }
    } else {
      setNameError('');
    }
  };

  useEffect(() => {
    if (isOpen && initialSample && Array.isArray(initialSample.attributes)) {
      const allAttributesFlat = allCategories.flatMap(cat => cat.attributes);
      const preSelectedAttributes: Attribute[] = [];
      const preSelections: AttributeSelection[] = [];

      initialSample.attributes.forEach((attrData: any) => {
        const attribute = allAttributesFlat.find(attr => 
          attr.id === attrData.label?.toLowerCase().replace(/\s+/g, '-') || 
          attr.label === attrData.label ||
          (attr.category.toLowerCase() === attrData.category?.toLowerCase() && attr.label === attrData.label)
        );

        if (attribute) {
          preSelectedAttributes.push(attribute);

          if (attribute.id === 'age' && attrData.values && attrData.values.length > 0) {
            // Parse age range from string like "18 - 24 years old"
            const ageValue = attrData.values[0];
            const match = ageValue.match(/(\d+)\s*-\s*(\d+)/);
            if (match) {
              const min = parseInt(match[1]);
              const max = parseInt(match[2]);
              preSelections.push({
                attributeId: 'age',
                selectedOptions: [min.toString(), max.toString()]
              });
            }
          } else if (attribute.options && attrData.values) {
            // Match values to option IDs
            const selectedOptionIds: string[] = [];
            attrData.values.forEach((value: string) => {
              const option = attribute.options?.find(opt => opt.label === value);
              if (option) {
                selectedOptionIds.push(option.id);
              }
            });
            
            if (selectedOptionIds.length > 0) {
              preSelections.push({
                attributeId: attribute.id,
                selectedOptions: selectedOptionIds
              });
            }
          }
        }
      });

      setSelectedAttributes(preSelectedAttributes);
      setAttributeSelections(preSelections);
      
      // Initialize all options as checked
      const allCheckedKeys = new Set<string>();
      preSelections.forEach(selection => {
        if (selection.attributeId === 'age') {
          allCheckedKeys.add(`${selection.attributeId}-age-range`);
        } else {
          selection.selectedOptions.forEach(optionId => {
            allCheckedKeys.add(`${selection.attributeId}-${optionId}`);
          });
        }
      });
      setCheckedOptions(allCheckedKeys);
    } else if (isOpen && !initialSample) {
      // Reset when creating new sample
      setSelectedAttributes([]);
      setAttributeSelections([]);
      setCheckedOptions(new Set());
    }
  }, [isOpen, initialSample]);

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
        setTempAgeInput({ min: minAge.toString(), max: maxAge.toString() });
      } else {
        setTempAgeRange({ min: 5, max: 82 });
        setTempAgeInput({ min: '5', max: '82' });
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

        // Mark age range as checked
        setCheckedOptions(prev => new Set(prev).add(`${activeAttributePanel.id}-age-range`));

        // Close panel
        setActiveAttributePanel(null);
        setTempAgeRange({ min: 5, max: 82 });
        setTempAgeInput({ min: '5', max: '82' });
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

        // Mark all selected options as checked
        tempSelectedOptions.forEach(optionId => {
          setCheckedOptions(prev => new Set(prev).add(`${activeAttributePanel.id}-${optionId}`));
        });

        // Close panel
        setActiveAttributePanel(null);
        setTempSelectedOptions([]);
      }
    }
  };

  const handleCloseAttributePanel = () => {
    setActiveAttributePanel(null);
    setTempSelectedOptions([]);
    setTempAgeRange({ min: 5, max: 82 });
    setTempAgeInput({ min: '5', max: '82' });
    setPanelPosition(null);
  };

  const handleToggleOption = (attributeId: string, optionId: string) => {
    const key = `${attributeId}-${optionId}`;
    setCheckedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleToggleAgeRange = (attributeId: string) => {
    const key = `${attributeId}-age-range`;
    setCheckedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isOptionChecked = (attributeId: string, optionId: string) => {
    const key = `${attributeId}-${optionId}`;
    return checkedOptions.has(key);
  };

  const handleSave = () => {
    // Filter selections to only include checked options
    const filteredSelections = attributeSelections.map(selection => {
      if (selection.attributeId === 'age') {
        const isChecked = checkedOptions.has(`${selection.attributeId}-age-range`);
        return isChecked ? selection : null;
      } else {
        const checkedOptionsForAttr = selection.selectedOptions.filter(optionId => 
          checkedOptions.has(`${selection.attributeId}-${optionId}`)
        );
        return checkedOptionsForAttr.length > 0 
          ? { ...selection, selectedOptions: checkedOptionsForAttr }
          : null;
      }
    }).filter((sel): sel is AttributeSelection => sel !== null);

    // Filter attributes to include:
    // 1. Those with checked selections
    // 2. Those without options (always included)
    const filteredAttributes = selectedAttributes.filter(attr => {
      // Attributes without options are always included
      if (!attr.options) {
        return true;
      }
      // Attributes with options must have checked selections
      return filteredSelections.some(sel => sel.attributeId === attr.id);
    });

    const finalSampleName = sampleName.trim() || (initialSample ? initialSample.name : `Sample ${Date.now()}`);
    onSave(finalSampleName, filteredAttributes, filteredSelections);
    setSampleName('');
    setSelectedAttributes([]);
    setAttributeSelections([]);
    setCheckedOptions(new Set());
    onClose();
  };

  const handleClose = () => {
    setSampleName('');
    setSelectedAttributes([]);
    setAttributeSelections([]);
    setActiveAttributePanel(null);
    setTempSelectedOptions([]);
    setTempAgeRange({ min: 5, max: 82 });
    setTempAgeInput({ min: '5', max: '82' });
    setPanelPosition(null);
    setCheckedOptions(new Set());
    setNameError('');
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
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-blue-600 mb-3">{initialSample ? 'Edit Sample' : 'New Sample'}</h2>
              <div>
                <label htmlFor="sample-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Sample Name
                </label>
                <input
                  id="sample-name"
                  type="text"
                  value={sampleName}
                  onChange={(e) => handleSampleNameChange(e.target.value)}
                  placeholder="Enter sample name"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    nameError 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {nameError && (
                  <p className="mt-1 text-sm text-red-600">{nameError}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 ml-4"
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
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                            {selectedOptions.map((option) => {
                              const optionKey = attribute.id === 'age' ? 'age-range' : option.id;
                              const isChecked = isOptionChecked(attribute.id, optionKey);
                              return (
                                <div
                                  key={option.id}
                                  onClick={() => {
                                    if (attribute.id === 'age' || option.id === 'age-range') {
                                      handleToggleAgeRange(attribute.id);
                                    } else {
                                      handleToggleOption(attribute.id, option.id);
                                    }
                                  }}
                                  className="flex items-center space-x-2 text-sm text-gray-900 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                                >
                                  {isChecked ? (
                                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer">
                                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 border-2 border-gray-300 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer bg-white">
                                    </div>
                                  )}
                                  <span className="truncate">{option.label}</span>
                                </div>
                              );
                            })}
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
                disabled={selectedAttributes.length === 0 || !sampleName.trim() || !!nameError}
              >
                {initialSample ? 'Update Sample' : 'Create Sample'}
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
            className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 w-96 flex flex-col"
            style={{
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`,
              maxHeight: '85vh'
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
            <div className="flex-1 overflow-y-auto p-4 min-h-0 pb-4">
              {activeAttributePanel.id === 'age' ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Select the age range for your sample (5-82 years):
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Age
                      </label>
                      <input
                        type="text"
                        placeholder="5"
                        value={tempAgeInput.min}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          setTempAgeInput(prev => ({ ...prev, min: inputValue }));
                          
                          // Update the numeric range for validation
                          const numValue = parseInt(inputValue);
                          if (!isNaN(numValue)) {
                            const validValue = Math.max(5, Math.min(82, numValue));
                            setTempAgeRange(prev => ({ 
                              ...prev, 
                              min: validValue,
                              max: Math.max(validValue, prev.max)
                            }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Age
                      </label>
                      <input
                        type="text"
                        placeholder="82"
                        value={tempAgeInput.max}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          setTempAgeInput(prev => ({ ...prev, max: inputValue }));
                          
                          // Update the numeric range for validation
                          const numValue = parseInt(inputValue);
                          if (!isNaN(numValue)) {
                            const validValue = Math.max(5, Math.min(82, numValue));
                            setTempAgeRange(prev => ({ 
                              ...prev, 
                              max: validValue,
                              min: Math.min(validValue, prev.min)
                            }));
                          }
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
                  + Add Age Range to Sample
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
                    + Add to Sample
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