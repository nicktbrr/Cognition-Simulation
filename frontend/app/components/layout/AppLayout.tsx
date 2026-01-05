"use client";

import React from "react";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface AppLayoutProps {
  currentPage: 'dashboard' | 'simulation' | 'measures' | 'samples';
  headerTitle: string;
  userData?: UserData | null;
  children: React.ReactNode;
}

export default function AppLayout({ currentPage, headerTitle, userData, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} userData={userData} />
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}