import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Anon Key in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Verifies a Supabase access token. With the project's asymmetric (ES256) signing key
// this checks signature and expiry locally against the cached public key, avoiding a
// ~300-1000 ms round trip to Supabase Auth per new token. Other algorithms fall back
// to a network check inside getClaims.
export const verifyAccessToken = async (
  token: string
): Promise<{ id: string; email?: string } | null> => {
  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== 'authenticated') return null;
  return { id: claims.sub, email: claims.email as string | undefined };
};

export default supabase;
