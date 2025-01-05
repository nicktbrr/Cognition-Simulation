// TODO fix bug where putting seed last before pushing json doesnt actually update the seed

import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ChatBox from "./components/ChatBox";
import "./App.css";
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

const token = import.meta.env.VITE_GCP_TOKEN;


function App() {
  const uuid = uuidv4()
  const [seed, setSeed] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [metrics, setMetrics] = useState([
  ]);
  const [chatBoxes, setChatBoxes] = useState([{ title: "", content: "" }]);
  const [jsonData, setJsonData] = useState({
    seed: "",
    steps: {},
    metric: [],
    iters: 10,
    temperature: 0.5
  });
  const [temperature, setTemperature] = useState(0.5); 
  const [validationErrors, setValidationErrors] = useState([]); // Track errors
  const [metricsError, setMetricsError] = useState(false);
  const availableMetrics = [
    { name: "clarity", description: "By clarity we mean the degree to which something has fewer possible interpretations." },
    { name: "feasibility", description: "By feasibility we are referring to the degree to which something is solvable, attainable, viable, or achievable." },
    { name: "importance", description: "By importance we are referring to the degree to which something is valuable, useful, or meaningful." },
    { name: "uniqueness", description: "By uniqueness we are referring to the degree to which something is novel, original, or distinct." },
    { name: "fairness", description: "By fairness we are referring to the degree to which something is free from bias, favoritism, or injustice." },
    { name: "quality", description: "By quality we are referring to the degree to which the content is communicated more effectively." }
  ]


  const updateJson = () => {
    const steps = {};
    chatBoxes.forEach((box) => {
      if (box.title && box.content) {
        steps[box.title] = box.content;
      }
    });
    setJsonData((prev) => ({
      ...prev,
      seed,
      metric: metrics,
      steps,
      temperature: temperature
    }));
  };

  const validateInputs = () => {
    const errors = chatBoxes.map((box) => !box.title || !box.content);
    setValidationErrors(errors);

    // Validate metrics
    if (metrics.length === 0) {
      setMetricsError(true);
      return false;
    } else {
      setMetricsError(false);
    }

    return errors.every((isValid) => !isValid);
  };

  const handleSliderChange = (value) => {
    const roundedValue = Math.round(value * 100) / 100.0; // Round to 2 decimal places
    setTemperature(roundedValue);
    setJsonData((prev) => ({
      ...prev,
      temperature: roundedValue,
    }));
  };

  const addNewStep = () => {
    setChatBoxes([...chatBoxes, { title: "", content: "" }]);
    setValidationErrors([...validationErrors, false]); // Add a non-error state
  };

  const saveJson = async () => {
    if (!validateInputs()) {
      alert("Please fill out all fields before submitting.");
      return;
    }

    const response = await supabase
      .from("users")
      .insert([{id: uuid, user: jsonData }]);
    if (response.error) {
      alert("Error saving data to Supabase");
    } else {
      alert("JSON data saved successfully!");
      const url = 'http://127.0.0.1:5000/api/evaluate'
      // const url = 'https://cognition-backend-81313456654.us-west1.run.app/api/evaluate'
      try {
        const response2 = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'uuid':uuid}), // Convert payload to JSON
        });

        // if (!response.ok) {
        //     // Handle non-2xx responses
        //     const errorDetails = await response.json();
        //     throw new Error(errorDetails.message || 'Something went wrong');
        // }

        // Parse and return response data
        const a = await response2.json()
        console.log(a)
        setEvaluation(JSON.parse(a.evaluation))
        return a
      } catch (error) {
          // Handle fetch or parsing errors
          console.error('Error in POST request:', error);
          throw error; // Re-throw the error if needed
      }
    }
  };

  const deleteStep = (index) => {
    const updatedChatBoxes = chatBoxes.filter((_, i) => i !== index);
    const updatedValidationErrors = validationErrors.filter((_, i) => i !== index);
    setChatBoxes(updatedChatBoxes);
    setValidationErrors(updatedValidationErrors);
    updateJson();
  };

  const updateChatBox = (index, field, value) => {
    const updatedChatBoxes = [...chatBoxes];
    updatedChatBoxes[index][field] = value;
    setChatBoxes(updatedChatBoxes);

    // Remove error flag if the field is filled
    if (field === "title" && value) validationErrors[index] = false;
    if (field === "content" && value) validationErrors[index] = false;
    setValidationErrors([...validationErrors]);
    updateJson();
  };

  const handleMetricChange = (metric) => {
    const updatedMetrics = metrics.includes(metric)
      ? metrics.filter((m) => m !== metric) // Remove if already selected
      : [...metrics, metric]; // Add if not selected
  
    setMetrics(updatedMetrics);
  
    // Check if metrics array is empty after update
    setMetricsError(updatedMetrics.length === 0);
  
    const steps = {};
  chatBoxes.forEach((box) => {
    if (box.title && box.content) {
      steps[box.title] = box.content;
    }
  });

  setJsonData({
    seed,
    steps,
    metric: updatedMetrics,
    iters: 10,
    temperature
  });
  };

  return (
    <div className="App">
      <h1>Cognitive Processes for LLM</h1>
      {/* Inputs for Seed and Metric */}
      <div className="input-group">
        <div>
          <label>Seed:</label>
          <textarea
            placeholder="seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </div>
        <div>
        {/* Metric */}
        <h3>Select Metrics:</h3>
        <div className={`checkbox-container ${metricsError ? "error" : ""}`}>
        {availableMetrics.map((metric) => (
          <label className="checkbox-label" key={metric.name}>
            <input
              type="checkbox"
              value={metric.name}
              checked={metrics.includes(metric.name)}
              onChange={() => handleMetricChange(metric.name)}
            />
            
            <span
        className="tooltip"
        data-tooltip={metric.description}
      >
       {metric.name}
      </span>
           
          </label>
          
        ))}
          </div>
        </div>
      </div>

      {/* Variation Slider */}
      <div className="slider-group">
        <h3 htmlFor="variation-slider">
          Variation: {temperature * 100}
        </h3>
        <input
          
          id="variation-slider"
          type="range"
          min="0.0"
          max="1.0"
          step="0.01" // Allow finer granularity
          value={temperature}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
        />
      </div>
      
      {/* Add New Step and Save JSON */}
      <div className="buttons">
        <button onClick={addNewStep}>Add New Step</button>
        <button onClick={saveJson}>Save JSON</button>
      </div>

      <div>
        <h3>Cosine Similarity:</h3>
        <div>
          {Object.entries(evaluation).map(([key, value]) => (
            <div key={key}>
              <strong>Step {key}</strong>: {value}
            </div>
          ))}
        </div>
      </div>

      {/* Display chat boxes */}
      {chatBoxes.map((box, index) => (
        <ChatBox
          key={index}
          index={index}
          box={box}
          updateChatBox={updateChatBox}
          deleteStep={deleteStep}
          hasError={validationErrors[index]} // Highlight if there's an error
        />
      ))}

      {/* Display JSON */}
      <div className="json-display">
        <h3>JSON Data:</h3>
        <pre>{JSON.stringify(jsonData, null, 2)}</pre>
      </div>
    </div>
  );
}

export default App;
