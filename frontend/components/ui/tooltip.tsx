"use client"

// Import the React library.
import * as React from "react"

// Import the TooltipPrimitive component from the radix-ui library.
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

// Import the cn function from the utils file.
import { cn } from "@/lib/utils"

// Define the TooltipProvider component.
const TooltipProvider = TooltipPrimitive.Provider

// Define the Tooltip component.
const Tooltip = TooltipPrimitive.Root

// Define the TooltipTrigger component.
const TooltipTrigger = TooltipPrimitive.Trigger

// Define the TooltipContent component.
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))

// Define the TooltipContent component.
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Export the Tooltip component.
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
