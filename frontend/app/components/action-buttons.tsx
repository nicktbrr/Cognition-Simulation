"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { isValidURL } from "@/app/utils/urlParser";
import { AlertCircle } from "lucide-react";

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
  hasUrls: boolean;
}

export default function ActionButtons({
  onSubmit,
  steps,
  metrics,
  edges,
  setSimulationActive,
  hasUrls,
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
    const allFieldsFilled = steps.every(
      (step) => step.label.trim() !== "" && step.instructions.trim() !== ""
    );

    const hasStepUrls = steps.some(
      (step) => isValidURL(step.label) || isValidURL(step.instructions)
    );

    if (hasStepUrls || hasUrls) {
      alert("Please remove all URLs before submitting.");
      return false;
    }

    return allFieldsFilled;
  };

  const handleSubmit = async () => {
    console.log("edges", edges);
    console.log("nodes", steps);
    console.log("metrics", metrics);
    if (!validateInputs()) {
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setSimulationActive(true);

    try {
      // Prepare data for Supabase
      const uuid = crypto.randomUUID();

      // Create an ordered array of steps based on edge connections
      const orderedSteps: Array<{ label: string; instructions: string; temperature: number }> = [];

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
              temperature: node.temperature
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
        console.log('len', orderedSteps.length)
        console.log('len', steps.length)
        
        if (orderedSteps.length !== steps.length) {
          alert("All nodes must be connected. Please ensure all nodes are properly linked.");
          setIsProcessing(false);
          setLoading(false);
          setSimulationActive(false);
          return;
        }
      } else {
        // Fallback if we can't determine the order from edges
        // This will happen if there are no connections or if there's a cycle
        if (orderedSteps.length !== steps.length) {
          alert("All nodes must be connected. Please ensure all nodes are properly linked.");
          setIsProcessing(false);
          setLoading(false);
          setSimulationActive(false);
          return;
        }
      }
      
      // console.log("orderedSteps", orderedSteps);
      //console.log(orderedSteps);

      const jsonData = {
        seed: "no-seed",
        steps: orderedSteps,
        metrics: metrics,
        iters: 10,
        temperature: 0.5
      };

      console.log("jsonData", jsonData);

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
      setSimulationActive(false);
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

      {(hasUrls ||
        steps.some(
          (step) => isValidURL(step.label) || isValidURL(step.instructions)
        )) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>
              URLs detected - Please remove all URLs before submitting
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Button
            variant="secondary"
            className="bg-primary text-primary-foreground hover:bg-[#6a03abe6] hover:text-white"
            onClick={handleSubmit}
            disabled={
              isProcessing ||
              loading ||
              hasUrls ||
              steps.some(
                (step) =>
                  isValidURL(step.label) || isValidURL(step.instructions)
              )
            }
            title={
              hasUrls ||
              steps.some(
                (step) =>
                  isValidURL(step.label) || isValidURL(step.instructions)
              )
                ? "Please remove all URLs before submitting"
                : "Submit for simulation"
            }
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
