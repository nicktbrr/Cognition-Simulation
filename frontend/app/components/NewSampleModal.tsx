"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, ChevronDown, ChevronUp, Search, Pencil } from "lucide-react";
import { Button } from "./ui/button";
import {
  allCategories,
  continuousBounds,
  isContinuous,
  type Attribute,
  type AttributeOption,
} from "../data/attributeCatalog";
import DistributionEditor from "./DistributionEditor";
import {
  defaultContinuous,
  ensureDistribution,
  formatContinuous,
  parseRange,
  rebalanceCategorical,
  validateContinuous,
  type CategoricalDistribution,
  type ContinuousDistribution,
  type Distribution,
} from "../utils/distributions";

/**
 * The options chosen for an attribute and how the sample is spread over
 * them. A continuous attribute stores its range as `[min, max]` in
 * `selectedOptions` and its curve in `distribution`.
 */
export interface AttributeSelection {
  attributeId: string;
  selectedOptions: string[];
  distribution?: Distribution;
}

/** Key in `checkedOptions` for a continuous attribute's single range row. */
const rangeKey = (attributeId: string) => `${attributeId}-range`;

/** The labels of the chosen options, in catalogue order. */
const optionLabelsFor = (attribute: Attribute, optionIds: string[]) =>
  (attribute.options ?? []).filter((option) => optionIds.includes(option.id)).map((option) => option.label);

/**
 * The range a continuous attribute was saved with: its stored curve, a
 * legacy "18 - 35 years old" range, or the span of numeric option labels a
 * legacy row picked.
 */
const storedContinuous = (attribute: Attribute, attrData: any): ContinuousDistribution => {
  if (attrData?.distribution?.type === "continuous") return attrData.distribution;
  const values: string[] = Array.isArray(attrData?.values) ? attrData.values : [];
  const bounds = continuousBounds(attribute);
  const range = values.length === 1 ? parseRange(values[0]) : null;
  if (range) return defaultContinuous(range[0], range[1]);
  const numbers = values.map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value));
  if (numbers.length > 1 && Math.min(...numbers) < Math.max(...numbers)) {
    return defaultContinuous(Math.min(...numbers), Math.max(...numbers));
  }
  return defaultContinuous(bounds.min, bounds.max);
};

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

export default function NewSampleModal({ isOpen, onClose, onSave, initialSample, checkNameExists }: NewSampleModalProps) {
  const [sampleName, setSampleName] = useState<string>('');
  const [selectedAttributes, setSelectedAttributes] = useState<Attribute[]>([]);
  const [attributeSelections, setAttributeSelections] = useState<AttributeSelection[]>([]);
  const [activeAttributePanel, setActiveAttributePanel] = useState<Attribute | null>(null);
  const [tempSelectedOptions, setTempSelectedOptions] = useState<string[]>([]);
  // The popover's draft split (categorical) or curve (continuous).
  const [tempDistribution, setTempDistribution] = useState<CategoricalDistribution | undefined>(undefined);
  const [tempContinuous, setTempContinuous] = useState<ContinuousDistribution | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; maxHeight?: number } | null>(null);
  const [checkedOptions, setCheckedOptions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [optionSearchQuery, setOptionSearchQuery] = useState<string>('');
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const continuousError = useMemo(
    () =>
      activeAttributePanel && tempContinuous
        ? validateContinuous(tempContinuous, continuousBounds(activeAttributePanel))
        : null,
    [activeAttributePanel, tempContinuous]
  );

  // Initialize with initialSample data when in edit mode
  useEffect(() => {
    if (isOpen) {
      if (initialSample) {
        setSampleName(initialSample.name || '');
      } else {
        setSampleName('');
      }
      setNameError(''); // Reset error when modal opens
      setHasUnsavedChanges(false);
      setShowUnsavedConfirm(false);
    }
  }, [isOpen, initialSample]);

  // Check for duplicate name when sample name changes
  const handleSampleNameChange = (name: string) => {
    setSampleName(name);
    setHasUnsavedChanges(true);
    
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

          if (isContinuous(attribute)) {
            const distribution = storedContinuous(attribute, attrData);
            preSelections.push({
              attributeId: attribute.id,
              selectedOptions: [String(distribution.min), String(distribution.max)],
              distribution,
            });
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
                selectedOptions: selectedOptionIds,
                distribution: rebalanceCategorical(
                  ensureDistribution(attrData),
                  optionLabelsFor(attribute, selectedOptionIds)
                ),
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
        if (selection.distribution?.type === 'continuous') {
          allCheckedKeys.add(rangeKey(selection.attributeId));
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
      setSearchQuery('');
    }
  }, [isOpen, initialSample]);

  if (!isOpen) return null;

  const openAttributePanelFor = (attribute: Attribute, anchorEl: HTMLElement) => {
    const rect = anchorEl.getBoundingClientRect();
    const panelWidth = 384; // 24rem (w-96)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelPadding = 24; // space from viewport edges
    const maxPanelHeight = 0.85 * viewportHeight;

    let left = rect.right + 8;
    let top = rect.top;

    if (left + panelWidth > viewportWidth - panelPadding) {
      left = rect.left - panelWidth - 8;
    }
    if (left < panelPadding) {
      left = panelPadding;
    }

    // Keep panel fully in view: start high enough that bottom doesn't get cut off
    const maxTop = viewportHeight - panelPadding - maxPanelHeight;
    if (top > maxTop) {
      top = maxTop;
    }
    top = Math.max(panelPadding, top);

    const position = { top, left, maxHeight: Math.min(maxPanelHeight, viewportHeight - top - panelPadding) };
    setPanelPosition(position);

    const existingSelection = attributeSelections.find(sel => sel.attributeId === attribute.id);
    if (isContinuous(attribute)) {
      setActiveAttributePanel(attribute);
      const bounds = continuousBounds(attribute);
      setTempContinuous(
        existingSelection?.distribution?.type === 'continuous'
          ? existingSelection.distribution
          : defaultContinuous(bounds.min, bounds.max)
      );
    } else if (attribute.options) {
      setActiveAttributePanel(attribute);
      setOptionSearchQuery('');
      setTempSelectedOptions(existingSelection?.selectedOptions || []);
      setTempDistribution(
        existingSelection?.distribution?.type === 'categorical' ? existingSelection.distribution : undefined
      );
    }
  };

  const handleAttributeClick = (attribute: Attribute, event: React.MouseEvent) => {
    if (isContinuous(attribute) || attribute.options) {
      openAttributePanelFor(attribute, event.currentTarget as HTMLElement);
    } else {
      const isSelected = selectedAttributes.some(attr => attr.id === attribute.id);
      if (isSelected) {
        setSelectedAttributes(selectedAttributes.filter(attr => attr.id !== attribute.id));
      } else {
        setSelectedAttributes([...selectedAttributes, attribute]);
      }
      setHasUnsavedChanges(true);
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
    if (!activeAttributePanel) return;
    const attribute = activeAttributePanel;
    let newSelection: AttributeSelection;
    let checkedKeys: string[];

    if (isContinuous(attribute)) {
      if (!tempContinuous || continuousError) return;
      newSelection = {
        attributeId: attribute.id,
        selectedOptions: [String(tempContinuous.min), String(tempContinuous.max)],
        distribution: tempContinuous,
      };
      checkedKeys = [rangeKey(attribute.id)];
    } else {
      if (tempSelectedOptions.length === 0) return;
      // Keep the options in catalogue order so the split reads top to bottom.
      const optionIds = (attribute.options ?? [])
        .map(option => option.id)
        .filter(id => tempSelectedOptions.includes(id));
      newSelection = {
        attributeId: attribute.id,
        selectedOptions: optionIds,
        distribution: rebalanceCategorical(tempDistribution, optionLabelsFor(attribute, optionIds)),
      };
      checkedKeys = optionIds.map(optionId => `${attribute.id}-${optionId}`);
    }

    setAttributeSelections(prev => [...prev.filter(sel => sel.attributeId !== attribute.id), newSelection]);
    if (!selectedAttributes.some(attr => attr.id === attribute.id)) {
      setSelectedAttributes(prev => [...prev, attribute]);
    }
    setCheckedOptions(prev => {
      const next = new Set(prev);
      checkedKeys.forEach(key => next.add(key));
      return next;
    });
    setHasUnsavedChanges(true);

    setActiveAttributePanel(null);
    setTempSelectedOptions([]);
    setTempDistribution(undefined);
    setTempContinuous(null);
  };

  const handleCloseAttributePanel = () => {
    setActiveAttributePanel(null);
    setOptionSearchQuery('');
    setTempSelectedOptions([]);
    setTempDistribution(undefined);
    setTempContinuous(null);
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
    setHasUnsavedChanges(true);
  };

  const handleToggleRange = (attributeId: string) => {
    const key = rangeKey(attributeId);
    setCheckedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
    setHasUnsavedChanges(true);
  };

  const isOptionChecked = (attributeId: string, optionId: string) => {
    const key = `${attributeId}-${optionId}`;
    return checkedOptions.has(key);
  };

  const handleSave = () => {
    // Filter selections to only include checked options
    const filteredSelections = attributeSelections.map(selection => {
      if (selection.distribution?.type === 'continuous') {
        const isChecked = checkedOptions.has(rangeKey(selection.attributeId));
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
    setTempDistribution(undefined);
    setTempContinuous(null);
    setPanelPosition(null);
    setCheckedOptions(new Set());
    setSearchQuery('');
    setNameError('');
    setShowUnsavedConfirm(false);
    onClose();
  };

  const attemptClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      handleClose();
    }
  };

  const getSelectedOptionsForAttribute = (attributeId: string) => {
    const selection = attributeSelections.find(sel => sel.attributeId === attributeId);
    if (!selection) return [];
    
    const attribute = selectedAttributes.find(attr => attr.id === attributeId);
    if (selection.distribution?.type === 'continuous') {
      return [{ id: 'range', label: formatContinuous(selection.distribution, attribute?.unit) }];
    }
    
    if (!attribute || !attribute.options) return [];
    
    return attribute.options.filter(option => selection.selectedOptions.includes(option.id));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50" onClick={attemptClose}>
        <div className="bg-white h-screen flex flex-col shadow-2xl" style={{width: 'calc(100% - 224px)'}} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-shrink-0">
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
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <button
                onClick={attemptClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Explore Attributes Header */}
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Explore Attributes</h3>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attributes or their options..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Main Content Area - Split into two halves */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            {/* Top Half - Scrollable Categories */}
            <div className="flex-1 overflow-y-auto border-b border-gray-200" style={{ minHeight: 0 }}>
              <div className="p-6">
                {allCategories.map((category) => {
                  // Filter attributes based on search query (label, category, or any option label)
                  const q = searchQuery.trim().toLowerCase();
                  const filteredAttributes = q
                    ? category.attributes.filter(attr =>
                        attr.label.toLowerCase().includes(q) ||
                        attr.category.toLowerCase().includes(q) ||
                        (attr.options?.some(opt => opt.label.toLowerCase().includes(q)) ?? false)
                      )
                    : category.attributes;

                  // Only show category if it has matching attributes or search is empty
                  if (searchQuery.trim() && filteredAttributes.length === 0) {
                    return null;
                  }

                  // Auto-expand category if it has matching attributes when searching
                  const shouldShowExpanded = searchQuery.trim()
                    ? filteredAttributes.length > 0
                    : categoryExpanded[category.name];

                  return (
                    <div key={category.name} className="mb-6">
                      <button
                        onClick={() => toggleCategoryExpansion(category.name)}
                        className="flex items-center justify-between w-full text-left font-medium text-blue-600 mb-3 hover:text-blue-800 transition-colors"
                      >
                        <span>
                          {category.name}
                          {(() => {
                            const count = category.attributes.filter(attr => selectedAttributes.some(s => s.id === attr.id)).length;
                            return count > 0 ? <span className="ml-1.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">{count}</span> : null;
                          })()}
                        </span>
                        {shouldShowExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {shouldShowExpanded && (
                        <div className="grid grid-cols-2 gap-2 ml-4">
                          {filteredAttributes.map((attribute) => {
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
                  );
                })}
                {searchQuery.trim() && allCategories.every(category => {
                  const q = searchQuery.trim().toLowerCase();
                  const filtered = category.attributes.filter(attr =>
                    attr.label.toLowerCase().includes(q) ||
                    attr.category.toLowerCase().includes(q) ||
                    (attr.options?.some(opt => opt.label.toLowerCase().includes(q)) ?? false)
                  );
                  return filtered.length === 0;
                }) && (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-sm">No attributes or options found matching "{searchQuery}"</p>
                  </div>
                )}
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
                    const continuous = isContinuous(attribute);
                    // The split shown is over the options still ticked, as saved.
                    const selection = attributeSelections.find(sel => sel.attributeId === attribute.id);
                    const split = continuous
                      ? undefined
                      : rebalanceCategorical(
                          selection?.distribution,
                          selectedOptions
                            .filter(option => isOptionChecked(attribute.id, option.id))
                            .map(option => option.label)
                        );
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
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            {(continuous || (attribute.options && attribute.options.length > 0)) && (
                              <button
                                onClick={(e) => openAttributePanelFor(attribute, e.currentTarget as HTMLElement)}
                                className="text-gray-400 hover:text-blue-600 p-1 rounded"
                                title="Edit attribute"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedAttributes(prev => prev.filter(attr => attr.id !== attribute.id));
                                setAttributeSelections(prev => prev.filter(sel => sel.attributeId !== attribute.id));
                                setHasUnsavedChanges(true);
                              }}
                              className="text-gray-400 hover:text-gray-600 p-1 rounded"
                              title="Remove attribute"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {selectedOptions.length > 0 && (
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                            {selectedOptions.map((option) => {
                              const isChecked = isOptionChecked(attribute.id, option.id);
                              return (
                                <div
                                  key={option.id}
                                  onClick={() => {
                                    if (continuous) {
                                      handleToggleRange(attribute.id);
                                    } else {
                                      handleToggleOption(attribute.id, option.id);
                                    }
                                  }}
                                  className={`flex items-center space-x-2 text-sm text-gray-900 rounded px-2 py-1 -mx-2 -my-1 transition-colors cursor-pointer hover:bg-gray-100`}
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
                                  <span className="truncate flex-1">{option.label}</span>
                                  {split && isChecked && (
                                    <span className="flex-shrink-0 text-xs font-medium text-gray-600">
                                      {split.percentages[option.label] ?? 0}%
                                    </span>
                                  )}
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
            </div>
          </div>

          {/* Action Buttons - fixed at bottom of screen */}
          <div className="flex-shrink-0 flex justify-end gap-3 p-6 border-t border-gray-200 bg-white">
            <Button
              onClick={attemptClose}
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

      {/* Unsaved changes confirmation */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowUnsavedConfirm(false)}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unsaved changes</h3>
            <p className="text-gray-600 text-sm mb-6">You have unsaved changes. Save or discard?</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { handleSave(); setShowUnsavedConfirm(false); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Save changes
              </Button>
              <Button onClick={handleClose} variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
                Discard changes
              </Button>
              <Button onClick={() => setShowUnsavedConfirm(false)} variant="ghost" className="w-full">
                Keep editing
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Attribute Detail Tooltip */}
      {activeAttributePanel && panelPosition && (
        <div className="fixed inset-0 z-[60]" onClick={handleCloseAttributePanel}>
          <div
            className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 w-96 flex flex-col min-h-0"
            style={{
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`,
              maxHeight: panelPosition.maxHeight != null ? `${panelPosition.maxHeight}px` : '85vh'
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

            {/* Options List / Continuous Inputs - scrollable so footer always stays visible */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pb-4 flex flex-col">
              {isContinuous(activeAttributePanel) && tempContinuous ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Each persona&apos;s value is drawn from a normal curve with this mean and SD, kept between
                    the min and max.
                  </div>
                  <DistributionEditor
                    values={[]}
                    distribution={tempContinuous}
                    onChange={(distribution) => setTempContinuous(distribution as ContinuousDistribution)}
                    bounds={continuousBounds(activeAttributePanel)}
                    unit={activeAttributePanel.unit}
                  />
                </div>
              ) : (
                <>
                  {activeAttributePanel.options && activeAttributePanel.options.length > 20 && (
                    <div className="flex-shrink-0 mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search options..."
                          value={optionSearchQuery}
                          onChange={(e) => setOptionSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 min-h-0">
                    {(optionSearchQuery.trim()
                      ? activeAttributePanel.options?.filter((opt) =>
                          opt.label.toLowerCase().includes(optionSearchQuery.trim().toLowerCase())
                        ) ?? []
                      : activeAttributePanel.options ?? []
                    ).map((option) => (
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
                </>
              )}
            </div>

            {/* Tooltip Footer */}
            <div className="border-t border-gray-200 p-4 flex-shrink-0 bg-white">
              {isContinuous(activeAttributePanel) ? (
                <Button
                  onClick={handleAddToSelection}
                  disabled={!!continuousError}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add to Sample
                </Button>
              ) : (
                <>
                  {tempSelectedOptions.length > 0 && (() => {
                    const labels = optionLabelsFor(activeAttributePanel, tempSelectedOptions);
                    return (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">Share of sample</div>
                        <div className="max-h-48 overflow-y-auto pr-1">
                          <DistributionEditor
                            values={labels}
                            distribution={rebalanceCategorical(tempDistribution, labels)}
                            onChange={(distribution) => setTempDistribution(distribution as CategoricalDistribution)}
                          />
                        </div>
                      </div>
                    );
                  })()}
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