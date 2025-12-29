"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Home, Activity, Users, BarChart3 } from "lucide-react";

interface SidebarProps {
  currentPage: 'dashboard' | 'simulation' | 'measures' | 'samples';
}

export default function Sidebar({ currentPage }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: Home, label: 'Dashboard' },
    { id: 'simulation', href: '/simulation', icon: Activity, label: 'Simulation' },
    { id: 'measures', href: '/measures', icon: BarChart3, label: 'Measures' },
    { id: 'samples', href: '/samples', icon: Users, label: 'Samples' },
  ];

  const handleMouseEnter = () => {
    setIsCollapsed(false);
  };

  const handleMouseLeave = () => {
    setIsCollapsed(true);
  };

  return (
    <div 
      className={`bg-gray-100 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className={`bg-gray-100 border-b border-gray-200 overflow-hidden transition-all duration-300 ${
        isCollapsed ? 'px-4 py-7' : 'px-8 py-7'
      }`}>
        <h1 className={`text-2xl font-bold text-blue-600 whitespace-nowrap transition-opacity duration-300 ${
          isCollapsed ? 'opacity-0 w-0 h-0 overflow-hidden' : 'opacity-100'
        }`}>
          Psycsim
        </h1>
        {isCollapsed && (
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className={`flex-1 pt-4 transition-all duration-300 ${
        isCollapsed ? 'px-2' : 'px-4'
      }`}>
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <Link key={item.id} href={item.href}>
                <div className={`flex items-center rounded-lg transition-all duration-200 ${
                  isCollapsed ? 'justify-center px-3' : 'gap-3 px-4'
                } py-3 ${
                  isActive 
                    ? 'text-white bg-blue-600' 
                    : 'text-gray-700 hover:bg-gray-200'
                }`}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`${isActive ? 'font-medium' : ''} whitespace-nowrap transition-opacity duration-300 ${
                    isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                  }`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Footer */}
      <div className={`border-t border-gray-300 overflow-hidden transition-all duration-300 ${
        isCollapsed ? 'p-2' : 'p-4'
      }`}>
        <div className={`text-sm text-gray-600 whitespace-nowrap transition-opacity duration-300 ${
          isCollapsed ? 'opacity-0 h-0' : 'opacity-100'
        }`}>
          © {new Date().getFullYear()} Psycsim
        </div>
      </div>
    </div>
  );
}