"use client";

import React from "react";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import AppLoading from "../AppLoading";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface AppLayoutProps {
  currentPage: 'dashboard' | 'simulation' | 'measures' | 'samples';
  headerTitle: string;
  userData?: UserData | null;
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function AppLayout({ currentPage, headerTitle, userData, isLoading = false, children }: AppLayoutProps) {
  // Show loading state while user data is being fetched
  if (isLoading) {
    return <AppLoading message="Loading user data..." />;
  }

  return (
    <div className="flex h-screen bg-gray-50 animate-in fade-in duration-500">
      <Sidebar currentPage={currentPage} />
      <div className="flex-1 flex flex-col">
        <AppHeader title={headerTitle} userData={userData} />
        <div className="animate-in fade-in duration-700 delay-200">
          {children}
        </div>
      </div>
    </div>
  );
}