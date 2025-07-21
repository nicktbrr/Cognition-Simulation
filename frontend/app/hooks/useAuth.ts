import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../utils/supabase';

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
  name?: string;
}

interface UseAuthReturn {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem("supabaseUser");
        router.push('/');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Fallback to manual cleanup
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("supabaseUser");
      window.location.replace('/');
    }
  };

  useEffect(() => {
    const checkAuthAndGetUser = async () => {
      
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          setIsLoading(false);
          return;
        }

        if (!session) {
          setIsLoading(false);
          router.push('/');
          return;
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("Error getting user:", userError);
          setIsLoading(false);
          router.push('/');
          return;
        }

        if (!user) {
          setIsLoading(false);
          router.push('/');
          return;
        }

        // User is authenticated, set user data
        const userData: UserData = {
          user_email: user.email || '',
          user_id: user.id,
          pic_url: user.identities?.[0]?.identity_data?.avatar_url || user.identities?.[0]?.identity_data?.picture || '',
          name: user.identities?.[0]?.identity_data?.full_name || user.identities?.[0]?.identity_data?.name || user.email || ''
        };
        
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Authentication check failed:", error);
        setIsLoading(false);
        router.push('/');
      }
    };

    checkAuthAndGetUser();
  }, [router]);

  return {
    user,
    isLoading,
    isAuthenticated,
    signOut
  };
} 