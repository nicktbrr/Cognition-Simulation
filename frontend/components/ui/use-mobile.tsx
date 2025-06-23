import * as React from "react"

// Define the mobile breakpoint for the application.
const MOBILE_BREAKPOINT = 768

// Define the use is mobile function for the application.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  // Use effect to check if the screen is mobile.
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    // Define the onChange function for the application.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    // Add event listener to the mql.
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    // Remove event listener from the mql.
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Return the is mobile state.
  return !!isMobile
}
