"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Section {
  id: string
  title: string
  content: string
}

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

Nicholas Barsi-Rhyne and Andrew Hoang are...`,
  },
  {
    id: "methods",
    title: "Methods Appendix",
    content: "TBD",
  },
]

export default function CollapsibleNav() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

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
              className={cn("h-4 w-4 transition-transform", expandedSection === section.id ? "rotate-180" : "")}
            />
            {section.title}
          </button>
          <div
            className={cn(
              "grid transition-all",
              expandedSection === section.id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="p-4 text-muted-foreground">
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

