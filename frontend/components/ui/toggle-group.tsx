"use client"

// Import the React library.
import * as React from "react"

// Import the ToggleGroupPrimitive component from the radix-ui library.
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

// Import the VariantProps type from the class-variance-authority library.
import { type VariantProps } from "class-variance-authority"

// Import the cn function from the utils file.
import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

// Define the ToggleGroupContext for the application.
const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

// Define the ToggleGroup component for the application.
const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  // Define the ToggleGroupPrimitive.Root component for the application.
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

// Define the ToggleGroupItem component for the application.
const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  // Define the context for the application.
  const context = React.useContext(ToggleGroupContext)

  // Define the ToggleGroupPrimitive.Item component for the application.
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})

// Define the ToggleGroupItem component for the application.
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

// Export the ToggleGroup and ToggleGroupItem components.
export { ToggleGroup, ToggleGroupItem }
