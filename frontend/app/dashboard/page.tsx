"use client";

import { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Header from "../components/header";
import CollapsibleNav from "../components/collapsible-nav";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { Play } from "lucide-react";
import { supabase } from "@/app/page";

interface SimulationHistoryItem {
  created_at: string; // ISO string
  name: string;
  url: string;
}

interface GoogleUser {
  name: string;
  email: string;
  picture: string;
  sub: string;
}

export default function DashboardHistory() {
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [user, setUser] = useState<GoogleUser | null>(null);
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
    // Get user info
    const storedUser = localStorage.getItem("googleUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
     
        setUser(parsedUser);
        getHistory(parsedUser.sub || '');
      } catch (e) {
        setUser(null);
      }

    }
  }, []);

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
                <img src={user?.picture || "https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:2000/https://cdn.gamma.app/wbxlv1atbikacw4/generated-images/Wz20NF2uCYWA2hjxzFGwh.png"} alt="Profile" className="w-50 h-50 rounded-2xl object-cover mb-8 border-4 border-white shadow" style={{height: "335px", width: "335px"}} />
                <h2 className="text-2xl font-bold text-[#7b61ff] mb-1">{user?.name || ""}</h2>
                <p className="text-gray-700 mb-2">{user?.email || "john.doe@example.com"}</p>
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