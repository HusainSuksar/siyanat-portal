import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// 1. Define the shape of our global memory
type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null; // Holds their zone, department, trade, etc.
  role: string;        // Holds STANDARD_USER, SIYANAT_HEAD, etc.
  loading: boolean;
};

// 2. Create the Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Create the Provider Wrapper
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [role, setRole] = useState<string>('STANDARD_USER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only fetch the profile from the database ONCE
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          setProfile(data);
          setRole(data?.role || 'STANDARD_USER');
        }
        
        setLoading(false);
      }
    }

    initializeAuth();

    // Listen for logins/logouts
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(data);
        setRole(data?.role || 'STANDARD_USER');
      } else {
        setProfile(null);
        setRole('STANDARD_USER');
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Expose the state to the rest of the app
  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// 4. Create a custom hook for ultra-fast access in other files
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}