'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../utils/supabase'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const AzureSignInComponent = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleAzureSignIn = async () => {
    setIsLoading(true)
    
    try {
      // Use Supabase's built-in OAuth for Microsoft
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid email profile'
        }
      })

      if (error) {
        console.error('Error initiating Azure sign-in:', error)
        throw error
      }

      // The OAuth flow will redirect to Microsoft, then back to our callback
      // No need to handle the response here as it will be handled in the callback
      
    } catch (error) {
      console.error('Error with Azure sign-in:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <Button
        onClick={handleAzureSignIn}
        disabled={isLoading}
        className="w-full max-w-[250px] bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium py-3 px-6 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Signing in...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
            </svg>
            Sign in with Microsoft
          </>
        )}
      </Button>
    </div>
  )
}

export default AzureSignInComponent
