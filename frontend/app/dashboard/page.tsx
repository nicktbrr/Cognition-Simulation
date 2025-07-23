"use client";

import { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Header from "../components/header";
import CollapsibleNav from "../components/collapsible-nav";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { Play } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";

interface SimulationHistoryItem {
  created_at: string; // ISO string
  name: string;
  url: string;
}

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

export default function DashboardHistory() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const getHistory = async (userId: string) => {
    const { data, error } = await supabase.from("dashboard").select("created_at, name, url").eq("user_id", userId);
    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data);
    }
  }

  const getUserData = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_emails")
      .select("user_email, user_id, pic_url")
      .eq("user_id", userId)
      .single();
    
    if (error) {
      console.error("Error fetching user data:", error);
    } else {
      await setUserData(data);
      console.log("Dashboard: User data received:", data);
    }
  }

  const handleDownload = async (public_url: string, filename: string) => {
    try {
      // Fetch the file from the public URL
      const response = await fetch(public_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link to trigger the download
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `cogsim_${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      // Clean up the temporary link and object URL
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading CSV:", error);
    }
  };

  useEffect(() => {
    console.log("Dashboard: useEffect triggered, user:", "isAuthenticated:", isAuthenticated);
    if (user && isAuthenticated) {
      // Fetch user data from user_emails table
      getUserData(user.user_id);
      // Fetch simulation history
      getHistory(user.user_id);
    }
  }, [user, isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <AuthLoading message="Loading dashboard..." />;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }



  // Only use real history data
  let displayHistory = history;

  // Pagination logic
  const totalRows = displayHistory.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedRows = displayHistory.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div style={{display: "flex", justifyContent: "center", alignItems: "center", height: "100vh"}}>
      <section style={{width: "1154px", padding: "81px 60px"}}>
       
          <h1 className="text-5xl font-extrabold text-[#7b61ff] text-left mb-2" style={{marginBottom: "34px"}}>Hello You!</h1>
          <p className="text-lg text-gray-700 text-left mb-10" style={{marginBottom: "34px"}}>Welcome back! Here's a quick overview of your recent simulation files.</p>
          <div className="flex flex-row" style={{gap: "30px"}}>
              <div>
                <img src={userData?.pic_url || "https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:2000/https://cdn.gamma.app/wbxlv1atbikacw4/generated-images/Wz20NF2uCYWA2hjxzFGwh.png"} alt="Profile" className="w-50 h-50 rounded-2xl object-cover mb-8 border-4 border-white shadow" style={{height: "335px", width: "335px"}} />
                <h2 className="text-2xl font-bold text-[#7b61ff] mb-1">{userData?.user_email?.split('@')[0] || "User"}</h2>
                <p className="text-gray-700 mb-2">{userData?.user_email || "Loading..."}</p>
              </div>
              <div style={{marginLeft: "30px", flex: 1, position: "relative", minHeight: "500px"}}>
                <h2 className="text-2xl font-bold text-[#7b61ff] mb-1" style={{marginBottom: "17px", marginTop: "17px"}}>Your Recent Simulations</h2>
                <p className="text-gray-700 mb-2" style={{marginBottom: "17px"}}>Click on any file to download results and continue your research.</p>
                {history.length === 0 ? (
                  <div className="text-gray-500">No simulation history found.</div>
                ) : (
                  <div>
                      <div style={{maxHeight: '400px', overflowY: 'auto', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'}}>
                        <table className="min-w-full table-fixed">
                          <thead>
                            <tr>
                              <th className="w-1/2 px-6 py-4 text-left text-base font-semibold text-gray-700">Simulation Name</th>
                              <th className="w-1/4 px-6 py-4 text-left text-base font-semibold text-gray-700">Date</th>
                              <th className="w-1/4 px-6 py-4 text-left text-base font-semibold text-gray-700">Download</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRows.map((item, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-[#f7f8fa]" : "bg-white"}>
                                <td className="px-6 py-4">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#7b61ff] font-bold underline underline-offset-2 decoration-dotted hover:text-[#5a41c8] cursor-pointer"
                                    onClick={e => { e.preventDefault(); handleDownload(item.url, item.name); }}
                                  >
                                    {item.name}
                                  </a>
                                </td>
                                <td className="px-6 py-4 text-base">{new Date(item.created_at).toISOString().slice(0, 10)}</td>
                                <td className="px-6 py-4">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#7b61ff] font-bold underline underline-offset-2 decoration-dotted hover:text-[#5a41c8] cursor-pointer"
                                    onClick={e => { e.preventDefault(); handleDownload(item.url, item.name); }}
                                  >
                                    Download Results
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4">
                          <button
                            className="px-3 py-1 rounded text-[#7b61ff] font-semibold disabled:opacity-50"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => (
                            <button
                              key={i}
                              className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-[#7b61ff] text-white' : 'text-[#7b61ff]'} font-semibold`}
                              onClick={() => handlePageChange(i + 1)}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button
                            className="px-3 py-1 rounded text-[#7b61ff] font-semibold disabled:opacity-50"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                {/* Simulation Button at bottom right */}
                <div style={{position: "absolute", right: 0, bottom: "-100px", margin: "30px"}}>
                  <Link href="/simulation">
                    <button
                      className="bg-gradient-to-r from-[#7b61ff] to-[#6a82fb] text-white font-bold py-3 px-8 rounded-full shadow-md text-lg hover:from-[#5a41c8] hover:to-[#7b61ff] transition-all"
                    >
                      + New Simulation
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      );  
}