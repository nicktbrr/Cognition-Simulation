"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X, Search } from 'lucide-react'
import { Button } from './button'
import { Input } from '../../../components/ui/input'

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`

interface MultiselectOption {
  id: string
  title: string
  description: string
}

interface MultiselectProps {
  options: MultiselectOption[]
  selectedValues: string[]
  onSelectionChange: (selectedIds: string[]) => void
  placeholder?: string
  loading?: boolean
  className?: string
}

export default function Multiselect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  loading = false,
  className = ""
}: MultiselectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Inject custom scrollbar styles
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.textContent = scrollbarStyles
    document.head.appendChild(styleElement)
    
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    // Use capture phase to catch events early
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('touchstart', handleClickOutside, true)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('touchstart', handleClickOutside, true)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Filter options based on search query
  const filteredOptions = options.filter(option => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return option.title.toLowerCase().includes(query) || 
           option.description.toLowerCase().includes(query)
  })


  const handleToggleOption = (optionId: string) => {
    const newSelection = selectedValues.includes(optionId)
      ? selectedValues.filter(id => id !== optionId)
      : [...selectedValues, optionId]
    
    onSelectionChange(newSelection)
  }

  const handleRemoveOption = (optionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const newSelection = selectedValues.filter(id => id !== optionId)
    onSelectionChange(newSelection)
  }

  const getSelectedOptions = () => {
    return options.filter(option => selectedValues.includes(option.id))
  }

  const selectedOptions = getSelectedOptions()

  const handleButtonBlur = (e: React.FocusEvent) => {
    // Only close if focus is moving outside the entire dropdown component
    // Use setTimeout to allow click events to process first
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }, 150)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={handleButtonBlur}
        className="w-full justify-between text-left h-auto min-h-[40px] p-2"
        disabled={loading}
      >
        <div className="flex flex-wrap gap-1 flex-1 max-h-20 overflow-y-scroll">
          {selectedOptions.length === 0 ? (
            <span className="text-muted-foreground">
              {loading ? "Loading..." : placeholder}
            </span>
          ) : (
            selectedOptions.map(option => (
              <span
                key={option.id}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md"
              >
                {option.title}
                <span
                  onClick={(e) => handleRemoveOption(option.id, e)}
                  className="hover:bg-blue-200 rounded-full p-0.5 cursor-pointer inline-flex items-center justify-center"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleRemoveOption(option.id, e as any)
                    }
                  }}
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div 
          className="absolute z-[99999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col max-h-80"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-200 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search measures..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false)
                    setSearchQuery('')
                  }
                }}
              />
            </div>
          </div>

          {/* Options List - Scrollable */}
          <div 
            className="overflow-y-auto custom-scrollbar flex-1"
            style={{
              scrollbarWidth: 'auto',
              msOverflowStyle: 'scrollbar'
            }}
          >
            {loading ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                Loading options...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {searchQuery ? "No measures found" : "No options available"}
              </div>
            ) : (
              <div className="py-1">
                {filteredOptions.map(option => {
                const isSelected = selectedValues.includes(option.id)
                return (
                  <div
                    key={option.id}
                    onClick={() => handleToggleOption(option.id)}
                    className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 border border-gray-300 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {option.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {option.description}
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
