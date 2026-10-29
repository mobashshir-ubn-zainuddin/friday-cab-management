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
    detectSessionInUrl: false,
    // Use sessionStorage instead of localStorage so sessions are tied to the
    // browser tab/window and cleared when the browser is closed.
    // With localStorage (the default), User A's session persists indefinitely —
    // the next person who opens the same browser gets auto-logged in as User A
    // without entering any credentials. sessionStorage prevents this: closing
    // the browser/tab wipes the session, and each tab is fully independent.
    storage: window.sessionStorage
  }
});

export default supabase;
