// TODO fix bug where putting seed last before pushing json doesnt actually update the seed

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ChatBox from "./components/ChatBox";
import "./App.css";
import { v4 as uuidv4 } from "uuid";

import { Info } from "@phosphor-icons/react";


const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

const prod = import.meta.env.VITE_DEV || "production";
const token = import.meta.env.VITE_GCP_TOKEN;

function App() {
  const uuid = uuidv4();
  const [seed, setSeed] = useState("chopsticks.");
  const [evaluation, setEvaluation] = useState("");
  const [stepwise_similarity_df, setStepwiseAverageSimilarity] = useState("");
  const [mean_similarity_df, setMeanSimilarityDf] = useState("");
  const [metrics, setMetrics] = useState([]);
  const [chatBoxes, setChatBoxes] = useState([
    {
      title: "ideas",
      content:
        " generate 5 different ideas based on this object that can be potentially useful. Try pushing yourself in more novel, useful, and feasible directions.",
    },
    {
      title: "idea & description",
      content:
        "choose the most promising idea that you think has the greatest potential to be both highly novel and highly useful.",
    },
    {
      title: "problem elements",
      content:
        "identify main elements of a prolem including a clear target user, a relevant context, and a strong reason why this is important.",
    },
    {
      title: "problem statement",
      content:
        " generate a clear and coherent problem statement, beginning with an accurate description of the current state and ending with a future goal to achieve.",
    },
    {
      title: "second ideas",
      content:
        " generate 5 different ideas to solve this problem. Try pushing yourself in more novel, useful, and feasible directions.",
    },
    {
      title: "second idea and description",
      content:
        "choose the most promising idea that has the greatest potential to be both highly novel and highly useful.",
    },
  ]);
  const [jsonData, setJsonData] = useState({
    seed: "",
    steps: {},
    metric: [],
    iters: 10,
    temperature: 0.5,
  });
  const [temperature, setTemperature] = useState(0.5);
  const [validationErrors, setValidationErrors] = useState([]); // Track errors
  const [public_url, setPublicUrl] = useState("");
  const [metricsError, setMetricsError] = useState(false);
  const availableMetrics = [
    {
      name: "clarity",
      description:
        "By clarity we mean the degree to which something has fewer possible interpretations.",
    },
    {
      name: "feasibility",
      description:
        "By feasibility we are referring to the degree to which something is solvable, attainable, viable, or achievable.",
    },
    {
      name: "importance",
      description:
        "By importance we are referring to the degree to which something is valuable, useful, or meaningful.",
    },
    {
      name: "uniqueness",
      description:
        "By uniqueness we are referring to the degree to which something is novel, original, or distinct.",
    },
    {
      name: "fairness",
      description:
        "By fairness we are referring to the degree to which something is free from bias, favoritism, or injustice.",
    },
    {
      name: "quality",
      description:
        "By quality we are referring to the degree to which the content is communicated more effectively.",
    },
  ];
  
  const handleSeedChange = (e) => {
    const newSeed = e.target.value;
    setSeed(newSeed);
  
    setJsonData((prev) => ({
      ...prev,
      seed: newSeed,
    }));
  };

  useEffect(() => {
    setJsonData((prev) => ({
      ...prev,
      seed,
    }));
  }, [seed]);

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
      temperature: temperature,
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
      .insert([{ id: uuid, user: jsonData }]);
    if (response.error) {
      alert("Error saving data to Supabase");
    } else {
      alert("JSON data saved successfully!");
      let url = "";
      if (prod == "development") {
        url = "http://127.0.0.1:5000/api/evaluate";
      } else {
        url =
          "https://cognition-backend-81313456654.us-west1.run.app/api/evaluate";
      }

      try {
        let response2 = "";
        console.log(url);
        if (prod == "development") {
          console.log(prod);
          response2 = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uuid: uuid }), // Convert payload to JSON
          });
        } else {
          response2 = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ uuid: uuid }), // Convert payload to JSON
          });
        }

        // Parse and return response data
        const a = await response2.json();
        console.log(a);

        console.log(a.evaluation);

        // setEvaluation(JSON.parse(a.evaluation));

        console.log(a.evaluation.stepwise_similarity_df);
        console.log(a.evaluation.mean_similarity_df);
        console.log(a.evaluation.signed_url);

        setStepwiseAverageSimilarity(
          JSON.parse(a.evaluation.stepwise_similarity_df)
        );
        setMeanSimilarityDf(JSON.parse(a.evaluation.mean_similarity_df));
        setPublicUrl(a.evaluation.public_url);

        return a;
      } catch (error) {
        // Handle fetch or parsing errors
        console.error("Error in POST request:", error);
        throw error; // Re-throw the error if needed
      }
    }
  };

  const deleteStep = (index) => {
    const updatedChatBoxes = chatBoxes.filter((_, i) => i !== index);
    const updatedValidationErrors = validationErrors.filter(
      (_, i) => i !== index
    );
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
      temperature,
    });
  };

  return (
    <div className="App">
      <h1>Cognitive Processes for LLM</h1>
      <p style={{ textAlign: "left" }}><strong>Instructions</strong> Enter each step of the process as a separate box. </p>
      <ol style={{ textAlign: "left" }}>
        <li>The first box should be the seed.</li>
        <li>Select the metrics you want to evaluate.</li>
        <li>The variation slider controls the randomness of the process.</li>
        <li>Add new steps to the process by clicking the "Add New Step" button.</li>
        <li>Save the JSON data by clicking the "Submit Process" button.</li>
      </ol>
      {/* Inputs for Seed and Metric */}
      <div className="input-group">
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Seed <span className="tooltip-container">
              <Info size={18} />
              <span className="tooltip-text">The text that a user needs to enter to initiate the process</span>
            </span>:
          </label>
          <textarea
            placeholder="seed"
            value={seed}
            onChange={handleSeedChange}
          />
        </div>
      </div>
  
      {/* Add New Step and Save JSON */}


      <div>
        {mean_similarity_df && (
          <div>
            <h3>Cosine Similarity Matrix:</h3>
          <table className="similarity-matrix">
            <thead>
              <tr>
                <th></th> {/* Empty top-left cell */}
                {Object.keys(mean_similarity_df).map((key) => (
                  <th key={`col-${key}`}>Step {key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(mean_similarity_df).map(([rowKey, rowValues]) => (
                <tr key={`row-${rowKey}`}>
                  <td>
                    <strong>Step {rowKey}</strong>
                  </td>{" "}
                  {/* Row header */}
                  {Object.values(rowValues).map((value, colIndex) => (
                    <td key={`cell-${rowKey}-${colIndex}`}>
                      {value.toFixed(3)} {/* Format to 3 decimal places */}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div>
       
        {stepwise_similarity_df && (
          <div>
            <h3>Stepwise Average Similarity Matrix:</h3>
            <table className="stepwise-similarity-matrix">
              <thead>
                <tr>
                  <th></th> {/* Empty top-left cell */}
                  {Object.keys(stepwise_similarity_df).map((key) => (
                    <th key={`col-${key}`}>Step {key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(stepwise_similarity_df).map(
                  ([rowKey, rowValues]) => (
                    <tr key={`row-${rowKey}`}>
                      <td>
                        <strong>Step {rowKey}</strong>
                      </td>{" "}
                      {/* Row header */}
                      {Object.values(rowValues).map((value, colIndex) => (
                        <td key={`cell-${rowKey}-${colIndex}`}>
                          {value.toFixed(3)} {/* Format to 3 decimal places */}
                        </td>
                      ))}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        {public_url && (
          <a href={public_url} target="_blank" download>
            Download link
          </a>
        )}
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

                <span className="tooltip" data-tooltip={metric.description}>
                  {metric.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      {/* Variation Slider */}
      <div className="slider-group">
        <h3 htmlFor="variation-slider">Temperature <span className="tooltip-container">
              <Info size={18} />
              <span className="tooltip-text">"Temperature" is a parameter that controls the randomness and creativity of the model's output. 
                It essentially determines how much the model will deviate from the most likely or predictable response.</span>
            </span>: {temperature * 100}</h3>
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
      <div className="buttons">
        <button onClick={addNewStep}>Add New Step</button>
        <button onClick={saveJson}>Submit Process</button>
      </div>

      {/* Display JSON */}
      <div className="json-display">
        <h3>JSON Data:</h3>
        <pre>{JSON.stringify(jsonData, null, 2)}</pre>
      </div>
    </div>
  );
}

export default App;
