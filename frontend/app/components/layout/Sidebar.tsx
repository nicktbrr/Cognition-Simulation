"use client";

import React from "react";
import Link from "next/link";
import { Home, Activity, Users, BarChart3 } from "lucide-react";

interface SidebarProps {
  currentPage: 'dashboard' | 'simulation' | 'measures' | 'samples';
}

export default function Sidebar({ currentPage }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: Home, label: 'Home' },
    { id: 'simulation', href: '/simulation', icon: Activity, label: 'Simulation' },
    { id: 'measures', href: '/measures', icon: BarChart3, label: 'Measures' },
    { id: 'samples', href: '/samples', icon: Users, label: 'Samples' },
  ];

  return (
    <div className="w-64 bg-gray-100 border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-600">CogSim</h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4">
        <div className="border-t border-gray-300 pt-4 mb-4"></div>
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <Link key={item.id} href={item.href}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  isActive 
                    ? 'text-white bg-blue-600' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}>
                  <Icon className="w-5 h-5" />
                  <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-300">
        <div className="text-sm text-gray-600">© {new Date().getFullYear()} CogSim</div>
      </div>
    </div>
  );
}