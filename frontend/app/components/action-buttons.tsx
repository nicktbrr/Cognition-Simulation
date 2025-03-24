"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const prod = process.env.NEXT_PUBLIC_DEV || "production";
const token = process.env.NEXT_PUBLIC_GCP_TOKEN!;

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

interface ActionButtonsProps {
  onSubmit: (steps: Step[], metrics: string[]) => void;
  steps: Step[];
  metrics: string[];
  edges: any;
  setSimulationActive: (active: boolean) => void;
}

export default function ActionButtons({
  onSubmit,
  steps,
  metrics,
  edges,
  setSimulationActive
}: ActionButtonsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDisabled, setIsDisabled] = useState(true);
  const [download, setDownload] = useState("");

  const handleDownload = async (public_url: string, filename: string) => {
    try {
      const response = await fetch(public_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename); // Adjust the filename as needed
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading CSV:", error);
    }
  };

  const validateInputs = () => {
    return steps.every(
      (step) => step.label.trim() !== "" && step.instructions.trim() !== ""
    );
  };

  // const handleSubmit = async () => {
  //   console.log("edges", edges);
  //   console.log("nodes", steps);
  //   if (!validateInputs()) {
  //     alert("Please fill out all fields before submitting.");
  //     return;
  //   }

  //   setIsProcessing(true);
  //   setLoading(true);

  //   try {
  //     // Prepare data for Supabase
  //     const uuid = crypto.randomUUID();
  //     const jsonData = {
  //       seed: "some-seed-value",
  //       steps: steps.reduce((acc, step) => {
  //         acc[step.label] = step.instructions;
  //         return acc;
  //       }, {} as Record<string, string>),
  //       metrics: metrics, // ✅ Added metrics
  //       iters: 10,
  //       temperature: 0.5,
  //     };

  //     console.log(jsonData);

  //     // Insert into Supabase
  //     const { error } = await supabase
  //       .from("users")
  //       .insert([{ id: uuid, user: jsonData }]);
  //     if (error) {
  //       alert("Error saving data to Supabase");
  //       throw error;
  //     } else {
  //       alert("JSON data saved successfully!");

  //       // Define backend URL
  //       console.log(prod);
  //       const url =
  //         prod === "development"
  //           ? "http://127.0.0.1:5000/api/evaluate"
  //           : "https://cognition-backend-81313456654.us-west1.run.app/api/evaluate";

  //       // Send request to backend
  //       const response = await fetch(url, {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           ...(prod !== "development"
  //             ? { Authorization: `Bearer ${token}` }
  //             : {}),
  //         },
  //         body: JSON.stringify({ uuid }),
  //       });
  //       const a = await response.json();
  //       console.log(a);
  //       setDownload(a.evaluation.public_url);
  //       setIsDisabled(false);
  //     }
  //   } catch (error) {
  //     console.error("Error in POST request:", error);
  //   } finally {
  //     setIsProcessing(false);
  //     setLoading(false);
  //   }
  // };

  const handleSubmit = async () => {
    console.log("edges", edges);
    console.log("nodes", steps);
    console.log("metrics", metrics);
    if (!validateInputs()) {
      alert("Please fill out all fields before submitting.");
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setSimulationActive(true)

    try {
      // Prepare data for Supabase
      const uuid = crypto.randomUUID();

      // Create an ordered array of steps based on edge connections
      const orderedSteps: Array<{ label: string; instructions: string }> = [];

      // Find the starting node (the one that isn't a target in any edge)
      const targetNodes = edges.map((edge) => Number(edge.target));
      const sourceNodes = edges.map((edge) => Number(edge.source));
      const startNodeId = sourceNodes.find((id) => !targetNodes.includes(id));

      console.log("targ", targetNodes);
      console.log("source", sourceNodes);
      console.log("start", startNodeId);

      if (startNodeId !== undefined) {
        // Map to track visited nodes to prevent infinite loops
        const visitedNodes = new Set<number>();

        // Function to traverse the graph
        const traverseGraph = (nodeId: number) => {
          if (visitedNodes.has(nodeId)) return;
          visitedNodes.add(nodeId);

          // Find the node details
          const node = steps.find((step) => step.id === nodeId);
          if (node) {
            // Add to ordered steps array
            orderedSteps.push({
              label: node.label,
              instructions: node.instructions,
            });

            // Find the next node in the path
            const nextEdge = edges.find(
              (edge) => Number(edge.source) === nodeId
            );
            if (nextEdge) {
              traverseGraph(Number(nextEdge.target));
            }
          }
        };

        // Start traversal from the identified start node
        traverseGraph(startNodeId);
      } else {
        // Fallback if we can't determine the order from edges
        // This will happen if there are no connections or if there's a cycle
        steps.forEach((step) => {
          orderedSteps.push({
            label: step.label,
            instructions: step.instructions,
          });
        });
      }

      console.log(orderedSteps);

      const jsonData = {
        seed: "no-seed",
        steps: orderedSteps,
        metrics: metrics,
        iters: 10,
        temperature: 0.5,
      };

      console.log(jsonData);

      // Insert into Supabase
      const { error } = await supabase
        .from("users")
        .insert([{ id: uuid, user: jsonData }]);
      if (error) {
        alert("Error saving data to Supabase");
        throw error;
      } else {
        alert("JSON data saved successfully!");

        // Define backend URL
        console.log(prod);
        const url =
          prod === "development"
            ? "http://127.0.0.1:5000/api/evaluate"
            : "https://cognition-backend-81313456654.us-west1.run.app/api/evaluate";

        // Send request to backend
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(prod !== "development"
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          body: JSON.stringify({ uuid }),
        });
        const a = await response.json();
        console.log(a);
        setDownload(a.evaluation.public_url);
        setIsDisabled(false);
      }
    } catch (error) {
      console.error("Error in POST request:", error);
    } finally {
      setSimulationActive(false)
      setIsProcessing(false);
      setLoading(false);
     
    }
  };

  const handleReset = () => {
    if (
      confirm(
        "Are you sure you want to reset? This will clear all your progress."
      )
    ) {
      window.location.reload();
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">3. Submit and Download Data</h2>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Button
            variant="secondary"
            className="bg-primary text-primary-foreground"
          >
            Download Summary
          </Button>
          <Button
            variant="secondary"
            className="bg-primary text-primary-foreground"
            onClick={handleSubmit}
            disabled={isProcessing || loading}
          >
            {isProcessing ? "Processing..." : "Submit for Simulation"}
          </Button>
          <Button
            variant="secondary"
            disabled={isDisabled ? true : false}
            onClick={() => {
              console.log(download);
              handleDownload(download, "simulated_data.csv");
            }}
          >
            Download Simulated Data
          </Button>
          {/* <Button variant="secondary" disabled={isDisabled ? true : false}>
            Download Evaluations
          </Button> */}
        </div>
        <div className="flex gap-4">
          <Button variant="destructive" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>
    </section>
  );
}
