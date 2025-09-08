'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../utils/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          router.push('/auth/auth-code-error')
          return
        }

        if (data.session?.user) {
          // Store user data in localStorage for consistency with Google OAuth
          localStorage.setItem('supabaseUser', JSON.stringify(data.session.user))
          
          // Push user data to user_emails table (same as Google OAuth)
          try {
            const { error: insertError } = await supabase
              .from('user_emails')
              .upsert({
                uuid: crypto.randomUUID(),
                user_email: data.session.user.email,
                user_id: data.session.user.id,
                pic_url: data.session.user.identities?.[0]?.identity_data?.avatar_url || 
                         data.session.user.identities?.[0]?.identity_data?.picture || 
                         null
              },
              { onConflict: 'user_email' });
            
            if (insertError) {
              console.error('Error inserting user data:', insertError)
            }
          } catch (insertError) {
            console.error('Error pushing user data to database:', insertError)
          }

          // Redirect to dashboard
          router.push('/dashboard')
        } else {
          // No session found, redirect to home
          router.push('/')
        }
      } catch (error) {
        console.error('Error in auth callback:', error)
        router.push('/auth/auth-code-error')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#8302AE] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  )
}
