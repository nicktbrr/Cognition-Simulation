"use client"

// Import the useTheme function from the next-themes library.
import { useTheme } from "next-themes"

// Import the Toaster component from the sonner library.
import { Toaster as Sonner } from "sonner"

// Define the ToasterProps type for the application.
type ToasterProps = React.ComponentProps<typeof Sonner>

// Define the Toaster component for the application.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  // Return the Toaster component.
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

// Export the Toaster component.
export { Toaster }
