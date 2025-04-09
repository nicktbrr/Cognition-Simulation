"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import Script from "next/script"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react"
// Define Google credential response type
interface CredentialResponse {
  credential: string
  select_by: string
}

interface GoogleUser {
  name: string
  email: string
  picture: string
  sub: string // Google's user ID
}


export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  const parseJwt = (token: string) => {
    try {
      return JSON.parse(atob(token.split(".")[1]))
    } catch (e) {
      return null
    }
  }

  // Handle credential response from Google One Tap
  const handleCredentialResponse = useCallback((response: CredentialResponse) => {
    const decodedToken = parseJwt(response.credential)

    if (decodedToken) {
      const { name, email, picture, sub } = decodedToken
      setUser({ name, email, picture, sub })

      // Store in localStorage for persistence
      localStorage.setItem("googleUser", JSON.stringify({ name, email, picture, sub }))

      // Redirect to dashboard
      router.push('/dashboard')
    }
  }, [router])

  // Initialize Google One Tap
  const initializeGoogleOneTap = useCallback(() => {
    if (!window.google || !scriptLoaded) return

    try {
      console.log(process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID)
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      window.google.accounts.id.renderButton(document.getElementById("googleOneTap")!, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 250,
      })

      // Also display the One Tap prompt
      if (!user) {
        window.google.accounts.id.prompt()
        //window.location.href = "/dashboard"
      }
    } catch (error) {
      console.error("Error initializing Google One Tap:", error)
    }
  }, [handleCredentialResponse, scriptLoaded, user])

  // Handle sign out
  const handleSignOut = () => {
    if (window.google && scriptLoaded) {
      window.google.accounts.id.disableAutoSelect()
      window.google.accounts.id.revoke(user?.sub || "", () => {
        setUser(null)
        localStorage.removeItem("googleUser")

      })
    } else {
      setUser(null)
      localStorage.removeItem("googleUser")

    }
  }

  // Check for existing user session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("googleUser")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        // Redirect to dashboard if already logged in
        router.push('/dashboard')
      } catch (e) {
        localStorage.removeItem("googleUser")
      }
    }
  }, [router])

  // Initialize Google One Tap when script is loaded
  useEffect(() => {
    if (scriptLoaded) {
      initializeGoogleOneTap()
    }
  }, [scriptLoaded, initializeGoogleOneTap])

  return (
    <>
      <div className="max-w-6xl mx-auto p-6 space-y-8">

        <main className="space-y-8">
          <Script
            src="https://accounts.google.com/gsi/client"
            onLoad={() => setScriptLoaded(true)}
            strategy="afterInteractive"
          />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-teal-400 font-medium">{user.name}</p>
                <p className="text-white/70 text-sm">{user.email}</p>
              </div>
              <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-teal-400">
                <Image
                  src={user.picture || "/placeholder.svg"}
                  alt="User avatar"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-teal-400 text-teal-400 hover:bg-teal-400 hover:text-indigo-950"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div id="googleOneTap"></div>
          )}



        </main>
      </div>
    </>
  );
}
