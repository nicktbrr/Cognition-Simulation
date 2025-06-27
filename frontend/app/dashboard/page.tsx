"use client";

import { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Header from "../components/header";
import CollapsibleNav from "../components/collapsible-nav";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { Play } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
        setUser(parsedUser.sub);
        getHistory(parsedUser.sub || '');
      } catch (e) {
        setUser(null);
      }

    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {user && <Header name={user.name} />}
      <CollapsibleNav />
      <main className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Simulation History</h1>
          <Button asChild variant="default" size="sm" className="flex items-center gap-2">
            <Link href="/simulation">
              <Play className="h-4 w-4" />
              Run New Simulation
            </Link>
          </Button>
        </div>
        {history.length === 0 ? (
          <div className="text-gray-500">No simulation history found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Simulation Name</TableHead>
                <TableHead>Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    <a target="_blank" rel="noopener noreferrer" onClick={() => handleDownload(item.url, item.name)}>
                      <Button variant="default" size="sm" className="flex items-center gap-2">
                        <Download className="h-4 w-4" /> Download
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </main>
    </div>
  );
}
