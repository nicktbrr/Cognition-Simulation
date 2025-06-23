"use client"

// Import the useToast function from the use-toast hook.
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

// Define the Toaster component for the application.
export function Toaster() {
  const { toasts } = useToast()

  // Return the Toaster component.
  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Return the Toast component.
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      // Display the ToastViewport component.
        <ToastViewport />
    </ToastProvider>
  )
}