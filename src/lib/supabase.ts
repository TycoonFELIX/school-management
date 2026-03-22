import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Types for our JWT claims
export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export interface CustomJwtClaims {
  school_id: string;
  user_role: UserRole;
}

// Helper to get current user's role from JWT
export const getUserRole = async (): Promise<UserRole | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return session.user.app_metadata?.user_role ?? null;
};

// Helper to get current user's school_id from JWT
export const getSchoolId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return session.user.app_metadata?.school_id ?? null;
};