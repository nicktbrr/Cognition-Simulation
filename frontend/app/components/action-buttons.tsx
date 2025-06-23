/**
 * @file This file defines the ActionButtons component, which provides user controls
 * for submitting, downloading, and resetting a cognitive simulation.
 */
"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { isValidURL } from "@/app/utils/urlParser";
import { AlertCircle } from "lucide-react";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Determine environment and get GCP token
const prod = process.env.NEXT_PUBLIC_DEV || "production";
const token = process.env.NEXT_PUBLIC_GCP_TOKEN!;

// Define interfaces for step and edge data structures
interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

interface Edge {
  source: string;
  target: string;
}

// Define props for the ActionButtons component
interface ActionButtonsProps {
  onSubmit: (steps: Step[], metrics: string[]) => void;
  steps: Step[];
  metrics: string[];
  edges: Edge[];
  setSimulationActive: (active: boolean) => void;
  hasUrls: boolean;
  title: string;
}

/**
 * Renders action buttons for controlling the simulation flow, including
 * submission, downloading results, and resetting the configuration.
 * @param {ActionButtonsProps} props - The props for the component.
 * @returns {JSX.Element} The rendered ActionButtons component.
 */
export default function ActionButtons({
  onSubmit,
  steps,
  metrics,
  edges,
  setSimulationActive,
  hasUrls,
  title,
}: ActionButtonsProps) {
  // State for managing UI during processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDisabled, setIsDisabled] = useState(true);
  const [download, setDownload] = useState("");

  /**
   * Handles downloading of the simulation result file.
   * @param {string} public_url - The public URL of the file to download.
   * @param {string} filename - The desired filename for the downloaded file.
   */
  const handleDownload = async (public_url: string, filename: string) => {
    try {
      // Fetch the file from the public URL
      const response = await fetch(public_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link to trigger the download
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `cogsim_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      // Clean up the temporary link and object URL
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading CSV:", error);
    }
  };

  /**
   * Validates the simulation inputs before submission.
   * Ensures all fields are filled and no URLs are present.
   * @returns {boolean} - True if inputs are valid, false otherwise.
   */
  const validateInputs = () => {
    // Check if all step labels and instructions are filled
    const allFieldsFilled = steps.every(
      (step) => step.label.trim() !== "" && step.instructions.trim() !== ""
    );

    // Check if any step label or instruction contains a URL
    const hasStepUrls = steps.some(
      (step) => isValidURL(step.label) || isValidURL(step.instructions)
    );

    if (hasStepUrls || hasUrls) {
      alert("Please remove all URLs before submitting.");
      return false;
    }

    return allFieldsFilled;
  };

  /**
   * Handles the submission of simulation data.
   * It validates inputs, orders the simulation steps, saves data to Supabase,
   * and triggers the backend evaluation process.
   */
  const handleSubmit = async () => {
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

      if (startNodeId !== undefined) {
        // Map to track visited nodes to prevent infinite loops in case of cycles
        const visitedNodes = new Set<number>();

        // Traverse the graph to create a sequential order of steps
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
        
        // Ensure all nodes are connected and included in the ordered list
        if (orderedSteps.length !== steps.length) {
          alert("All nodes must be connected. Please ensure all nodes are properly linked.");
          setIsProcessing(false);
          setLoading(false);
          setSimulationActive(false);
          return;
        }
      } else {
        // Fallback for when a start node can't be determined (e.g., no edges or cycles)
        if (orderedSteps.length !== steps.length) {
          alert("All nodes must be connected. Please ensure all nodes are properly linked.");
          setIsProcessing(false);
          setLoading(false);
          setSimulationActive(false);
          return;
        }
      }

      // Construct the JSON payload for the simulation
      const jsonData = {
        seed: "no-seed",
        steps: orderedSteps,
        metrics: metrics,
        iters: 10,
        temperature: 0.5
      };

      // Insert the simulation data into Supabase
      const { error } = await supabase
        .from("users")
        .insert([{ id: uuid, user: jsonData }]);
      if (error) {
        alert("Error saving data to Supabase");
        throw error;
      } else {
        alert("JSON data saved successfully!");

        // Define backend URL based on environment
        const url =
          prod === "development"
            ? "http://127.0.0.1:5000/api/evaluate"
            : "https://cognition-backend-81313456654.us-west1.run.app/api/evaluate";

        // Send the simulation request to the backend API
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
        // Set the download URL from the backend response and enable download button
        setDownload(a.evaluation.public_url);
        setIsDisabled(false);
      }
    } catch (error) {
      console.error("Error in POST request:", error);
    } finally {
      // Reset processing states regardless of outcome
      setSimulationActive(false);
      setIsProcessing(false);
      setLoading(false);
    }
  };

  /**
   * Resets the simulation form by reloading the page.
   * Prompts the user for confirmation before proceeding.
   */
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

      {/* Display a warning if any input contains a URL */}
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
          {/* Button to submit simulation for processing */}
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
          {/* Button to download simulated data */}
          <Button
            variant="secondary"
            disabled={isDisabled ? true : false}
            className={isDisabled ? "" : "bg-primary text-primary-foreground hover:bg-[#6a03abe6] hover:text-white"}
            onClick={() => {
              handleDownload(download, "simulated_data.xlsx");
            }}
          >
            Download Simulated Data
          </Button>
          {/* <Button variant="secondary" disabled={isDisabled ? true : false}>
            Download Evaluations
          </Button> */}
        </div>
        <div className="flex gap-4">
          {/* Button to reset the form */}
          <Button variant="destructive" onClick={handleReset}>
            Reset
          </Button>
          {/* Button to cancel action */}
          <Button variant="secondary">Cancel</Button>
        </div>
      </div>
    </section>
  );
}
