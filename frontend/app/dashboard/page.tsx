"use client";

import { useEffect, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Header from "../components/header";
import CollapsibleNav from "../components/collapsible-nav";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { Play } from "lucide-react";

interface SimulationHistoryItem {
  date: string; // ISO string
  title: string;
  downloadUrl: string;
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

  useEffect(() => {
    // Get user info
    const storedUser = localStorage.getItem("googleUser");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setUser(null);
      }
    }
    
    // Add dummy simulation history data for testing
    setHistory([
      {
        date: new Date().toISOString(),
        title: "Cognitive Flow Test 1",
        downloadUrl: "https://example.com/simulation1.xlsx"
      },
      {
        date: new Date(Date.now() - 86400000).toISOString(),
        title: "Memory Evaluation Run",
        downloadUrl: "https://example.com/simulation2.xlsx"
      },
      {
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        title: "Reasoning Chain Alpha",
        downloadUrl: "https://example.com/simulation3.xlsx"
      }
    ]);
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
                  <TableCell>{new Date(item.date).toLocaleString()}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>
                    <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer">
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
