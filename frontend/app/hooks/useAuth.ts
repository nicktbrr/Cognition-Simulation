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
      console.log('useAuth: Initializing authentication...');
      
      try {
        // First, try to get user from localStorage immediately
        const storedUser = localStorage.getItem("supabaseUser");
        if (storedUser) {
          console.log('useAuth: Found user in localStorage');
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

        // Then check Supabase session
        console.log('useAuth: Checking Supabase session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        if (session?.user) {
          console.log('useAuth: Found user in Supabase session');
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
          console.log('useAuth: No Supabase session found');
          // No session found, check if we have localStorage data
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
          console.log('useAuth: User signed in via auth state change');
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
          console.log('useAuth: User signed out');
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