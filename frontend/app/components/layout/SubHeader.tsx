"use client";

import React from "react";

interface SubHeaderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export default function SubHeader({ title, description, children }: SubHeaderProps) {
  return (
    <div className="bg-gray-100 border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{
              fontFamily: 'Barlow, sans-serif',
              background: 'linear-gradient(135deg, #396af1 10%, #a665f6 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            {title}
          </h2>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}