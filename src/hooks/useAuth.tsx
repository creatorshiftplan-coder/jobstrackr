import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuestMode: boolean;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isGuestMode: false,
  signOut: async () => { },
  resetPassword: async () => ({ error: null }),
  enterGuestMode: () => { },
  exitGuestMode: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(() => {
    return localStorage.getItem("guestMode") === "true";
  });

  // Get QueryClient to clear cache on logout
  const queryClient = useQueryClient();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Auto-exit guest mode when user logs in
        if (session?.user) {
          localStorage.removeItem("guestMode");
          setIsGuestMode(false);
        }

        // Clear all cached queries when user signs out
        // This prevents stale data from previous user showing up
        if (event === "SIGNED_OUT") {
          queryClient.clear();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    try {
      // Clear React Query cache BEFORE signing out
      // This ensures clean state when logging in with different account
      queryClient.clear();

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        throw error;
      }
      // Clear local state immediately
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error("Failed to sign out:", error);
      // Force clear state even on error
      setUser(null);
      setSession(null);
      // Also clear cache on error to ensure clean state
      queryClient.clear();
    }
  };

  const enterGuestMode = () => {
    localStorage.setItem("guestMode", "true");
    setIsGuestMode(true);
  };

  const exitGuestMode = () => {
    localStorage.removeItem("guestMode");
    setIsGuestMode(false);
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuestMode, signOut, resetPassword, enterGuestMode, exitGuestMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
