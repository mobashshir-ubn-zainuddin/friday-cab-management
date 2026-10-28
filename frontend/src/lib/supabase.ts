import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Disabled so SupabaseAuthCallback handles the code exchange manually.
    // With this true, Supabase auto-consumes the one-time code before our
    // component runs, causing the manual exchangeCodeForSession call to fail
    // and fall back to the previously stored (wrong) session.
    detectSessionInUrl: false
  }
});

export default supabase;
