"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface AppHeaderProps {
  title: string;
  userData?: UserData | null;
}

export default function AppHeader({ title, userData }: AppHeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { signOut } = useAuth();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      alert("Error signing out. Please try again.");
      console.error("Sign out error:", error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const dropdownContainer = document.querySelector('[data-dropdown-container]');
      
      if (profileDropdownOpen && dropdownContainer && !dropdownContainer.contains(target)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      console.log("Profile dropdown open");
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

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
        
        {/* User Profile Dropdown */}
        <div className="relative" data-dropdown-container>
          <button 
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            {/* Profile Picture */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
              {userData?.pic_url ? (
                <img 
                  src={userData.pic_url} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span>
                  {(userData?.user_email?.split('@')[0]?.charAt(0) || 'U').toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="text-right">
              <div className="font-medium text-gray-900">
                {userData?.user_email?.split('@')[0] || 'User'}
              </div>
              <div className="text-sm text-gray-500">
                {userData?.user_email || 'Loading...'}
              </div>
            </div>
            
            <ChevronDown className={`w-4 h-4 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="py-1">
                <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <User className="w-4 h-4" />
                  Profile Settings
                </button>
                <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Settings className="w-4 h-4" />
                  Preferences
                </button>
                <hr className="my-1 border-gray-200" />
                <button 
                  onClick={(e) => {
                    console.log('Sign out button clicked');
                    handleSignOut();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}