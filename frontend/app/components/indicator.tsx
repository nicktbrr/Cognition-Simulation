"use client";

// StatusIndicator component for the dashboard page.
// It displays a message when a simulation is active.
// It is used in the dashboard page.

const StatusIndicator = ({ isActive, isSuccess, message }: { isActive: boolean, isSuccess?: boolean, message?: string }) => {
  if (!isActive && !isSuccess) return null;

  const bgColor = isSuccess ? "bg-green-600" : "bg-amber-500";
  const displayMessage = message || (isSuccess ? "Simulation complete" : "Simulation is active");
  const icon = isSuccess ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className={`fixed top-0 left-0 w-full ${bgColor} text-white py-1 text-center z-50`}>
      <div className="container mx-auto flex items-center justify-center gap-2">
        {icon}
        <span>{displayMessage}</span>
      </div>
    </div>
  );
};

export default StatusIndicator;
