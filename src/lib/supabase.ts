import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export const callEdgeFunction = async (functionName: string, body: object) => {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(
    `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': (import.meta as any).env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Edge function call failed');
  return result;
};