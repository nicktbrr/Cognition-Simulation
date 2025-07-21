interface AuthLoadingProps {
  message?: string;
}

export default function AuthLoading({ message = "Loading..." }: AuthLoadingProps) {
  return (
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh"}}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7b61ff] mx-auto mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
} 