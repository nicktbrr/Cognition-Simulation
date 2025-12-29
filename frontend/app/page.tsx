"use client"
// Home page for the application.
// It displays a welcome message and a description of the platform.
// It also displays the name of the user who is logged in.
// It is used in the app/page.tsx file.

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LogOut, MousePointer, Check, Lock, Brain, Users, Laptop, LineChart, Shield, Server, FileText, Edit, Trash2  } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import OneTapComponent from "./components/onetap"
import { supabase } from "./utils/supabase"
import { useAuth } from "./hooks/useAuth"

// Type declarations for Google API
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          disableAutoSelect: () => void;
          revoke: (id: string, callback: () => void) => void;
        };
      };
    };
  }
}

interface Draft {
  experiment_id: string;
  title: string;
  created_at: string;
  sample_name: string;
}

export default function Home() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated, signOut } = useAuth()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  // Handle sign out.
  const handleSignOut = async () => {
    await signOut()
  }

  // Fetch drafts for the authenticated user
  const fetchDrafts = async (userId: string) => {
    setLoadingDrafts(true)
    try {
      const { data, error } = await supabase
        .from("experiments")
        .select("experiment_id, experiment_data, created_at")
        .eq("user_id", userId)
        .eq("status", "Draft")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.error("Error fetching drafts:", error)
        setDrafts([])
        return
      }

      const formattedDrafts: Draft[] = (data || []).map((experiment: any) => {
        const experimentData = experiment.experiment_data || {}
        return {
          experiment_id: experiment.experiment_id,
          title: experimentData.title || "Untitled Simulation",
          created_at: experiment.created_at,
          sample_name: experimentData.sample?.name || "No sample"
        }
      })

      setDrafts(formattedDrafts)
    } catch (error) {
      console.error("Error processing drafts:", error)
      setDrafts([])
    } finally {
      setLoadingDrafts(false)
    }
  }

  // Delete a draft
  const handleDeleteDraft = async (experimentId: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) {
      return
    }

    if (!user) return

    try {
      const { error } = await supabase
        .from("experiments")
        .delete()
        .eq("experiment_id", experimentId)
        .eq("user_id", user.user_id)

      if (error) {
        console.error("Error deleting draft:", error)
        alert(`Error deleting draft: ${error.message}`)
        return
      }

      // Refresh drafts list
      fetchDrafts(user.user_id)
    } catch (error) {
      console.error("Error deleting draft:", error)
      alert(`Error deleting draft: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Push user data to user_emails table when user is authenticated
  useEffect(() => {
    const pushUserToDatabase = async () => {
      if (user && isAuthenticated) {
        try {
          const { error: insertError } = await supabase
            .from('user_emails')
            .upsert({
              uuid: crypto.randomUUID(),
              user_email: user.user_email,
              user_id: user.user_id,
              pic_url: user.pic_url
            }, {
              onConflict: 'user_email'
            })
          
          if (insertError) {
            console.error('Error inserting user data:', insertError)
          }
        } catch (insertError) {
          console.error('Error pushing user data to database:', insertError)
        }
      }
    }
    
    pushUserToDatabase()
  }, [user, isAuthenticated])

  // Fetch drafts when user is authenticated
  useEffect(() => {
    if (user && isAuthenticated) {
      fetchDrafts(user.user_id)
    } else {
      setDrafts([])
    }
  }, [user, isAuthenticated])

  // Return the home page.
  return (
    <>

      {/* Main content */}
      <div className="max-w-6xl mx-auto p-6 space-y-8">

        <main className="space-y-8">

          {/* Authentication banner */}
          <section className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#8302AE] mb-6">Welcome to Psycsim Portal!</h1>
              <p className="text-gray-700 mb-8 max-w-lg">
                Your gateway to cutting-edge cognitive simulations powered by artificial intelligence. Experience the future
                of social scientific experimentation today.
              </p>
              {isAuthenticated && user ? (
                <div className="flex gap-3">
                  <Link href="/dashboard">
                    <button
                      className="bg-gradient-to-r from-[#8302AE] to-[#6a4bc4] text-white font-bold py-3 px-6 rounded-lg shadow-md hover:from-[#6a4bc4] hover:to-[#8302AE] transition-all"
                    >
                      Go to Dashboard
                    </button>
                  </Link>
                  <Link href="/simulation">
                    <Button
                      variant="outline"
                      className="border-[#8302AE] text-[#8302AE] font-bold py-3 px-6 rounded-lg hover:bg-[#8302AE] hover:text-white transition-all"
                    >
                      Start New Simulation
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-gray-500">
                  <OneTapComponent />
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <img
                src="https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:1200/https://cdn.gamma.app/wbxlv1atbikacw4/generated-images/JRfwHX2FKaUmHiSNNnGGT.png"
                alt="Neural network visualization"
                className="rounded-lg shadow-lg"
              />
            </div>
          </section>

          {/* Drafts Section - Only show if user is authenticated */}
          {isAuthenticated && user && (
            <section className="max-w-7xl mx-auto px-6 py-8">
              <h2 className="text-3xl md:text-4xl font-bold text-[#8302AE] mb-6">Your Drafts</h2>
              {loadingDrafts ? (
                <div className="text-center py-8 text-gray-500">Loading drafts...</div>
              ) : drafts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No drafts yet. Start a new simulation to save a draft.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drafts.map((draft) => (
                    <Card key={draft.experiment_id} className="bg-white shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-2 line-clamp-2">
                            {draft.title}
                          </h3>
                          <button
                            onClick={() => handleDeleteDraft(draft.experiment_id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="Delete draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Sample:</span> {draft.sample_name}
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                          Created: {new Date(draft.created_at).toLocaleDateString()}
                        </p>
                        <Link href={`/simulation?modify=${draft.experiment_id}`}>
                          <Button
                            variant="outline"
                            className="w-full border-[#8302AE] text-[#8302AE] hover:bg-[#8302AE] hover:text-white transition-all"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Continue Editing
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Authentication banner */}
          <section className="max-w-7xl mx-auto px-6 py-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#8302AE] mb-12 text-center">Authentication Banner</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white shadow-md border border-gray-100">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-4">Secure Access</h3>
                  <p className="text-gray-600">
                    Your simulations and research data are protected behind industry-standard authentication protocols.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-md border border-gray-100">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-4">Seamless Integration</h3>
                  <p className="text-gray-600">
                    One-click sign-in gets you immediate access to your personalized dashboard and all simulation tools.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-md border border-gray-100">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-4">Privacy Focused</h3>
                  <p className="text-gray-600">
                    We prioritize your data privacy with strict controls and transparent policies that put you in control.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>


          {/* Google authentication banner */}
          <section className="min-h-screen bg-[#8302AE] bg-gradient-to-br from-[#8302AE] to-[#6a4bc4] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-4xl w-full">
              <h1 className="text-[#8302AE] text-3xl md:text-4xl font-bold text-center mb-12">Google Authentication</h1>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 relative">
                {/* Connecting lines */}
                <div className="hidden md:block absolute top-1/4 left-1/3 w-1/3 h-0.5 bg-gray-200"></div>
                <div className="hidden md:block absolute top-1/4 right-1/3 w-1/3 h-0.5 bg-gray-200"></div>

                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center mb-6">
                    <MousePointer className="h-8 w-8 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Click Sign In</h3>
                  <p className="text-gray-600 text-center">
                    Tap the Google authentication button to begin the secure sign-in process.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center mb-6">
                    <Check className="h-8 w-8 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Verify Identity</h3>
                  <p className="text-gray-600 text-center">
                    Confirm your Google account credentials through Google's secure authentication system.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full border-2 border-gray-200 flex items-center justify-center mb-6">
                    <Lock className="h-8 w-8 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Access Granted</h3>
                  <p className="text-gray-600 text-center">
                    Gain immediate entry to your personalized Psycsim workspace and all simulation tools.
                  </p>
                </div>
              </div>
            </div>
          </section>


          {/* About Psycsim */}
          <section className="bg-gray-50 py-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-4xl font-bold text-[#8302AE] text-center mb-16">About Psycsim</h2>

              <div className="relative">
                {/* Timeline line */}
                <div className="absolute top-24 left-0 right-0 h-0.5 bg-gray-200 hidden md:block"></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Founding Vision */}
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold mb-4">Founding Vision</h3>
                      <p className="text-gray-600">
                        Established in 2021 by leading cognitive scientists and AI researchers to democratize access to
                        advanced simulation tools.
                      </p>
                    </div>
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-lg font-semibold z-10 relative">
                        1
                      </div>
                      <div className="absolute top-6 left-1/2 h-12 w-0.5 bg-gray-200 -z-10"></div>
                    </div>
                  </div>

                  {/* Our Mission */}
                  <div className="flex flex-col items-center text-center">
                    <div className="order-2 md:order-1 mt-12 md:mt-0">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-lg font-semibold z-10 relative">
                          2
                        </div>
                        <div className="absolute top-6 left-1/2 h-12 w-0.5 bg-gray-200 -z-10"></div>
                      </div>
                    </div>
                    <div className="order-1 md:order-2 md:mt-12">
                      <h3 className="text-xl font-semibold mb-4">Our Mission</h3>
                      <p className="text-gray-600">
                        To accelerate social scientific discovery by combining cutting-edge AI with intuitive interfaces
                        accessible to researchers worldwide.
                      </p>
                    </div>
                  </div>

                  {/* Community Focus */}
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold mb-4">Community Focus</h3>
                      <p className="text-gray-600">
                        Supporting over 5,000 researchers across 120 universities and research institutions with continuously
                        evolving capabilities.
                      </p>
                    </div>
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-lg font-semibold z-10 relative">
                        3
                      </div>
                      <div className="absolute top-6 left-1/2 h-12 w-0.5 bg-gray-200 -z-10"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>


    {/* Join the Psycsim community */} 
    <div className="bg-gray-50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-[#8302AE] text-center mb-12">Join the Psycsim Community</h2>

        <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="space-y-4">
          <AccordionItem value="item-1" className="border border-gray-200 rounded-md bg-white">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-left font-medium">What kinds of research can I conduct with Psycsim?</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 pt-0 text-gray-600">
              Psycsim supports a wide range of social scientific research including cognitive modeling, decision-making
              simulations, social network analysis, behavioral economics experiments, and educational psychology
              studies.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border border-gray-200 rounded-md bg-white">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-left font-medium">
                Is Psycsim suitable for both individual researchers and teams?
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 pt-0 text-gray-600">
              Psycsim scales seamlessly from individual researchers to large collaborative teams with customizable
              permissions and workspace configurations.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border border-gray-200 rounded-md bg-white">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-left font-medium">How do I cite Psycsim in my research publications?</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 pt-0 text-gray-600">
              We provide standardized citation formats in APA, MLA, and Chicago styles for all simulations created on
              our platform, making academic attribution straightforward.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>

      {/* Footer */}




        </main>
      </div>
    </>
  );
}
