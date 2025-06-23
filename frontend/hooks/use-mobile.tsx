import * as React from "react"

// Mobile breakpoint for the application.
const MOBILE_BREAKPOINT = 768

// Hook to check if the screen is mobile.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  // Use effect to check if the screen is mobile.
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    // Function to check if the screen is mobile.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Return the state of the mobile breakpoint.
  return !!isMobile
}
