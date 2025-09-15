// Temporary header component for simulation page
// TODO: Refactor simulation page to use AppLayout structure

import React from "react";

export default function Header() {
  return (
    <div className="bg-white border-b border-gray-200 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cognitive Simulation</h1>
          <p className="text-gray-600 mt-1">Build and configure your cognitive simulation models</p>
        </div>
      </div>
    </div>
  );
}