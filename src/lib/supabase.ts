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

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

// Universal function to call Edge Functions with correct auth headers
export const callEdgeFunction = async (
  functionName: string,
  body: object
) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    }
  );

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Edge function call failed');
  }
  
  return result;
};

export const getUserRole = async (): Promise<UserRole | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return session.user.app_metadata?.user_role ?? null;
};

export const getSchoolId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return session.user.app_metadata?.school_id ?? null;
};