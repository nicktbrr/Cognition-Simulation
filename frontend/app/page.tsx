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
import { LogOut, MousePointer, Check, Lock, Brain, Users, Laptop, LineChart, Shield, Server  } from "lucide-react"
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

export default function Home() {
  const router = useRouter()
  const { user, isLoading, isAuthenticated, signOut } = useAuth()

  // Handle sign out.
  const handleSignOut = async () => {
    await signOut()
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

  // Return the home page.
  return (
    <>

      {/* Main content */}
      <div className="max-w-6xl mx-auto p-6 space-y-8">

        <main className="space-y-8">

          {/* Authentication banner */}
          <section className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#8302AE] mb-6">Welcome to CogSim Portal!</h1>
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
                    Gain immediate entry to your personalized CogSim workspace and all simulation tools.
                  </p>
                </div>
              </div>
            </div>
          </section>


          {/* Features overview */}
          <section className="bg-gray-50 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left side - Simulation Visualization */}
                <div className="relative rounded-xl overflow-hidden shadow-2xl">
                  <img
                    src="https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:1200/https://cdn.gamma.app/wbxlv1atbikacw4/generated-images/SahgKnEAflqgdLFhc_HYL.png"
                    alt="Advanced cognitive simulation visualization"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Right side - Features */}
                <div className="space-y-12">
                  <h2 className="text-4xl font-bold text-[#8302AE]">Features Overview</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Feature 1 */}
                    <div className="space-y-4">
                      <div className="text-[#8302AE]">
                        <Brain className="h-10 w-10" />
                      </div>
                      <h3 className="text-xl font-semibold">Advanced Simulation</h3>
                      <p className="text-gray-600">
                        Create sophisticated cognitive models with our intuitive AI-powered tools designed for researchers at
                        all technical levels.
                      </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="space-y-4">
                      <div className="text-[#8302AE]">
                        <Users className="h-10 w-10" />
                      </div>
                      <h3 className="text-xl font-semibold">Real-time Collaboration</h3>
                      <p className="text-gray-600">
                        Work seamlessly with colleagues across the globe, sharing simulations and insights with secure,
                        instant synchronization.
                      </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="space-y-4">
                      <div className="text-[#8302AE]">
                        <Laptop className="h-10 w-10" />
                      </div>
                      <h3 className="text-xl font-semibold">Cross-platform Access</h3>
                      <p className="text-gray-600">
                        Access your simulations from any device or operating system with our responsive, cloud-based platform.
                      </p>
                    </div>

                    {/* Feature 4 */}
                    <div className="space-y-4">
                      <div className="text-[#8302AE]">
                        <LineChart className="h-10 w-10" />
                      </div>
                      <h3 className="text-xl font-semibold">Powerful Analytics</h3>
                      <p className="text-gray-600">
                        Gain deeper insights with comprehensive data visualization and analytical tools built for social
                        scientific research.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>


          {/* About CogSim */}
          <section className="bg-gray-50 py-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-4xl font-bold text-[#8302AE] text-center mb-16">About CogSim</h2>

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


          {/* Security assurance */}
          <section className="bg-gray-50 py-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-4xl font-bold text-[#8302AE] text-center mb-16">Security Assurance</h2>

              <div className="relative max-w-3xl mx-auto">
                {/* Diagonal background lines - for visual effect */}
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gray-100 transform -rotate-12 origin-top-left"></div>

                <div className="space-y-8">
                  {/* End-to-End Protection */}
                  <div className="flex items-start gap-6 border-b border-gray-200 pb-8">
                    <div className="p-3 rounded-full bg-white shadow-sm">
                      <Shield className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">End-to-End Protection</h3>
                      <p className="text-gray-600 mt-1">Enterprise-grade security at every level</p>
                    </div>
                  </div>

                  {/* Data Encryption */}
                  <div className="flex items-start gap-6 border-b border-gray-200 pb-8">
                    <div className="p-3 rounded-full bg-white shadow-sm">
                      <Lock className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Data Encryption</h3>
                      <p className="text-gray-600 mt-1">AES-256 encryption for all stored data</p>
                    </div>
                  </div>

                  {/* Secure Infrastructure */}
                  <div className="flex items-start gap-6 border-b border-gray-200 pb-8">
                    <div className="p-3 rounded-full bg-white shadow-sm">
                      <Server className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Secure Infrastructure</h3>
                      <p className="text-gray-600 mt-1">SOC 2 compliant cloud architecture</p>
                    </div>
                  </div>
                </div>

                {/* Bottom text */}
                <div className="mt-12 text-center">
                  <p className="text-gray-700 max-w-3xl mx-auto">
                    Your research deserves the highest level of protection. That's why we implement bank-level security
                    protocols and regular third-party security audits to ensure your valuable data remains protected.
                  </p>
                </div>
              </div>
            </div>
          </section>
          

          {/* Support information */}
          <section
      className="relative py-16 bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:2400/https://cdn.gamma.app/wbxlv1atbikacw4/generated-images/6mOvIb9bIAlndFkJPnlKy.png')",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <h2 className="text-4xl font-bold text-[#8302AE] text-center mb-16">Support Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* 24/7 Support Hours */}
          <div className="text-center">
            <div className="text-5xl font-bold mb-4">24/7</div>
            <h3 className="text-xl font-semibold mb-2">Support Hours</h3>
            <p className="text-gray-600">Around-the-clock assistance for critical issues</p>
          </div>

          {/* Response Time */}
          <div className="text-center">
            <div className="text-5xl font-bold mb-4">3min</div>
            <h3 className="text-xl font-semibold mb-2">Response Time</h3>
            <p className="text-gray-600">Average email response during business hours</p>
          </div>

          {/* Uptime */}
          <div className="text-center">
            <div className="text-5xl font-bold mb-4">99.9%</div>
            <h3 className="text-xl font-semibold mb-2">Uptime</h3>
            <p className="text-gray-600">Platform reliability you can count on</p>
          </div>
        </div>

        {/* Support Description */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-gray-700">
            Our dedicated support team is ready to help with any questions or technical issues. Access our comprehensive
            knowledge base or contact <span className="font-medium">support@cogsim.ai</span> for personalized
            assistance.
          </p>
        </div>
      </div>
    </section>


    {/* Join the CogSim community */} 
    <div className="bg-gray-50 py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-[#8302AE] text-center mb-12">Join the CogSim Community</h2>

        <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="space-y-4">
          <AccordionItem value="item-1" className="border border-gray-200 rounded-md bg-white">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-left font-medium">What kinds of research can I conduct with CogSim?</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 pt-0 text-gray-600">
              CogSim supports a wide range of social scientific research including cognitive modeling, decision-making
              simulations, social network analysis, behavioral economics experiments, and educational psychology
              studies.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border border-gray-200 rounded-md bg-white">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-left font-medium">
                Is CogSim suitable for both individual researchers and teams?
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 pt-0 text-gray-600">
              CogSim scales seamlessly from individual researchers to large collaborative teams with customizable
              permissions and workspace configurations.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border border-gray-200 rounded-md bg-white">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-left font-medium">How do I cite CogSim in my research publications?</span>
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
