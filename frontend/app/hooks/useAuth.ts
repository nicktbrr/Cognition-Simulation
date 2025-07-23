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
          console.log("useAuth: No session found, waiting for auth state change...");
          // Don't redirect immediately, wait for auth state change
          return;
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("Error getting user:", userError);
          setIsLoading(false);
          return;
        }

        if (!user) {
          console.log("useAuth: No user found");
          setIsLoading(false);
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
      }
    };

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("useAuth: Auth state change:", event, session?.user?.email);
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          console.log("useAuth: User authenticated, updating state...");
          const userData: UserData = {
            user_email: session.user.email || '',
            user_id: session.user.id,
            pic_url: session.user.identities?.[0]?.identity_data?.avatar_url || session.user.identities?.[0]?.identity_data?.picture || '',
            name: session.user.identities?.[0]?.identity_data?.full_name || session.user.identities?.[0]?.identity_data?.name || session.user.email || ''
          };
          setUser(userData);
          setIsAuthenticated(true);
          setIsLoading(false);
          console.log("useAuth: State updated successfully");
        } else if (event === 'SIGNED_OUT') {
          console.log("useAuth: User signed out");
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          router.push('/');
        }
      }
    );

    checkAuthAndGetUser();

    // Add a timeout to handle cases where auth state change doesn't happen
    const timeoutId = setTimeout(() => {
      console.log("useAuth: Timeout reached, checking session again...");
      checkAuthAndGetUser();
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [router]);

  return {
    user,
    isLoading,
    isAuthenticated,
    signOut
  };
} 