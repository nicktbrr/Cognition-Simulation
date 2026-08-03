"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  FileUp,
  Folder,
  Loader2,
  Plus,
  Search,
  Square,
  CheckSquare,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "../utils/supabase";
import { Button } from "./ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Slider } from "./ui/slider";
import Multiselect from "./ui/multiselect";
import {
  allCategories,
  getAttributeById,
  type Attribute,
} from "../data/attributeCatalog";

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedValueAnchor {
  value: number;
  label: string;
}

export interface ParsedMeasure {
  id: string;
  title: string;
  definition: string;
  minValue: number;
  maxValue: number;
  valueAnchors: ParsedValueAnchor[];
}

export interface ParsedStep {
  id: string;
  label: string;
  instruction: string;
  temperature: number; // 1-100, same scale as the simulation step slider
  measureIds: string[];
}

// A sample attribute is a selection from the shared attribute catalogue:
// the attribute id plus the option ids chosen for it. For Age the option ids
// are the ends of the range (e.g. ["18", "25"]).
export interface ParsedSampleAttribute {
  attributeId: string;
  optionIds: string[];
}

export interface ParsedSample {
  name: string;
  attributes: ParsedSampleAttribute[];
}

export interface ParsedStudy {
  id: string;
  title: string;
  briefDescription: string;
  studyIntroduction: string;
  sample: ParsedSample;
  measures: ParsedMeasure[];
  steps: ParsedStep[];
  isSelected: boolean;
}

interface PDFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (folderName: string, studies: ParsedStudy[]) => Promise<void>;
}

type ImportStage = "upload" | "parsing" | "error" | "selection" | "review" | "confirm";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const STEP_INSTRUCTION_MAX_CHARS = 500;
const MEASURE_DEFINITION_MAX_CHARS = 200;

// Real PDF parsing runs through the backend /api/parse-pdf endpoint. While the
// flow is being built out we hand back placeholder studies instead so the
// review steps can be exercised without a deployed backend.
const USE_DUMMY_PARSE = true;
const DUMMY_PARSE_DURATION_MS = 2600;

const getParsePdfUrl = () => {
  const prod = process.env.NEXT_PUBLIC_DEV || "production";
  return prod === "development"
    ? "http://127.0.0.1:5000/api/parse-pdf"
    : "https://cognition-backend-81313456654.us-west1.run.app/api/parse-pdf";
};

// Shape returned by the backend /api/parse-pdf endpoint
interface ApiStudy {
  title: string;
  brief_description: string;
  study_introduction: string;
  sample: { name: string; attributes: Array<{ name: string; value: string }> };
  measures: Array<{
    id: string;
    title: string;
    definition: string;
    min_value: number;
    max_value: number;
    value_anchors: Array<{ value: number; label: string }>;
  }>;
  steps: Array<{ id: string; label: string; instruction: string; measure_ids: string[] }>;
}

const toParsedStudies = (studies: ApiStudy[]): ParsedStudy[] =>
  studies.map((study, index) => ({
    id: `study-${index + 1}`,
    title: study.title || `Study ${index + 1}`,
    briefDescription: study.brief_description || "",
    studyIntroduction: study.study_introduction || "",
    isSelected: true,
    // The backend returns free-text sample attributes; until it maps them onto
    // the catalogue the reviewer picks the attributes themselves.
    sample: { name: study.sample?.name || "", attributes: [] },
    measures: (study.measures || []).map((measure, measureIndex) => ({
      id: measure.id || `m${measureIndex + 1}`,
      title: measure.title || "",
      definition: measure.definition || "",
      minValue: Number(measure.min_value ?? 1),
      maxValue: Number(measure.max_value ?? 7),
      valueAnchors: (measure.value_anchors || []).map((anchor) => ({
        value: Number(anchor.value ?? 0),
        label: anchor.label || "",
      })),
    })),
    steps: (study.steps || []).map((step, stepIndex) => ({
      id: step.id || `s${stepIndex + 1}`,
      label: step.label || `Step ${stepIndex + 1}`,
      instruction: step.instruction || "",
      temperature: 50,
      measureIds: step.measure_ids || [],
    })),
  }));

// ============================================================================
// ATTRIBUTE PICKER - the same catalogue list the Samples page offers
// ============================================================================

function AttributePicker({
  usedAttributeIds,
  onSelect,
}: {
  usedAttributeIds: string[];
  onSelect: (attribute: Attribute) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allCategories
      .map((category) => ({
        name: category.name,
        attributes: category.attributes.filter(
          (attribute) =>
            !usedAttributeIds.includes(attribute.id) &&
            (!normalized ||
              attribute.label.toLowerCase().includes(normalized) ||
              category.name.toLowerCase().includes(normalized))
        ),
      }))
      .filter((category) => category.attributes.length > 0);
  }, [query, usedAttributeIds]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-sm font-medium flex items-center gap-1"
      >
        <Plus className="h-4 w-4" />
        Add Attribute
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-[99999] mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col max-h-80">
          <div className="p-2 border-b border-gray-200 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                autoFocus
                type="text"
                placeholder="Search attributes..."
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {filteredCategories.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">No attributes found</div>
            ) : (
              filteredCategories.map((category) => (
                <div key={category.name}>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                    {category.name}
                  </div>
                  {category.attributes.map((attribute) => (
                    <div
                      key={attribute.id}
                      onClick={() => {
                        onSelect(attribute);
                        setIsOpen(false);
                        setQuery("");
                      }}
                      className="px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 cursor-pointer"
                    >
                      {attribute.label}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL
// ============================================================================

export default function PDFImportModal({ isOpen, onClose, onImport }: PDFImportModalProps) {
  const [stage, setStage] = useState<ImportStage>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [parseError, setParseError] = useState("");
  const [parsedStudies, setParsedStudies] = useState<ParsedStudy[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0);
  const [parsingProgress, setParsingProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  const [expandedSections, setExpandedSections] = useState<{
    sample: boolean;
    measures: boolean;
    steps: boolean;
  }>({ sample: false, measures: false, steps: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedStudies = parsedStudies.filter((study) => study.isSelected);
  const selectedCount = selectedStudies.length;
  const folderName = documentTitle || selectedFile?.name.replace(/\.pdf$/i, "") || "Imported Studies";

  const stopProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Reset everything whenever the modal opens or closes, and drop any parse
  // still in flight so a cancelled request can't repopulate the modal later.
  useEffect(() => {
    stopProgressTimer();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStage("upload");
    setSelectedFile(null);
    setFileError("");
    setParseError("");
    setParsedStudies([]);
    setDocumentTitle("");
    setCurrentStudyIndex(0);
    setParsingProgress(0);
    setIsImporting(false);
    setExpandedSections({ sample: false, measures: false, steps: false });
  }, [isOpen]);

  useEffect(
    () => () => {
      stopProgressTimer();
      abortControllerRef.current?.abort();
    },
    []
  );

  // Keep the carousel index valid if the selection changes underneath it
  useEffect(() => {
    if (currentStudyIndex > 0 && currentStudyIndex >= selectedCount) {
      setCurrentStudyIndex(Math.max(0, selectedCount - 1));
    }
  }, [selectedCount, currentStudyIndex]);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setFileError(`That PDF is too large. Maximum size is ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setFileError("");
    setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
    e.target.value = ""; // allow re-selecting the same file after removing it
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const showStudies = (studies: ParsedStudy[], docTitle: string) => {
    stopProgressTimer();
    setParsingProgress(100);
    setDocumentTitle(docTitle);
    setParsedStudies(studies);
    setCurrentStudyIndex(0);
    setStage("selection");
  };

  const startParsing = async () => {
    if (!selectedFile) return;

    setStage("parsing");
    setParseError("");
    setParsingProgress(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (USE_DUMMY_PARSE) {
      const startedAt = performance.now();
      stopProgressTimer();
      progressTimerRef.current = setInterval(async () => {
        const elapsed = performance.now() - startedAt;
        const pct = Math.min(100, (elapsed / DUMMY_PARSE_DURATION_MS) * 100);
        setParsingProgress(pct);
        if (pct >= 100) {
          stopProgressTimer();
          if (controller.signal.aborted) return;
          const { generateDummyParsedStudies } = await import("../data/dummyParsedStudies");
          if (controller.signal.aborted) return;
          showStudies(generateDummyParsedStudies(), "");
        }
      }, 100);
      return;
    }

    // The backend gives no incremental progress, so the bar eases toward 90%
    // while the request is in flight and only completes when it resolves.
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setParsingProgress((prev) => (prev >= 90 ? prev : prev + Math.max(1, (90 - prev) * 0.08)));
    }, 400);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (session?.user?.id) {
        formData.append("user_id", session.user.id);
      }

      const response = await fetch(getParsePdfUrl(), {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
        signal: controller.signal,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result || result.status !== "success") {
        throw new Error(result?.message || `Parsing failed (${response.status})`);
      }

      showStudies(
        toParsedStudies(result.data?.studies || []),
        (result.data?.document_title || "").trim()
      );
    } catch (error) {
      stopProgressTimer();
      // The modal was closed (or a new parse started) while this one was running
      if (controller.signal.aborted) return;
      console.error("Error parsing PDF:", error);
      setParseError(error instanceof Error ? error.message : "Unknown error while parsing the PDF.");
      setStage("error");
    }
  };

  const toggleStudySelection = (studyId: string) => {
    setParsedStudies((prev) =>
      prev.map((study) =>
        study.id === studyId ? { ...study, isSelected: !study.isSelected } : study
      )
    );
  };

  const setAllSelected = (isSelected: boolean) => {
    setParsedStudies((prev) => prev.map((study) => ({ ...study, isSelected })));
  };

  const proceedToReview = () => {
    if (selectedCount === 0) return;
    setCurrentStudyIndex(0);
    setExpandedSections({ sample: false, measures: false, steps: false });
    setStage("review");
  };

  const toggleSection = (section: "sample" | "measures" | "steps") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const currentStudy = selectedStudies[currentStudyIndex];

  // Apply an edit to the study currently shown in the carousel
  const updateCurrentStudy = (updater: (study: ParsedStudy) => ParsedStudy) => {
    if (!currentStudy) return;
    setParsedStudies((prev) =>
      prev.map((study) => (study.id === currentStudy.id ? updater(study) : study))
    );
  };

  const updateSampleAttribute = (attributeId: string, optionIds: string[]) => {
    updateCurrentStudy((study) => ({
      ...study,
      sample: {
        ...study.sample,
        attributes: study.sample.attributes.map((attribute) =>
          attribute.attributeId === attributeId ? { ...attribute, optionIds } : attribute
        ),
      },
    }));
  };

  const removeSampleAttribute = (attributeId: string) => {
    updateCurrentStudy((study) => ({
      ...study,
      sample: {
        ...study.sample,
        attributes: study.sample.attributes.filter(
          (attribute) => attribute.attributeId !== attributeId
        ),
      },
    }));
  };

  const addSampleAttribute = (attribute: Attribute) => {
    updateCurrentStudy((study) => ({
      ...study,
      sample: {
        ...study.sample,
        attributes: [...study.sample.attributes, { attributeId: attribute.id, optionIds: [] }],
      },
    }));
  };

  const updateMeasure = (measureIndex: number, updater: (measure: ParsedMeasure) => ParsedMeasure) => {
    updateCurrentStudy((study) => ({
      ...study,
      measures: study.measures.map((measure, index) =>
        index === measureIndex ? updater(measure) : measure
      ),
    }));
  };

  const updateStep = (stepIndex: number, updater: (step: ParsedStep) => ParsedStep) => {
    updateCurrentStudy((study) => ({
      ...study,
      steps: study.steps.map((step, index) => (index === stepIndex ? updater(step) : step)),
    }));
  };

  const goToNextStudy = () => {
    if (currentStudyIndex < selectedCount - 1) {
      setCurrentStudyIndex((prev) => prev + 1);
      setExpandedSections({ sample: false, measures: false, steps: false });
    } else {
      setStage("confirm");
    }
  };

  const goToPrevStudy = () => {
    if (currentStudyIndex > 0) {
      setCurrentStudyIndex((prev) => prev - 1);
      setExpandedSections({ sample: false, measures: false, steps: false });
    }
  };

  const handleImport = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      await onImport(folderName, selectedStudies);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const fieldClass =
    "w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0";

  const ageOptions = getAttributeById("age")?.options || [];

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {stage === "upload" && "Import Studies from PDF"}
              {stage === "parsing" && "Parsing PDF..."}
              {stage === "error" && "Parsing Failed"}
              {stage === "selection" &&
                `Select Studies to Import (${parsedStudies.length} found)`}
              {stage === "review" && `Review Study ${currentStudyIndex + 1} of ${selectedCount}`}
              {stage === "confirm" && "Confirm Import"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* UPLOAD STAGE */}
          {stage === "upload" && (
            <div className="space-y-6">
              <p className="text-gray-600">
                Upload a PDF containing research studies. We&apos;ll read the document and extract each
                study&apos;s sample, measures, and steps for you to review and edit before importing.
              </p>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Drop your PDF here or click to browse
                      </p>
                      <p className="text-sm text-gray-500">PDF files only, up to 20 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {fileError && <p className="text-sm text-red-600">{fileError}</p>}
            </div>
          )}

          {/* PARSING STAGE */}
          {stage === "parsing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Reading your PDF...</p>
              <p className="text-sm text-gray-500 mb-6">
                Finding studies and extracting their details.
              </p>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(parsingProgress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {Math.round(Math.min(parsingProgress, 100))}%
              </p>
            </div>
          )}

          {/* ERROR STAGE */}
          {stage === "error" && (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                We couldn&apos;t parse that PDF
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">{parseError}</p>
            </div>
          )}

          {/* SELECTION STAGE */}
          {stage === "selection" && (
            <div className="space-y-6">
              {parsedStudies.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No studies found</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    We couldn&apos;t find any empirical studies in this document. Try a PDF that
                    reports study procedures and measures.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-gray-600">
                        We found{" "}
                        <span className="font-semibold text-gray-900">
                          {parsedStudies.length}{" "}
                          {parsedStudies.length === 1 ? "study" : "studies"}
                        </span>{" "}
                        in your PDF.
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Select the studies you want to import. You can review and edit their details
                        in the next step.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setAllSelected(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 hover:bg-blue-50 rounded transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setAllSelected(false)}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {parsedStudies.map((study) => (
                      <div
                        key={study.id}
                        onClick={() => toggleStudySelection(study.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          study.isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {study.isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4
                              className={`font-medium ${
                                study.isSelected ? "text-gray-900" : "text-gray-700"
                              }`}
                            >
                              {study.title}
                            </h4>
                            {study.briefDescription && (
                              <p className="text-sm text-gray-500 mt-1">{study.briefDescription}</p>
                            )}
                            <div className="flex gap-4 mt-2 text-xs text-gray-400">
                              <span>{study.measures.length} measures</span>
                              <span>{study.steps.length} steps</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{selectedCount}</span> of{" "}
                      {parsedStudies.length} studies selected
                    </p>
                    {selectedCount === 0 && (
                      <p className="text-sm text-amber-600">Select at least one study to continue</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* REVIEW STAGE */}
          {stage === "review" && currentStudy && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Study Title</label>
                <Input
                  value={currentStudy.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateCurrentStudy((study) => ({ ...study, title: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Study Introduction
                </label>
                <Textarea
                  value={currentStudy.studyIntroduction}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    updateCurrentStudy((study) => ({
                      ...study,
                      studyIntroduction: e.target.value,
                    }))
                  }
                  rows={4}
                  className={`${fieldClass} resize-none`}
                />
              </div>

              {/* SAMPLE TOGGLE */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection("sample")}
                  className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">Sample</span>
                  {expandedSections.sample ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {expandedSections.sample && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Sample Name
                      </label>
                      <Input
                        value={currentStudy.sample.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateCurrentStudy((study) => ({
                            ...study,
                            sample: { ...study.sample, name: e.target.value },
                          }))
                        }
                        placeholder="e.g., Young Adult Social Media Users"
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-900">Attributes</label>
                        <AttributePicker
                          usedAttributeIds={currentStudy.sample.attributes.map((a) => a.attributeId)}
                          onSelect={addSampleAttribute}
                        />
                      </div>

                      {currentStudy.sample.attributes.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No attributes yet. Use Add Attribute to choose from the sample attribute
                          list.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {currentStudy.sample.attributes.map((selection) => {
                            const attribute = getAttributeById(selection.attributeId);
                            if (!attribute) return null;
                            const isAge = attribute.id === "age";
                            const [minAge, maxAge] = selection.optionIds;

                            return (
                              <div
                                key={selection.attributeId}
                                className="p-4 bg-gray-50 rounded-lg space-y-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs text-gray-500">{attribute.category}</div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {attribute.label}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSampleAttribute(selection.attributeId)}
                                    className="text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                {isAge ? (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        Min Age
                                      </label>
                                      <select
                                        value={minAge || ""}
                                        onChange={(e) =>
                                          updateSampleAttribute(attribute.id, [
                                            e.target.value,
                                            maxAge || e.target.value,
                                          ])
                                        }
                                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
                                      >
                                        <option value="">Select</option>
                                        {ageOptions.map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        Max Age
                                      </label>
                                      <select
                                        value={maxAge || ""}
                                        onChange={(e) =>
                                          updateSampleAttribute(attribute.id, [
                                            minAge || e.target.value,
                                            e.target.value,
                                          ])
                                        }
                                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
                                      >
                                        <option value="">Select</option>
                                        {ageOptions.map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ) : (
                                  <Multiselect
                                    options={(attribute.options || []).map((option) => ({
                                      id: option.id,
                                      title: option.label,
                                      description: "",
                                    }))}
                                    selectedValues={selection.optionIds}
                                    onSelectionChange={(optionIds) =>
                                      updateSampleAttribute(attribute.id, optionIds)
                                    }
                                    placeholder="Select values..."
                                    searchPlaceholder="Search values..."
                                    emptyLabel="No values found"
                                    className="w-full"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* MEASURES TOGGLE */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection("measures")}
                  className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">
                    Measures ({currentStudy.measures.length})
                  </span>
                  {expandedSections.measures ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {expandedSections.measures && (
                  <div className="p-4 space-y-6 border-t border-gray-200">
                    {currentStudy.measures.length === 0 && (
                      <p className="text-sm text-gray-400">No measures were found for this study.</p>
                    )}
                    {currentStudy.measures.map((measure, mIdx) => (
                      <div key={measure.id} className="p-4 bg-gray-50 rounded-lg space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Title
                          </label>
                          <Input
                            value={measure.title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateMeasure(mIdx, (m) => ({ ...m, title: e.target.value }))
                            }
                            placeholder="e.g., Customer Satisfaction"
                            className={`${fieldClass} bg-white`}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Definition
                          </label>
                          <Textarea
                            value={measure.definition}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              updateMeasure(mIdx, (m) => ({ ...m, definition: e.target.value }))
                            }
                            maxLength={MEASURE_DEFINITION_MAX_CHARS}
                            rows={3}
                            placeholder="Describe what this measure tracks (max 200 characters)..."
                            className={`${fieldClass} bg-white resize-none`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                              Min Value
                            </label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={measure.minValue}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateMeasure(mIdx, (m) => ({
                                  ...m,
                                  minValue: Number(e.target.value.replace(/[^\d-]/g, "") || 0),
                                }))
                              }
                              className={`${fieldClass} bg-white`}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                              Max Value
                            </label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={measure.maxValue}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateMeasure(mIdx, (m) => ({
                                  ...m,
                                  maxValue: Number(e.target.value.replace(/[^\d-]/g, "") || 0),
                                }))
                              }
                              className={`${fieldClass} bg-white`}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold text-gray-900">
                              Anchor Points
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                updateMeasure(mIdx, (m) => ({
                                  ...m,
                                  valueAnchors: [...m.valueAnchors, { value: m.minValue, label: "" }],
                                }))
                              }
                              className="text-sm font-medium flex items-center gap-1"
                            >
                              <Plus className="h-4 w-4" />
                              Add Anchor
                            </Button>
                          </div>

                          {measure.valueAnchors.length > 0 && (
                            <div className="space-y-3">
                              {measure.valueAnchors.map((anchor, aIdx) => (
                                <div key={aIdx} className="grid grid-cols-2 gap-4 items-end">
                                  <div>
                                    {aIdx === 0 && (
                                      <label className="block text-xs text-gray-500 mb-1">Value</label>
                                    )}
                                    <Input
                                      type="number"
                                      value={anchor.value}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        updateMeasure(mIdx, (m) => ({
                                          ...m,
                                          valueAnchors: m.valueAnchors.map((a, i) =>
                                            i === aIdx
                                              ? { ...a, value: Number(e.target.value || 0) }
                                              : a
                                          ),
                                        }))
                                      }
                                      className={`${fieldClass} bg-white`}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      {aIdx === 0 && (
                                        <label className="block text-xs text-gray-500 mb-1">
                                          Label
                                        </label>
                                      )}
                                      <Input
                                        value={anchor.label}
                                        placeholder="Label"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                          updateMeasure(mIdx, (m) => ({
                                            ...m,
                                            valueAnchors: m.valueAnchors.map((a, i) =>
                                              i === aIdx ? { ...a, label: e.target.value } : a
                                            ),
                                          }))
                                        }
                                        className={`${fieldClass} bg-white`}
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() =>
                                        updateMeasure(mIdx, (m) => ({
                                          ...m,
                                          valueAnchors: m.valueAnchors.filter((_, i) => i !== aIdx),
                                        }))
                                      }
                                      className="text-red-600 hover:bg-red-50 self-end"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STEPS TOGGLE */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection("steps")}
                  className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">
                    Steps ({currentStudy.steps.length})
                  </span>
                  {expandedSections.steps ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {expandedSections.steps && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    {currentStudy.steps.map((step, sIdx) => (
                      <div key={step.id} className="p-4 bg-gray-50 rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                            {sIdx + 1}
                          </span>
                        </div>

                        <div>
                          <label className="text-base font-medium text-muted-foreground mb-1.5 block">
                            Name
                          </label>
                          <Input
                            value={step.label}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              updateStep(sIdx, (s) => ({ ...s, label: e.target.value }))
                            }
                            placeholder="Click to add step name..."
                            className="text-base bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-base font-medium text-muted-foreground mb-1.5 block">
                            Instructions
                          </label>
                          <Textarea
                            value={step.instruction}
                            maxLength={STEP_INSTRUCTION_MAX_CHARS}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                              updateStep(sIdx, (s) => ({ ...s, instruction: e.target.value }))
                            }
                            placeholder="Click to add step instructions..."
                            className="text-base w-full resize-none bg-white min-h-[120px]"
                          />
                          <div className="text-sm text-muted-foreground mt-1 text-right">
                            {step.instruction.length}/{STEP_INSTRUCTION_MAX_CHARS}
                          </div>
                        </div>

                        <div>
                          <label className="text-base font-medium text-muted-foreground mb-1.5 block">
                            Temperature: {step.temperature}
                          </label>
                          <Slider
                            value={[step.temperature]}
                            onValueChange={(value: number[]) =>
                              updateStep(sIdx, (s) => ({ ...s, temperature: value[0] }))
                            }
                            max={100}
                            min={1}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="text-base font-medium text-muted-foreground mb-1.5 block">
                            Measures
                          </label>
                          <Multiselect
                            options={currentStudy.measures.map((measure) => ({
                              id: measure.id,
                              title: measure.title || "Untitled measure",
                              description: measure.definition,
                            }))}
                            selectedValues={step.measureIds}
                            onSelectionChange={(measureIds) =>
                              updateStep(sIdx, (s) => ({ ...s, measureIds }))
                            }
                            placeholder="Select measures..."
                            className="w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Carousel navigation */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={goToPrevStudy}
                  disabled={currentStudyIndex === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    currentStudyIndex === 0
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </button>
                <div className="flex gap-2">
                  {selectedStudies.map((study, idx) => (
                    <button
                      key={study.id}
                      onClick={() => {
                        setCurrentStudyIndex(idx);
                        setExpandedSections({ sample: false, measures: false, steps: false });
                      }}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        idx === currentStudyIndex ? "bg-blue-600" : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={goToNextStudy}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  {currentStudyIndex === selectedCount - 1 ? "Finish Review" : "Next"}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* CONFIRM STAGE */}
          {stage === "confirm" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Import</h3>
              <p className="text-gray-600 mb-6">
                You&apos;ve reviewed {selectedCount} {selectedCount === 1 ? "study" : "studies"} from
                your PDF.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                <p className="text-sm text-gray-600 mb-2">A new folder will be created:</p>
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600" />
                  {folderName}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Containing {selectedCount} {selectedCount === 1 ? "simulation" : "simulations"}
                </p>
              </div>
              <div className="space-y-2 max-w-md mx-auto text-left">
                {selectedStudies.map((study) => (
                  <div key={study.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500" />
                    {study.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {stage === "upload" && (
            <>
              <Button onClick={onClose} variant="outline" className="px-4 py-2">
                Cancel
              </Button>
              <Button
                onClick={startParsing}
                disabled={!selectedFile}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse PDF
              </Button>
            </>
          )}
          {stage === "parsing" && (
            <Button onClick={onClose} variant="outline" className="px-4 py-2">
              Cancel
            </Button>
          )}
          {stage === "error" && (
            <>
              <Button onClick={onClose} variant="outline" className="px-4 py-2">
                Close
              </Button>
              <Button
                onClick={() => setStage("upload")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Try Again
              </Button>
            </>
          )}
          {stage === "selection" && (
            <>
              <Button onClick={onClose} variant="outline" className="px-4 py-2">
                Cancel
              </Button>
              {parsedStudies.length > 0 && (
                <Button
                  onClick={proceedToReview}
                  disabled={selectedCount === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review Selected ({selectedCount})
                </Button>
              )}
            </>
          )}
          {stage === "review" && (
            <>
              <Button onClick={() => setStage("selection")} variant="outline" className="px-4 py-2">
                Back to Selection
              </Button>
              <Button onClick={onClose} variant="outline" className="px-4 py-2">
                Cancel Import
              </Button>
            </>
          )}
          {stage === "confirm" && (
            <>
              <Button
                onClick={() => {
                  setStage("review");
                  setCurrentStudyIndex(Math.max(0, selectedCount - 1));
                }}
                variant="outline"
                className="px-4 py-2"
                disabled={isImporting}
              >
                Back to Review
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </span>
                ) : (
                  "Import All Studies"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
