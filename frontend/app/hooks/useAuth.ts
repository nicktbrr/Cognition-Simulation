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
    let isMounted = true;
    
    const initializeAuth = async () => {
      
      try {
        // First, try to get user from localStorage immediately
        const storedUser = localStorage.getItem("supabaseUser");
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            
            const userData: UserData = {
              user_email: parsedUser.email || '',
              user_id: parsedUser.id,
              pic_url: parsedUser.identities?.[0]?.identity_data?.avatar_url || parsedUser.identities?.[0]?.identity_data?.picture || '',
              name: parsedUser.identities?.[0]?.identity_data?.full_name || parsedUser.identities?.[0]?.identity_data?.name || parsedUser.email || ''
            };
            
            if (isMounted) {
              setUser(userData);
              setIsAuthenticated(true);
              setIsLoading(false);
            }
          } catch (e) {
            console.error("Error parsing localStorage user:", e);
          }
        }
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        if (session?.user) {
          const userData: UserData = {
            user_email: session.user.email || '',
            user_id: session.user.id,
            pic_url: session.user.identities?.[0]?.identity_data?.avatar_url || session.user.identities?.[0]?.identity_data?.picture || '',
            name: session.user.identities?.[0]?.identity_data?.full_name || session.user.identities?.[0]?.identity_data?.name || session.user.email || ''
          };
          
          if (isMounted) {
            setUser(userData);
            setIsAuthenticated(true);
            setIsLoading(false);
          }
        } else {
          if (!storedUser && isMounted) {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Authentication initialization failed:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
          const userData: UserData = {
            user_email: session.user.email || '',
            user_id: session.user.id,
            pic_url: session.user.identities?.[0]?.identity_data?.avatar_url || session.user.identities?.[0]?.identity_data?.picture || '',
            name: session.user.identities?.[0]?.identity_data?.full_name || session.user.identities?.[0]?.identity_data?.name || session.user.email || ''
          };
          setUser(userData);
          setIsAuthenticated(true);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          router.push('/');
        }
      }
    );

    // Initialize auth
    initializeAuth();

    // Cleanup function
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return {
    user,
    isLoading,
    isAuthenticated,
    signOut
  };
} 