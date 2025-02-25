// "use client"

// import { Button } from "@/components/ui/button"
// import { Card } from "@/components/ui/card"
// import { Plus } from "lucide-react"
// import { useState } from "react"

// interface Criterion {
//   name: string
//   description: string
// }

// const initialCriteria: Criterion[] = [
//   { name: "Clarity", description: "The degree to which there are fewer possible interpretations of the text." },
//   {
//     name: "Fairness",
//     description: "The degree to which the text represents something that is free from bias, favoritism, or injustice.",
//   },
//   {
//     name: "Feasibility",
//     description: "The degree to which the text represents something solvable, attainable, viable, or achievable.",
//   },
//   {
//     name: "Importance",
//     description: "The degree to which the text represents something valuable, meaningful, or significant.",
//   },
//   { name: "Novelty", description: "The degree to which the text represents something unique, original, or distinct." },
//   {
//     name: "Quality",
//     description: "The degree to which the text represents a cohesive, coherent, and concise thought.",
//   },
//   {
//     name: "Usefulness",
//     description: "The degree to which the text represents something functional, helpful, or practical.",
//   },
// ]

// export default function EvaluationCriteria() {
//   const [criteria] = useState<Criterion[]>(initialCriteria)
//   const [selectedCriteria, setSelectedCriteria] = useState<string[]>([])

//   const toggleCriterion = (name: string) => {
//     setSelectedCriteria((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]))
//   }

//   return (
//     <section className="space-y-4">
//       <h2 className="text-xl font-bold">2. Choose Criteria to Evaluate Steps</h2>
//       <p className="text-muted-foreground">
//         Select the criteria used to measure the cognitive process above. You can also define new criteria, which should
//         include a clear label (a noun) and definition. Please use others as an example. Each criteria will be applied to
//         all steps, which will be available to download after submitting it below.
//       </p>

//       <div className="flex flex-wrap gap-4">
//         {criteria.map((criterion) => (
//           <Card
//             key={criterion.name}
//             className={`w-[200px] p-4 cursor-pointer transition-colors ${
//               selectedCriteria.includes(criterion.name) ? "border-primary bg-primary/5" : "hover:border-primary/50"
//             }`}
//             onClick={() => toggleCriterion(criterion.name)}
//           >
//             <div className="space-y-2">
//               <h3 className="font-medium">{criterion.name}</h3>
//               <p className="text-sm text-muted-foreground">{criterion.description}</p>
//             </div>
//           </Card>
//         ))}

//         <Button size="icon" className="h-[116px] w-[50px]" variant="outline">
//           <Plus className="h-4 w-4" />
//         </Button>
//       </div>

//       {selectedCriteria.length > 0 && (
//         <p className="text-sm text-muted-foreground">Selected criteria: {selectedCriteria.join(", ")}</p>
//       )}
//     </section>
//   )
// }

"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";

interface Criterion {
  name: string;
  description: string;
}

const initialCriteria: Criterion[] = [
  {
    name: "Clarity",
    description:
      "The degree to which there are fewer possible interpretations of the text.",
  },
  {
    name: "Fairness",
    description:
      "The degree to which the text is free from bias, favoritism, or injustice.",
  },
  {
    name: "Feasibility",
    description:
      "The degree to which something is solvable, attainable, or achievable.",
  },
  {
    name: "Importance",
    description:
      "The degree to which something is valuable, meaningful, or significant.",
  },
  {
    name: "Novelty",
    description:
      "The degree to which something is unique, original, or distinct.",
  },
  {
    name: "Quality",
    description:
      "The degree to which something is cohesive, coherent, and concise.",
  },
  {
    name: "Usefulness",
    description:
      "The degree to which something is functional, helpful, or practical.",
  },
];

export default function EvaluationCriteria({
  onMetricsChange,
}: {
  onMetricsChange: (metrics: string[]) => void;
}) {
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);

  useEffect(() => {
    onMetricsChange(selectedCriteria);
  }, [selectedCriteria, onMetricsChange]);

  const toggleCriterion = (name: string) => {
    setSelectedCriteria((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">
        2. Choose Criteria to Evaluate Steps
      </h2>
      <p className="text-muted-foreground">
        Select the criteria used to measure the cognitive process above. You can
        also define new criteria.
      </p>

      <div className="flex flex-wrap gap-4">
        {initialCriteria.map((criterion) => (
          <Card
            key={criterion.name}
            className={`w-[200px] p-4 cursor-pointer transition-colors ${
              selectedCriteria.includes(criterion.name)
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
            onClick={() => toggleCriterion(criterion.name)}
          >
            <div className="space-y-2">
              <h3 className="font-medium">{criterion.name}</h3>
              <p className="text-sm text-muted-foreground">
                {criterion.description}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {selectedCriteria.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Selected criteria: {selectedCriteria.join(", ")}
        </p>
      )}
    </section>
  );
}
