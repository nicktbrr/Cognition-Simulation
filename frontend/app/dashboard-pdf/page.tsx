"use client";

import React, { useEffect, useState, useRef } from "react";
import { Play, Trash2, Folder, FolderPlus, FileUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Upload, X, Loader2, Check, FileText, Square, CheckSquare, MoreHorizontal, Download, Edit3, Copy, RefreshCw, FolderInput } from "lucide-react";
import { createPortal } from "react-dom";

// ============================================================================
// PDF IMPORT TYPES
// ============================================================================

interface ValueAnchor {
  value: number;
  label: string;
}

interface ParsedMeasure {
  id: string;
  title: string;
  definition: string;
  minValue: number;
  maxValue: number;
  valueAnchors: ValueAnchor[];
}

interface ParsedStep {
  id: string;
  label: string;
  instruction: string;
  measureIds: string[];
}

interface ParsedSampleAttribute {
  name: string;
  value: string;
}

interface ParsedSample {
  name: string;
  attributes: ParsedSampleAttribute[];
}

interface ParsedStudy {
  id: string;
  title: string;
  briefDescription: string;
  studyIntroduction: string;
  sample: ParsedSample;
  measures: ParsedMeasure[];
  steps: ParsedStep[];
  isSelected: boolean;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

interface MockFolder {
  folder_id: string;
  folder_name: string;
  created_at: string;
  project_count: number;
}

interface MockProject {
  id: string;
  name: string;
  sample_name: string;
  sample_size: number;
  status: "Draft" | "Running" | "Completed" | "Failed";
  progress?: number;
  created_at: string;
  folder_id: string | null;
  text_model: string;
  evaluations_model: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockFolders: MockFolder[] = [
  { folder_id: "f1", folder_name: "Research Studies", created_at: "2024-01-15", project_count: 3 },
  { folder_id: "f2", folder_name: "Consumer Behavior", created_at: "2024-01-10", project_count: 2 },
];

const mockProjects: MockProject[] = [
  { id: "p1", name: "Social Media Well-being Study", sample_name: "Young Adults 18-25", sample_size: 100, status: "Completed", created_at: "2024-01-20", folder_id: "f1", text_model: "gemini", evaluations_model: "gemini" },
  { id: "p2", name: "Decision Making Under Uncertainty", sample_name: "General Adults", sample_size: 50, status: "Running", progress: 65, created_at: "2024-01-19", folder_id: "f1", text_model: "gpt-4", evaluations_model: "gemini" },
  { id: "p3", name: "Workplace Collaboration", sample_name: "Knowledge Workers", sample_size: 75, status: "Draft", created_at: "2024-01-18", folder_id: "f1", text_model: "gemini", evaluations_model: "gemini" },
  { id: "p4", name: "Product Preferences Survey", sample_name: "Eco-conscious Consumers", sample_size: 200, status: "Completed", created_at: "2024-01-17", folder_id: "f2", text_model: "gemini", evaluations_model: "gpt-4" },
  { id: "p5", name: "Brand Perception Analysis", sample_name: "Mixed Demographics", sample_size: 150, status: "Failed", created_at: "2024-01-16", folder_id: "f2", text_model: "gemini", evaluations_model: "gemini" },
  { id: "p6", name: "Untitled Simulation", sample_name: "No seed", sample_size: 10, status: "Draft", created_at: "2024-01-15", folder_id: null, text_model: "gemini", evaluations_model: "gemini" },
];

const generateMockParsedStudies = (pdfName: string): ParsedStudy[] => {
  return [
    {
      id: "study-1",
      title: "Social Media Usage and Psychological Well-being",
      briefDescription: "Examines the relationship between daily social media usage patterns and psychological well-being indicators among young adults aged 18-25, focusing on depression, anxiety, and life satisfaction outcomes.",
      studyIntroduction: "Welcome to our study on social media and well-being. In this research, we are investigating how different patterns of social media use relate to psychological health outcomes. You will be asked about your daily social media habits, the platforms you use most frequently, and how you feel about various aspects of your life. Your responses will help us understand the complex relationship between digital engagement and mental health in young adults.",
      isSelected: true,
      sample: {
        name: "Young Adults Social Media Users",
        attributes: [
          { name: "Age Range", value: "18-25 years old" },
          { name: "Location", value: "United States (all regions)" },
          { name: "Social Media Usage", value: "Active daily users (2+ hours/day)" },
          { name: "Platform Requirements", value: "Use at least 2 major platforms" },
        ],
      },
      measures: [
        {
          id: "m1",
          title: "Life Satisfaction Scale",
          definition: "A measure of overall cognitive evaluation of one's life satisfaction across multiple domains including work, relationships, and personal growth",
          minValue: 1,
          maxValue: 7,
          valueAnchors: [
            { value: 1, label: "Strongly disagree - Very dissatisfied with life" },
            { value: 4, label: "Neither agree nor disagree - Neutral" },
            { value: 7, label: "Strongly agree - Highly satisfied with life" },
          ],
        },
        {
          id: "m2",
          title: "Social Connectedness Index",
          definition: "Measures the subjective sense of belonging and interpersonal closeness experienced in social relationships both online and offline",
          minValue: 1,
          maxValue: 5,
          valueAnchors: [
            { value: 1, label: "Very disconnected - Feel isolated" },
            { value: 3, label: "Moderately connected" },
            { value: 5, label: "Highly connected - Strong sense of belonging" },
          ],
        },
        {
          id: "m3",
          title: "Fear of Missing Out (FOMO)",
          definition: "Assesses anxiety related to missing rewarding experiences that others might be having, particularly as observed through social media",
          minValue: 1,
          maxValue: 5,
          valueAnchors: [
            { value: 1, label: "No FOMO - Never worried about missing out" },
            { value: 3, label: "Moderate FOMO" },
            { value: 5, label: "Severe FOMO - Constantly worried" },
          ],
        },
      ],
      steps: [
        { id: "s1", label: "Introduction & Informed Consent", instruction: "Present the study overview explaining the purpose, procedures, risks, and benefits. Obtain informed consent before proceeding. Remind participants they can withdraw at any time.", measureIds: [] },
        { id: "s2", label: "Demographics Collection", instruction: "Gather basic demographic information including age, gender, education level, employment status, and geographic location.", measureIds: [] },
        { id: "s3", label: "Social Media Usage Assessment", instruction: "Ask participants about their daily social media usage patterns: which platforms they use, time spent on each, types of activities (browsing, posting, messaging), and frequency of checking.", measureIds: ["m3"] },
        { id: "s4", label: "Well-being Measures", instruction: "Administer the standardized well-being scales to assess current life satisfaction, social connectedness, and psychological health indicators.", measureIds: ["m1", "m2"] },
        { id: "s5", label: "Debrief & Closing", instruction: "Thank participants for their time, provide resources for mental health support if needed, and explain how their data will be used.", measureIds: [] },
      ],
    },
    {
      id: "study-2",
      title: "Decision Making Under Uncertainty and Risk",
      briefDescription: "Investigates cognitive processes and emotional factors influencing decision-making when individuals face uncertain outcomes, using hypothetical financial and health scenarios.",
      studyIntroduction: "This research explores how people make decisions when outcomes are uncertain. You will be presented with various hypothetical scenarios involving choices between options with different levels of risk and reward. We are interested in understanding the thought processes, emotions, and strategies people use when making these decisions. There are no right or wrong answers - we want to understand your natural decision-making approach.",
      isSelected: true,
      sample: {
        name: "General Adult Decision Makers",
        attributes: [
          { name: "Age Range", value: "25-65 years old" },
          { name: "Education Level", value: "High school diploma or above" },
          { name: "Employment Status", value: "Currently employed or retired" },
          { name: "Financial Literacy", value: "Basic understanding of probability" },
        ],
      },
      measures: [
        {
          id: "m1",
          title: "Risk Tolerance Assessment",
          definition: "Measures an individual's willingness to accept variability in outcomes and potential losses in pursuit of higher potential gains",
          minValue: 0,
          maxValue: 10,
          valueAnchors: [
            { value: 0, label: "Extremely risk averse - Avoid all uncertainty" },
            { value: 5, label: "Moderate - Balanced approach to risk" },
            { value: 10, label: "High risk seeking - Embrace uncertainty" },
          ],
        },
        {
          id: "m2",
          title: "Decision Confidence Rating",
          definition: "Self-reported confidence level in one's ability to make good decisions under conditions of uncertainty",
          minValue: 1,
          maxValue: 7,
          valueAnchors: [
            { value: 1, label: "Not at all confident in my decisions" },
            { value: 4, label: "Somewhat confident" },
            { value: 7, label: "Extremely confident in my judgment" },
          ],
        },
        {
          id: "m3",
          title: "Anticipated Regret Scale",
          definition: "Measures the expected emotional impact of potential negative outcomes and how much anticipated regret influences current choices",
          minValue: 1,
          maxValue: 5,
          valueAnchors: [
            { value: 1, label: "No anticipated regret" },
            { value: 3, label: "Moderate concern about regret" },
            { value: 5, label: "Severe anticipated regret" },
          ],
        },
      ],
      steps: [
        { id: "s1", label: "Study Introduction", instruction: "Explain the purpose of studying decision-making and describe what participants will be doing. Emphasize there are no right or wrong answers.", measureIds: [] },
        { id: "s2", label: "Baseline Risk Assessment", instruction: "Administer initial risk tolerance questionnaire to establish participant's general risk preferences before presenting scenarios.", measureIds: ["m1"] },
        { id: "s3", label: "Financial Scenarios", instruction: "Present 5 hypothetical financial decision scenarios with varying levels of risk and potential outcomes. Ask participants to choose and explain their reasoning.", measureIds: ["m1", "m2", "m3"] },
        { id: "s4", label: "Health Decision Scenarios", instruction: "Present 3 hypothetical health-related decision scenarios involving treatment options with different risk profiles.", measureIds: ["m1", "m2", "m3"] },
        { id: "s5", label: "Reflection & Post-Assessment", instruction: "Ask participants to reflect on their decision-making process and complete post-scenario confidence and regret assessments.", measureIds: ["m2", "m3"] },
      ],
    },
    {
      id: "study-3",
      title: "Sustainable Consumer Behavior Analysis",
      briefDescription: "Explores factors driving consumer preferences for eco-friendly and sustainable products, examining the gap between environmental attitudes and actual purchasing behavior.",
      studyIntroduction: "Thank you for participating in our consumer behavior study. We are researching how people think about and choose sustainable products. You will be shown various product options and asked about your preferences, purchasing intentions, and the factors that influence your choices. We are particularly interested in understanding the trade-offs consumers make between sustainability, price, and convenience.",
      isSelected: true,
      sample: {
        name: "Environmentally-Aware Consumers",
        attributes: [
          { name: "Shopping Frequency", value: "Makes purchases weekly or more" },
          { name: "Environmental Awareness", value: "Moderate to high concern for environment" },
          { name: "Income Level", value: "Middle to upper-middle income" },
          { name: "Age Range", value: "25-55 years old" },
        ],
      },
      measures: [
        {
          id: "m1",
          title: "Purchase Intent Rating",
          definition: "Likelihood of purchasing a sustainable product option when presented alongside conventional alternatives at various price points",
          minValue: 1,
          maxValue: 7,
          valueAnchors: [
            { value: 1, label: "Definitely would NOT purchase" },
            { value: 4, label: "Might purchase - Undecided" },
            { value: 7, label: "Definitely WOULD purchase" },
          ],
        },
        {
          id: "m2",
          title: "Price Premium Tolerance",
          definition: "Maximum percentage price increase a consumer is willing to pay for a sustainable version of a product",
          minValue: 0,
          maxValue: 100,
          valueAnchors: [
            { value: 0, label: "0% - Not willing to pay any premium" },
            { value: 25, label: "25% premium acceptable" },
            { value: 50, label: "50% premium acceptable" },
            { value: 100, label: "100%+ - Will pay double or more" },
          ],
        },
        {
          id: "m3",
          title: "Environmental Impact Importance",
          definition: "How much weight environmental considerations carry in the overall purchase decision process",
          minValue: 1,
          maxValue: 5,
          valueAnchors: [
            { value: 1, label: "Not important at all" },
            { value: 3, label: "Moderately important" },
            { value: 5, label: "Extremely important - Primary factor" },
          ],
        },
      ],
      steps: [
        { id: "s1", label: "Consumer Profile", instruction: "Gather information about participant's general shopping habits, brand preferences, and environmental attitudes.", measureIds: ["m3"] },
        { id: "s2", label: "Product Comparisons", instruction: "Show pairs of products (sustainable vs. conventional) and collect preference ratings and reasoning for each category.", measureIds: ["m1", "m2"] },
        { id: "s3", label: "Price Sensitivity Testing", instruction: "Present products at various price points to determine willingness to pay premium for sustainable options.", measureIds: ["m1", "m2"] },
        { id: "s4", label: "Behavioral Intentions", instruction: "Assess future behavioral intentions and likelihood of changing current purchasing patterns.", measureIds: ["m1", "m3"] },
      ],
    },
    {
      id: "study-4",
      title: "Remote Work Productivity and Satisfaction",
      briefDescription: "Analyzes the impact of remote work arrangements on employee productivity, job satisfaction, work-life balance, and collaboration effectiveness compared to traditional office settings.",
      studyIntroduction: "This study examines how remote work affects various aspects of professional life. As someone who has experience with remote work, your insights are valuable for understanding the benefits and challenges of this work arrangement. You will be asked about your productivity levels, satisfaction with your work situation, and how you collaborate with colleagues. Your responses will help organizations better support remote workers.",
      isSelected: true,
      sample: {
        name: "Remote Knowledge Workers",
        attributes: [
          { name: "Work Arrangement", value: "Fully remote or hybrid (3+ days remote)" },
          { name: "Experience Level", value: "2+ years in current role" },
          { name: "Industry", value: "Technology, Finance, or Professional Services" },
          { name: "Team Size", value: "Works with team of 5+ people" },
        ],
      },
      measures: [
        {
          id: "m1",
          title: "Perceived Productivity",
          definition: "Self-assessment of work output and efficiency compared to working in a traditional office environment",
          minValue: 1,
          maxValue: 10,
          valueAnchors: [
            { value: 1, label: "Much less productive remotely" },
            { value: 5, label: "About the same productivity" },
            { value: 10, label: "Much more productive remotely" },
          ],
        },
        {
          id: "m2",
          title: "Work-Life Balance Satisfaction",
          definition: "Satisfaction with the ability to balance professional responsibilities with personal life and well-being",
          minValue: 1,
          maxValue: 7,
          valueAnchors: [
            { value: 1, label: "Very poor balance - Major struggles" },
            { value: 4, label: "Adequate balance" },
            { value: 7, label: "Excellent balance - Very satisfied" },
          ],
        },
        {
          id: "m3",
          title: "Collaboration Effectiveness",
          definition: "Assessment of how well remote tools and practices support teamwork and communication",
          minValue: 1,
          maxValue: 5,
          valueAnchors: [
            { value: 1, label: "Very ineffective - Major barriers" },
            { value: 3, label: "Moderately effective" },
            { value: 5, label: "Highly effective - Seamless collaboration" },
          ],
        },
      ],
      steps: [
        { id: "s1", label: "Work Context Assessment", instruction: "Collect information about participant's current work arrangement, tools used, and typical workday structure.", measureIds: [] },
        { id: "s2", label: "Productivity Evaluation", instruction: "Assess perceived productivity levels, factors that help or hinder work output, and comparison to office-based work.", measureIds: ["m1"] },
        { id: "s3", label: "Work-Life Integration", instruction: "Explore how remote work affects personal life, boundaries between work and home, and overall life satisfaction.", measureIds: ["m2"] },
        { id: "s4", label: "Collaboration Assessment", instruction: "Evaluate team communication, meeting effectiveness, and collaborative project work in remote setting.", measureIds: ["m3"] },
        { id: "s5", label: "Future Preferences", instruction: "Gather preferences for future work arrangements and suggestions for improving remote work experience.", measureIds: ["m1", "m2", "m3"] },
      ],
    },
    {
      id: "study-5",
      title: "Health Behavior Change Motivation",
      briefDescription: "Investigates psychological factors and motivational strategies that influence adoption and maintenance of healthy behaviors including exercise, nutrition, and stress management.",
      studyIntroduction: "We are studying what motivates people to adopt and maintain healthy behaviors. This research will help us understand the psychological factors that make behavior change challenging and identify strategies that work for different people. You will be asked about your current health behaviors, your motivations for change, and barriers you have encountered. Your honest responses will contribute to developing better health interventions.",
      isSelected: false,
      sample: {
        name: "Adults Seeking Health Improvement",
        attributes: [
          { name: "Age Range", value: "30-60 years old" },
          { name: "Health Goal", value: "Currently trying to improve at least one health behavior" },
          { name: "BMI Range", value: "Overweight or obese (BMI 25+)" },
          { name: "Prior Attempts", value: "Has tried behavior change in past 2 years" },
        ],
      },
      measures: [
        {
          id: "m1",
          title: "Intrinsic Motivation",
          definition: "Internal drive to engage in healthy behaviors for personal satisfaction, enjoyment, or value alignment rather than external rewards",
          minValue: 1,
          maxValue: 7,
          valueAnchors: [
            { value: 1, label: "No intrinsic motivation" },
            { value: 4, label: "Moderate internal drive" },
            { value: 7, label: "Highly intrinsically motivated" },
          ],
        },
        {
          id: "m2",
          title: "Self-Efficacy for Change",
          definition: "Confidence in one's ability to successfully adopt and maintain healthy behavior changes despite obstacles",
          minValue: 1,
          maxValue: 10,
          valueAnchors: [
            { value: 1, label: "Not at all confident" },
            { value: 5, label: "Moderately confident" },
            { value: 10, label: "Completely confident" },
          ],
        },
        {
          id: "m3",
          title: "Perceived Barriers",
          definition: "Assessment of obstacles and challenges that interfere with adopting or maintaining healthy behaviors",
          minValue: 1,
          maxValue: 5,
          valueAnchors: [
            { value: 1, label: "Few/minor barriers" },
            { value: 3, label: "Moderate barriers" },
            { value: 5, label: "Severe barriers - Major obstacles" },
          ],
        },
      ],
      steps: [
        { id: "s1", label: "Current Health Assessment", instruction: "Gather information about participant's current health behaviors, including exercise frequency, dietary habits, sleep patterns, and stress levels.", measureIds: [] },
        { id: "s2", label: "Goal Identification", instruction: "Identify specific health goals the participant wants to achieve and timeline expectations.", measureIds: ["m1"] },
        { id: "s3", label: "Motivation Analysis", instruction: "Explore the reasons behind wanting to change, both intrinsic (personal values) and extrinsic (social pressure, health concerns).", measureIds: ["m1", "m2"] },
        { id: "s4", label: "Barrier Assessment", instruction: "Identify specific barriers to change including time constraints, lack of knowledge, social factors, and environmental challenges.", measureIds: ["m3", "m2"] },
        { id: "s5", label: "Strategy Development", instruction: "Work with participant to identify potential strategies for overcoming barriers and maintaining motivation.", measureIds: ["m1", "m2", "m3"] },
      ],
    },
  ];
};

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
  children: React.ReactNode;
}

function Button({ variant = "default", className = "", children, ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700",
  };
  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ============================================================================
// PDF IMPORT MODAL COMPONENT
// ============================================================================

interface PDFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (folderName: string, studies: ParsedStudy[]) => void;
}

type ImportStage = 'upload' | 'parsing' | 'selection' | 'review' | 'confirm';

function PDFImportModal({ isOpen, onClose, onImportComplete }: PDFImportModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedStudies, setParsedStudies] = useState<ParsedStudy[]>([]);
  const [currentStudyIndex, setCurrentStudyIndex] = useState(0);
  const [parsingProgress, setParsingProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ sample: boolean; measures: boolean; steps: boolean }>({ sample: false, measures: false, steps: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedStudies = parsedStudies.filter(s => s.isSelected);
  const selectedCount = selectedStudies.length;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) {
      setStage('upload');
      setSelectedFile(null);
      setParsedStudies([]);
      setCurrentStudyIndex(0);
      setParsingProgress(0);
      setExpandedSections({ sample: false, measures: false, steps: false });
    }
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') setSelectedFile(file);
    else alert('Please select a valid PDF file');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') setSelectedFile(file);
    else alert('Please drop a valid PDF file');
  };

  const startParsing = () => {
    if (!selectedFile) return;
    setStage('parsing');
    setParsingProgress(0);
    const interval = setInterval(() => {
      setParsingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setParsedStudies(generateMockParsedStudies(selectedFile.name));
          setStage('selection');
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 300);
  };

  const toggleStudySelection = (studyId: string) => {
    setParsedStudies(prev => prev.map(study => study.id === studyId ? { ...study, isSelected: !study.isSelected } : study));
  };

  const toggleSection = (section: 'sample' | 'measures' | 'steps') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getCurrentStudyFromSelected = () => selectedStudies[currentStudyIndex];
  const getActualStudyIndex = (selectedIndex: number) => {
    const study = selectedStudies[selectedIndex];
    return parsedStudies.findIndex(s => s.id === study?.id);
  };

  const updateStudyField = (field: string, value: string) => {
    const actualIndex = getActualStudyIndex(currentStudyIndex);
    if (actualIndex === -1) return;
    setParsedStudies(prev => {
      const updated = [...prev];
      if (field === 'title') updated[actualIndex].title = value;
      else if (field === 'studyIntroduction') updated[actualIndex].studyIntroduction = value;
      return updated;
    });
  };

  const updateSampleField = (field: string, value: string, attrIndex?: number) => {
    const actualIndex = getActualStudyIndex(currentStudyIndex);
    if (actualIndex === -1) return;
    setParsedStudies(prev => {
      const updated = [...prev];
      if (field === 'name') updated[actualIndex].sample.name = value;
      else if (field === 'attribute' && attrIndex !== undefined) updated[actualIndex].sample.attributes[attrIndex].value = value;
      else if (field === 'attributeName' && attrIndex !== undefined) updated[actualIndex].sample.attributes[attrIndex].name = value;
      return updated;
    });
  };

  const updateMeasure = (measureIndex: number, field: string, value: string | number, anchorIndex?: number) => {
    const actualIndex = getActualStudyIndex(currentStudyIndex);
    if (actualIndex === -1) return;
    setParsedStudies(prev => {
      const updated = [...prev];
      const measure = updated[actualIndex].measures[measureIndex];
      if (field === 'title') measure.title = value as string;
      else if (field === 'definition') measure.definition = value as string;
      else if (field === 'minValue') measure.minValue = Number(value);
      else if (field === 'maxValue') measure.maxValue = Number(value);
      else if (field === 'anchorValue' && anchorIndex !== undefined) measure.valueAnchors[anchorIndex].value = Number(value);
      else if (field === 'anchorLabel' && anchorIndex !== undefined) measure.valueAnchors[anchorIndex].label = value as string;
      return updated;
    });
  };

  const updateStep = (stepIndex: number, field: string, value: string) => {
    const actualIndex = getActualStudyIndex(currentStudyIndex);
    if (actualIndex === -1) return;
    setParsedStudies(prev => {
      const updated = [...prev];
      const step = updated[actualIndex].steps[stepIndex];
      if (field === 'label') step.label = value;
      else if (field === 'instruction') step.instruction = value;
      return updated;
    });
  };

  const goToNextStudy = () => {
    if (currentStudyIndex < selectedStudies.length - 1) {
      setCurrentStudyIndex(prev => prev + 1);
      setExpandedSections({ sample: false, measures: false, steps: false });
    } else setStage('confirm');
  };

  const goToPrevStudy = () => {
    if (currentStudyIndex > 0) {
      setCurrentStudyIndex(prev => prev - 1);
      setExpandedSections({ sample: false, measures: false, steps: false });
    }
  };

  const handleImport = () => {
    const folderName = selectedFile?.name.replace('.pdf', '') || 'Imported Studies';
    onImportComplete(folderName, selectedStudies);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const currentStudy = getCurrentStudyFromSelected();

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {stage === 'upload' && 'Import Studies from PDF'}
              {stage === 'parsing' && 'Parsing PDF...'}
              {stage === 'selection' && `Select Studies to Import (${parsedStudies.length} found)`}
              {stage === 'review' && `Review Study ${currentStudyIndex + 1} of ${selectedCount}`}
              {stage === 'confirm' && 'Confirm Import'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {stage === 'upload' && (
            <div className="space-y-6">
              <p className="text-gray-600">Upload a PDF file containing research studies. We'll parse the document and extract study details for you to review and edit before importing.</p>
              <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"><Check className="w-6 h-6 text-green-600" /></div>
                    <div><p className="font-medium text-gray-900">{selectedFile.name}</p><p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p></div>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-sm text-red-600 hover:text-red-700">Remove file</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center"><Upload className="w-6 h-6 text-gray-400" /></div>
                    <div><p className="font-medium text-gray-900">Drop your PDF here or click to browse</p><p className="text-sm text-gray-500">Supports PDF files only</p></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Parsing your PDF...</p>
              <p className="text-sm text-gray-500 mb-6">This may take a moment</p>
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300 rounded-full" style={{ width: `${Math.min(parsingProgress, 100)}%` }} /></div>
              <p className="text-sm text-gray-500 mt-2">{Math.round(Math.min(parsingProgress, 100))}%</p>
            </div>
          )}

          {stage === 'selection' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div><p className="text-gray-600">We found <span className="font-semibold text-gray-900">{parsedStudies.length} studies</span> in your PDF.</p><p className="text-sm text-gray-500 mt-1">Select the studies you want to import.</p></div>
                <div className="flex gap-2">
                  <button onClick={() => setParsedStudies(prev => prev.map(s => ({ ...s, isSelected: true })))} className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 hover:bg-blue-50 rounded">Select All</button>
                  <button onClick={() => setParsedStudies(prev => prev.map(s => ({ ...s, isSelected: false })))} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 hover:bg-gray-100 rounded">Deselect All</button>
                </div>
              </div>
              <div className="space-y-3">
                {parsedStudies.map((study) => (
                  <div key={study.id} onClick={() => toggleStudySelection(study.id)} className={`p-4 border rounded-lg cursor-pointer transition-all ${study.isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{study.isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}</div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${study.isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{study.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">{study.briefDescription}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400"><span>{study.measures.length} measures</span><span>{study.steps.length} steps</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <p className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{selectedCount}</span> of {parsedStudies.length} studies selected</p>
                {selectedCount === 0 && <p className="text-sm text-amber-600">Select at least one study to continue</p>}
              </div>
            </div>
          )}

          {stage === 'review' && currentStudy && (
            <div className="space-y-6">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Study Title</label><input type="text" value={currentStudy.title} onChange={(e) => updateStudyField('title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Study Introduction</label><textarea value={currentStudy.studyIntroduction} onChange={(e) => updateStudyField('studyIntroduction', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => toggleSection('sample')} className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100"><span className="font-medium text-gray-900">Sample</span>{expandedSections.sample ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}</button>
                {expandedSections.sample && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Sample Name</label><input type="text" value={currentStudy.sample.name} onChange={(e) => updateSampleField('name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-2">Sample Attributes</label>
                      <div className="space-y-2">{currentStudy.sample.attributes.map((attr, idx) => (<div key={idx} className="flex gap-2"><input type="text" value={attr.name} onChange={(e) => updateSampleField('attributeName', e.target.value, idx)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" /><input type="text" value={attr.value} onChange={(e) => updateSampleField('attribute', e.target.value, idx)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>))}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => toggleSection('measures')} className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100"><span className="font-medium text-gray-900">Measures ({currentStudy.measures.length})</span>{expandedSections.measures ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}</button>
                {expandedSections.measures && (
                  <div className="p-4 space-y-6 border-t border-gray-200">
                    {currentStudy.measures.map((measure, mIdx) => (
                      <div key={measure.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Title</label><input type="text" value={measure.title} onChange={(e) => updateMeasure(mIdx, 'title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Definition</label><textarea value={measure.definition} onChange={(e) => updateMeasure(mIdx, 'definition', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" /></div>
                        <div className="flex gap-3"><div className="w-24"><label className="block text-xs font-medium text-gray-500 mb-1">Min</label><input type="number" value={measure.minValue} onChange={(e) => updateMeasure(mIdx, 'minValue', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div><div className="w-24"><label className="block text-xs font-medium text-gray-500 mb-1">Max</label><input type="number" value={measure.maxValue} onChange={(e) => updateMeasure(mIdx, 'maxValue', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => toggleSection('steps')} className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100"><span className="font-medium text-gray-900">Steps ({currentStudy.steps.length})</span>{expandedSections.steps ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}</button>
                {expandedSections.steps && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    {currentStudy.steps.map((step, sIdx) => (
                      <div key={step.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">{sIdx + 1}</span></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Label</label><input type="text" value={step.label} onChange={(e) => updateStep(sIdx, 'label', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Instruction</label><textarea value={step.instruction} onChange={(e) => updateStep(sIdx, 'instruction', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button onClick={goToPrevStudy} disabled={currentStudyIndex === 0} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${currentStudyIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}><ChevronLeft className="w-5 h-5" />Previous</button>
                <div className="flex gap-2">{selectedStudies.map((_, idx) => (<button key={idx} onClick={() => { setCurrentStudyIndex(idx); setExpandedSections({ sample: false, measures: false, steps: false }); }} className={`w-2.5 h-2.5 rounded-full ${idx === currentStudyIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`} />))}</div>
                <button onClick={goToNextStudy} className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg">{currentStudyIndex === selectedStudies.length - 1 ? 'Finish Review' : 'Next'}<ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {stage === 'confirm' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-green-600" /></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Import</h3>
              <p className="text-gray-600 mb-6">You've reviewed {selectedCount} {selectedCount === 1 ? 'study' : 'studies'} from your PDF.</p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                <p className="text-sm text-gray-600 mb-2">A new folder will be created:</p>
                <p className="font-medium text-gray-900 flex items-center gap-2"><Folder className="w-4 h-4 text-blue-600" />{selectedFile?.name.replace('.pdf', '') || 'Imported Studies'}</p>
              </div>
              <div className="space-y-2 max-w-md mx-auto text-left mb-6">{selectedStudies.map((study) => (<div key={study.id} className="flex items-center gap-2 text-sm text-gray-600"><Check className="w-4 h-4 text-green-500" />{study.title}</div>))}</div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {stage === 'upload' && (<><Button onClick={onClose} variant="outline" className="px-4 py-2">Cancel</Button><Button onClick={startParsing} disabled={!selectedFile} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Parse PDF</Button></>)}
          {stage === 'selection' && (<><Button onClick={onClose} variant="outline" className="px-4 py-2">Cancel</Button><Button onClick={() => { setCurrentStudyIndex(0); setStage('review'); }} disabled={selectedCount === 0} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Review Selected ({selectedCount})</Button></>)}
          {stage === 'review' && (<><Button onClick={() => setStage('selection')} variant="outline" className="px-4 py-2">Back to Selection</Button><Button onClick={onClose} variant="outline" className="px-4 py-2">Cancel Import</Button></>)}
          {stage === 'confirm' && (<><Button onClick={() => { setStage('review'); setCurrentStudyIndex(selectedStudies.length - 1); }} variant="outline" className="px-4 py-2">Back to Review</Button><Button onClick={handleImport} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white">Import All Studies</Button></>)}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status, progress }: { status: string; progress?: number }) {
  const colors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700",
    Running: "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
    Failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || colors.Draft}`}>
      {status === "Running" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status}
      {status === "Running" && progress !== undefined && <span className="ml-1">({progress}%)</span>}
    </span>
  );
}

// ============================================================================
// PROJECT ROW COMPONENT
// ============================================================================

function ProjectRow({ project, onAction }: { project: MockProject; onAction: (action: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100">
      <td className="px-6 py-4"><div className="font-medium text-gray-900">{project.name}</div><div className="text-sm text-gray-500">{project.sample_name}</div></td>
      <td className="px-6 py-4 text-sm text-gray-600">{project.sample_size}</td>
      <td className="px-6 py-4"><StatusBadge status={project.status} progress={project.progress} /></td>
      <td className="px-6 py-4 text-sm text-gray-500">{new Date(project.created_at).toLocaleDateString()}</td>
      <td className="px-6 py-4">
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-100 rounded-lg"><MoreHorizontal className="w-4 h-4 text-gray-500" /></button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button onClick={() => { onAction('download'); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><Download className="w-4 h-4" />Download</button>
              <button onClick={() => { onAction('rename'); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><Edit3 className="w-4 h-4" />Rename</button>
              <button onClick={() => { onAction('copy'); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><Copy className="w-4 h-4" />Duplicate</button>
              <button onClick={() => { onAction('run'); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Run Again</button>
              <button onClick={() => { onAction('move'); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><FolderInput className="w-4 h-4" />Move to Folder</button>
              <hr className="my-1" />
              <button onClick={() => { onAction('delete'); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"><Trash2 className="w-4 h-4" />Delete</button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DashboardPreview() {
  const [showPDFImportModal, setShowPDFImportModal] = useState(false);
  const [folders, setFolders] = useState(mockFolders);
  const [projects, setProjects] = useState(mockProjects);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["f1"]));

  const handleImportComplete = (folderName: string, studies: ParsedStudy[]) => {
    const newFolderId = `f${Date.now()}`;
    setFolders(prev => [...prev, { folder_id: newFolderId, folder_name: folderName, created_at: new Date().toISOString(), project_count: studies.length }]);
    const newProjects = studies.map((study, idx) => ({
      id: `p${Date.now()}-${idx}`,
      name: study.title,
      sample_name: study.sample.name,
      sample_size: 10,
      status: "Draft" as const,
      created_at: new Date().toISOString(),
      folder_id: newFolderId,
      text_model: "gemini",
      evaluations_model: "gemini",
    }));
    setProjects(prev => [...newProjects, ...prev]);
    setExpandedFolders(prev => new Set([...prev, newFolderId]));
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const unfolderedProjects = projects.filter(p => !p.folder_id);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowPDFImportModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"><FileUp className="w-4 h-4" />Import PDF</Button>
            <Button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"><FolderPlus className="w-4 h-4" />New Folder</Button>
            <Button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"><Play className="w-4 h-4" />New Simulation</Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">Manage and monitor your simulation projects</p>
      </header>

      {/* Content */}
      <main className="flex-1 p-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Folders */}
          {folders.map(folder => {
            const folderProjects = projects.filter(p => p.folder_id === folder.folder_id);
            const isExpanded = expandedFolders.has(folder.folder_id);
            return (
              <div key={folder.folder_id} className="border-b border-gray-200 last:border-b-0">
                <button onClick={() => toggleFolder(folder.folder_id)} className="w-full px-6 py-4 flex items-center gap-3 hover:bg-gray-50 text-left">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <Folder className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-gray-900">{folder.folder_name}</span>
                  <span className="text-sm text-gray-500">({folderProjects.length} simulations)</span>
                </button>
                {isExpanded && folderProjects.length > 0 && (
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr><th className="px-6 py-3 text-left">Name</th><th className="px-6 py-3 text-left">Sample Size</th><th className="px-6 py-3 text-left">Status</th><th className="px-6 py-3 text-left">Created</th><th className="px-6 py-3 text-left w-16"></th></tr>
                    </thead>
                    <tbody>{folderProjects.map(project => <ProjectRow key={project.id} project={project} onAction={(action) => console.log(action, project.id)} />)}</tbody>
                  </table>
                )}
              </div>
            );
          })}

          {/* Unfoldered Projects */}
          {unfolderedProjects.length > 0 && (
            <div>
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200"><span className="font-medium text-gray-700">Uncategorized</span></div>
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr><th className="px-6 py-3 text-left">Name</th><th className="px-6 py-3 text-left">Sample Size</th><th className="px-6 py-3 text-left">Status</th><th className="px-6 py-3 text-left">Created</th><th className="px-6 py-3 text-left w-16"></th></tr>
                </thead>
                <tbody>{unfolderedProjects.map(project => <ProjectRow key={project.id} project={project} onAction={(action) => console.log(action, project.id)} />)}</tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <PDFImportModal isOpen={showPDFImportModal} onClose={() => setShowPDFImportModal(false)} onImportComplete={handleImportComplete} />
    </div>
  );
}
