// import React, { useState } from "react";
// import { createClient } from "@supabase/supabase-js";
// import ChatBox from "./components/ChatBox";
// import "./App.css";

// const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_KEY
// );

// function App() {
//   const [seed, setSeed] = useState("chopsticks");
//   const [metric, setMetric] = useState("creativity");
//   const [chatBoxes, setChatBoxes] = useState([{ title: "", content: "" }]);
//   const [jsonData, setJsonData] = useState({
//     seed: "chopsticks",
//     steps: {},
//     metric: "creativity",
//     iters: 10,
//   });

//   const updateJson = () => {
//     const steps = {};
//     chatBoxes.forEach((box) => {
//       if (box.title && box.content) {
//         steps[box.title] = box.content;
//       }
//     });
//     setJsonData((prev) => ({
//       ...prev,
//       seed,
//       metric,
//       steps,
//     }));
//   };

//   const addNewStep = () => {
//     setChatBoxes([...chatBoxes, { title: "", content: "" }]);
//   };

//   const saveJson = async () => {
//     const response = await supabase
//       .from("users")
//       .insert([{ user: jsonData }]);
//     if (response.error) {
//       alert("Error saving data to Supabase");
//     } else {
//       alert("JSON data saved successfully!");
//     }
//   };

//   const deleteStep = (index) => {
//     const updatedChatBoxes = chatBoxes.filter((_, i) => i !== index);
//     setChatBoxes(updatedChatBoxes);
//     updateJson();
//   };

//   const updateChatBox = (index, field, value) => {
//     const updatedChatBoxes = [...chatBoxes];
//     updatedChatBoxes[index][field] = value;
//     setChatBoxes(updatedChatBoxes);
//     updateJson();
//   };

//   return (
//     <div className="App">
//       <h1>Cognitive Processes for LLM</h1>
//       {/* Inputs for Seed and Metric */}
//       <div className="input-group">
//         <div>
//           <label>Seed:</label>
//           <input
//             type="text"
//             value={seed}
//             onChange={(e) => setSeed(e.target.value)}
//           />
//         </div>
//         <div>
//           <label>Metric:</label>
//           <input
//             type="text"
//             value={metric}
//             onChange={(e) => setMetric(e.target.value)}
//           />
//         </div>
//       </div>

//       {/* Add New Step and Save JSON */}
//       <div className="buttons">
//         <button onClick={addNewStep}>Add New Step</button>
//         <button onClick={saveJson}>Save JSON</button>
//       </div>

//       {/* Display chat boxes */}
//       {chatBoxes.map((box, index) => (
//         <ChatBox
//           key={index}
//           index={index}
//           box={box}
//           updateChatBox={updateChatBox}
//           deleteStep={deleteStep}
//         />
//       ))}

//       {/* Display JSON */}
//       <div className="json-display">
//         <h3>JSON Data:</h3>
//         <pre>{JSON.stringify(jsonData, null, 2)}</pre>
//       </div>
//     </div>
//   );
// }

// export default App;
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ChatBox from "./components/ChatBox";
import "./App.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

function App() {
  const [seed, setSeed] = useState("");
  const [metric, setMetric] = useState("");
  const [chatBoxes, setChatBoxes] = useState([{ title: "", content: "" }]);
  const [jsonData, setJsonData] = useState({
    seed: "",
    steps: {},
    metric: "",
    iters: 10,
  });
  const [validationErrors, setValidationErrors] = useState([]); // Track errors

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
      metric,
      steps,
    }));
  };

  const validateInputs = () => {
    const errors = chatBoxes.map((box) => !box.title || !box.content);
    setValidationErrors(errors);
    return errors.every((isValid) => !isValid);
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
      .insert([{ user: jsonData }]);
    if (response.error) {
      alert("Error saving data to Supabase");
    } else {
      alert("JSON data saved successfully!");
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
        <label>Metric:</label>
          <input
            type="text"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          />
          </div>
        
      </div>
      
      {/* Add New Step and Save JSON */}
      <div className="buttons">
        <button onClick={addNewStep}>Add New Step</button>
        <button onClick={saveJson}>Save JSON</button>
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
