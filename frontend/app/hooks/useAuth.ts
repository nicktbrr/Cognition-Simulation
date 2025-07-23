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

  console.log("useAuth: Hook initialized, current state:", { isLoading, isAuthenticated, hasUser: !!user });

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
    console.log("useAuth: useEffect triggered");
    
    // Immediate localStorage check as first priority
    const storedUser = localStorage.getItem("supabaseUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("useAuth: Immediate localStorage check found user:", parsedUser.email);
        
        const userData: UserData = {
          user_email: parsedUser.email || '',
          user_id: parsedUser.id,
          pic_url: parsedUser.identities?.[0]?.identity_data?.avatar_url || parsedUser.identities?.[0]?.identity_data?.picture || '',
          name: parsedUser.identities?.[0]?.identity_data?.full_name || parsedUser.identities?.[0]?.identity_data?.name || parsedUser.email || ''
        };
        
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);
        console.log("useAuth: State updated immediately from localStorage");
        return; // Exit early if we found user in localStorage
      } catch (e) {
        console.error("useAuth: Error parsing immediate localStorage user:", e);
      }
    }
    
    const checkAuthAndGetUser = async () => {
      
      try {
        console.log("useAuth: Starting session check...");
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("useAuth: Error getting session:", sessionError);
          setIsLoading(false);
          return;
        }

        if (!session) {
          console.log("useAuth: No session found, checking localStorage...");
          
          // Check localStorage as fallback
          const storedUser = localStorage.getItem("supabaseUser");
          console.log("useAuth: Checking localStorage, found:", !!storedUser);
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              console.log("useAuth: Found user in localStorage, email:", parsedUser.email);
              
              const userData: UserData = {
                user_email: parsedUser.email || '',
                user_id: parsedUser.id,
                pic_url: parsedUser.identities?.[0]?.identity_data?.avatar_url || parsedUser.identities?.[0]?.identity_data?.picture || '',
                name: parsedUser.identities?.[0]?.identity_data?.full_name || parsedUser.identities?.[0]?.identity_data?.name || parsedUser.email || ''
              };
              
              setUser(userData);
              setIsAuthenticated(true);
              setIsLoading(false);
              console.log("useAuth: State updated from localStorage");
              return;
            } catch (e) {
              console.error("useAuth: Error parsing localStorage user:", e);
            }
          } else {
            console.log("useAuth: No user found in localStorage");
          }
          
          console.log("useAuth: No session or localStorage user found, waiting for auth state change...");
          // Don't redirect immediately, wait for auth state change
          return;
        }

        console.log("useAuth: Session found for user");

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("useAuth: Error getting user:", userError);
          setIsLoading(false);
          return;
        }

        if (!user) {
          console.log("useAuth: No user found");
          setIsLoading(false);
          return;
        }

        console.log("useAuth: User authenticated, setting state...");

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
        console.log("useAuth: State updated successfully from session check");
      } catch (error) {
        console.error("useAuth: Authentication check failed:", error);
        setIsLoading(false);
      }
    };

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("useAuth: Auth state change:", event);
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
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

    // Add multiple retries to handle timing issues
    const retryInterval = setInterval(() => {
      console.log("useAuth: Retrying session check...");
      checkAuthAndGetUser();
    }, 500);

    // Clear retry after 5 seconds
    const timeoutId = setTimeout(() => {
      console.log("useAuth: Clearing retry interval");
      clearInterval(retryInterval);
      setIsLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
      clearInterval(retryInterval);
    };
  }, [router]);

  return {
    user,
    isLoading,
    isAuthenticated,
    signOut
  };
} 