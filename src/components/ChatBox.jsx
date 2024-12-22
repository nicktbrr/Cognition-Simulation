import React from "react";
import "./ChatBox.css";

const ChatBox = ({ index, box, updateChatBox, deleteStep, hasError }) => {
  return (
    <div className={`chat-box ${hasError ? "error-box" : ""}`}>
      <h3>Step {index + 1}</h3>
      <input
        type="text"
        placeholder="Add step title"
        value={box.title}
        onChange={(e) => updateChatBox(index, "title", e.target.value)}
      />
      <textarea
        placeholder="Describe the step"
        value={box.content}
        onChange={(e) => updateChatBox(index, "content", e.target.value)}
      />
      <button onClick={() => deleteStep(index)}>Delete Step</button>
    </div>
  );
};

export default ChatBox;
