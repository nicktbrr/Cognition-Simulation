"use client";

const StatusIndicator = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  
  return (
    <div className="fixed top-0 left-0 w-full bg-amber-500 text-white py-1 text-center z-50">
      <div className="container mx-auto flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Simulation is active - Steps 1 and 2 are locked</span>
      </div>
    </div>
  );
};

export default StatusIndicator;