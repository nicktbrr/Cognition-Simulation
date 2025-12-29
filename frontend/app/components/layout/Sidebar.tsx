"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Activity, Users, BarChart3 } from "lucide-react";

interface SidebarProps {
  currentPage: 'dashboard' | 'simulation' | 'measures' | 'samples';
}

export default function Sidebar({ currentPage }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const wasNavigatingRef = useRef(false);

  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: Home, label: 'Dashboard' },
    { id: 'simulation', href: '/simulation', icon: Activity, label: 'Simulation' },
    { id: 'measures', href: '/measures', icon: BarChart3, label: 'Measures' },
    { id: 'samples', href: '/samples', icon: Users, label: 'Samples' },
  ];

  // Keep sidebar open when navigating via sidebar links
  useEffect(() => {
    // When pathname changes (navigation occurred), keep sidebar open if we were navigating
    if (wasNavigatingRef.current) {
      setIsCollapsed(false);
      wasNavigatingRef.current = false;
    }
    
    // Clear any pending collapse timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, [pathname]);

  const handleMouseEnter = () => {
    // Clear any pending collapse timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsCollapsed(false);
  };

  const handleMouseLeave = () => {
    // Add a small delay before collapsing to allow for link clicks
    collapseTimeoutRef.current = setTimeout(() => {
      setIsCollapsed(true);
      collapseTimeoutRef.current = null;
    }, 300);
  };

  const handleLinkClick = () => {
    // Mark that we're navigating via sidebar link
    wasNavigatingRef.current = true;
    // Keep sidebar open when clicking a link
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsCollapsed(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

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
              <Link key={item.id} href={item.href} onClick={handleLinkClick}>
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