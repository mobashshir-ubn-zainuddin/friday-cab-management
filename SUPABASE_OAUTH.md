# Supabase Google OAuth Integration

This guide explains how to set up Google OAuth with Supabase for the Friday Cab Management System with strict IITKGP email enforcement.

## Setup Steps

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up / Log in
3. Create a new project
4. Note down your project URL and anon key

### 2. Configure Google OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Enable **Google**
3. Configure OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or use existing
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Add authorized redirect URIs:
     - `https://your-project.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (for local dev)
   - Copy Client ID and Client Secret
   - Paste in Supabase Google Provider settings

### 3. Environment Variables

#### Backend (.env)
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Database
DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres?sslmode=require"

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Google OAuth (for backend passport)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Admin Emails
ADMIN_EMAILS=admin1@kgpian.iitkgp.ac.in,admin2@kgpian.iitkgp.ac.in
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Security: IITKGP Email Enforcement

### Frontend Validation (SupabaseAuthCallback.tsx)
```typescript
const isValidIITKGPEmail = (email: string): boolean => {
  const lowerEmail = email.toLowerCase().trim();
  return lowerEmail.endsWith('@kgpian.iitkgp.ac.in');
};

// If email is not IITKGP, sign out immediately
if (!isValidIITKGPEmail(userEmail)) {
  await supabase.auth.signOut();
  setError(`Access Denied: Only @kgpian.iitkgp.ac.in emails are allowed.`);
  return;
}
```

### Backend Validation (auth.ts)
```typescript
// STRICT validation: Only IITKGP emails allowed
const lowerEmail = email.toLowerCase().trim();
if (!lowerEmail.endsWith('@kgpian.iitkgp.ac.in')) {
  return res.status(403).json({
    success: false,
    error: 'Only @kgpian.iitkgp.ac.in email addresses are allowed'
  });
}
```

## Flow

1. User clicks "Login with Google" button
2. Supabase initiates OAuth flow
3. User authenticates with Google
4. Supabase redirects to callback URL
5. Frontend validates email domain
6. If valid, syncs with backend database
7. Backend creates/updates user in Prisma
8. JWT token generated
9. User logged in

## Blocking Non-IITKGP Emails

If a non-IITKGP email tries to log in:
1. Supabase auth succeeds (Google validates)
2. Frontend immediately signs them out
3. Error message displayed
4. No backend API call made
5. User stays on login page

## Available Login Methods

1. **Supabase OAuth** (Recommended):
   - Uses `@supabase/supabase-js`
   - Client-side authentication
   - Direct Google OAuth

2. **Backend Passport OAuth** (Existing):
   - Uses `passport-google-oauth20`
   - Server-side authentication
   - Works with current implementation

## Testing

1. Start backend: `npm run dev` (port 5000)
2. Start frontend: `npm run dev` (port 5173)
3. Navigate to `http://localhost:5173/login`
4. Click "Continue with Google"
5. Try logging in with:
   - ✅ Valid: `20CS10001@kgpian.iitkgp.ac.in`
   - ❌ Invalid: `user@gmail.com` (will be rejected)

## Troubleshooting

### Email not allowed error
- Ensure email ends exactly with `@kgpian.iitkgp.ac.in`
- Case-insensitive check implemented
- No subdomains allowed

### CORS errors
- Add frontend URL to CORS whitelist in Supabase
- Check `FRONTEND_URL` env variable matches

### Database sync errors
- Ensure Prisma migrations are run
- Check `DATABASE_URL` is correct
- Verify Supabase service key has proper permissions
