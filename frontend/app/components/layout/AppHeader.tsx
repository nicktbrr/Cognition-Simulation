"use client";

import React from "react";

interface AppHeaderProps {
  title: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  return (
    <div className="bg-gray-100 border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 
            className="text-2xl font-semibold"
            style={{
              fontFamily: 'Barlow, sans-serif',
              background: 'linear-gradient(135deg, #396af1 10%, #a665f6 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}