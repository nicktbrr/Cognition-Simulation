"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Represents a single section in the collapsible navigation menu.
 */
interface Section {
  id: string
  title: string
  content: string
}

/**
 * The data for the navigation sections.
 */
const sections: Section[] = [
  {
    id: "why-simulate",
    title: "Why Simulate Cognition?",
    content: `Ever since the famous "Dartmouth Conference" of 1956, psychologists have sought to unlock the mysteries of human thought—how we generate ideas, solve problems, process information, and make decisions. Cognitive processes are foundational to understanding human behavior at a higher level, but their study has been limited by a fundamental challenge: how can we study thoughts that cannot be physically observed or measured? Traditional methods such as behavioral experiments, neuroimaging, and think-aloud techniques provide insights, but they fail to capture the full complexity, detail, subjectivity, and step-by-step nature of mental processes as they unfold in real time.

Now, with advances in Large Language Models (LLMs), a new frontier is emerging: the ability to simulate human thought with unprecedented levels of control, precision, and repeatability. With these new capabilities, researchers can now design, test, measure, and evaluate cognitive processes in ways that were previously not possible.`,
  },
  {
    id: "research-team",
    title: "The Research Team",
    content: `Prof. Johnathan Cromwell is an Associate Professor of Entrepreneurship & Innovation at the University of San Francisco. His research focuses on creativity and innovation in organizations, drawing on cognitive theories of problem solving to study how people collaborate with each other as they tackle vague, open-ended, and ambiguous problems. This work has been featured in premier outlets such as Administrative Science Quarterly, Research Policy, Harvard Business Review, and MIT Sloan Management Review, along with winning multiple research awards. He earned an S.B. in Chemical-Biological Engineering from MIT and a Doctorate in Management from Harvard Business School.

Prof. Mana Azarm is an assistant professor of analytics and information systems. She dedicated her career to the continuous development of scalable data pipelines to enable intelligent decision making. With a deep understanding of diverse data architecture paradigms, including relational databases, data warehouses and lakes, multidimensional data cubes, time series optimized data stores, and other emerging paradigms, her current research focuses on Large Language Models (LLM) in development of data pipelines.

Nicholas Barsi-Rhyne is a data scientist and machine learning engineer with a strong background in computer science and statistics. He earned his B.S. in Computer Science with a minor in Statistics from UC Santa Cruz and is currently pursuing his M.S. in Data Science at the USF. He is currently a Machine Learning Engineer at Quantum Ventura. 

Andrew Hoang is a data engineer and AI enthusiast with a strong background in software development and computer science. He earned his B.S. in Computer Science from Cal State Fullerton and is currently pursuing his M.S. in Data Science at USF with a focus on Data Engineering. He previously worked at 2U on the edX platform and completed a practicum at SnapLogic, where he applied AI to classify enterprise pipeline metadata.

`,
  

},
  {
    id: "methods",
    title: "Methods Appendix",
    content: "TBD",
  },
]

/**
 * Renders a collapsible navigation menu.
 * Each section can be expanded or collapsed by the user.
 */
export default function CollapsibleNav() {
  // Tracks the ID of the currently expanded section.
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  /**
   * Toggles the expanded state of a section.
   * @param sectionId The ID of the section to toggle.
   */
  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId)
  }

  return (
    <nav className="space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="space-y-2">
          <button
            onClick={() => toggleSection(section.id)}
            className={cn(
              "flex items-center gap-2 text-left font-medium hover:text-primary transition-colors w-full",
              expandedSection === section.id ? "text-primary" : "",
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                // Rotates the chevron icon when the section is open.
                expandedSection === section.id ? "rotate-180" : "",
              )}
            />
            {section.title}
          </button>
          <div
            className={cn(
              "grid transition-all",
              // This CSS trick animates the height of the section.
              // `grid-rows-[1fr]` expands the section to its content height.
              // `grid-rows-[0fr]` collapses it to zero height.
              expandedSection === section.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="p-4 text-muted-foreground">
                {/* The content is split into paragraphs based on double line breaks. */}
                {section.content.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </nav>
  )
}

