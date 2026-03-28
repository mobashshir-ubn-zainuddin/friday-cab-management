# Supabase PostgreSQL Integration

This backend uses Supabase PostgreSQL for database operations.

## Configuration

### Environment Variables

Ensure the following environment variables are set in your `.env` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# PostgreSQL Database (via Supabase)
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require"
```

## Database Setup

1. Go to your Supabase dashboard
2. Open the SQL Editor
3. Copy the contents of `supabase/schema.sql`
4. Run the SQL to create all tables, enums, indexes, and policies

## Features

### 1. CORS Configuration
CORS is configured to:
- Allow multiple origins in development (`localhost:5173`, `localhost:3000`)
- Restrict to specific origins in production
- Support credentials and standard HTTP methods
- Expose necessary headers

### 2. IITKGP Email Restriction
Only emails ending with `@kgpian.iitkgp.ac.in` are allowed. This is enforced in:
- `src/config/passport.ts` - OAuth validation

### 3. Unpaid Booking Rule
Users with unpaid dues cannot book new trips. This is enforced in:
- `src/middleware/auth.ts` - `checkPendingPayments` and `checkBlockedStatus`
- `src/routes/booking.ts` - Applied to booking creation

Users with 2+ unpaid bookings are automatically blocked.

### 4. Supabase Client
A configured Supabase client is available at:
- `src/config/supabaseClient.ts`

### 5. Database Utilities
Helper functions for Supabase operations:
- `src/utils/db.ts`

## Security

- Row Level Security (RLS) policies are configured in `supabase/schema.sql`
- Users can only read their own data (unless admin)
- Admins have full access to all data

## API Endpoints

### Auth
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token

### Trips
- `GET /api/trips` - List all trips
- `GET /api/trips/:id` - Get trip details
- `POST /api/trips` - Create trip (admin only)

### Bookings
- `GET /api/bookings/my-bookings` - List user bookings
- `POST /api/bookings` - Create booking (requires payment clearance)
- `PATCH /api/bookings/:id/cancel` - Cancel booking

## Error Codes

- `UNPAID_DUES` - User has pending/failed payments
- `ACCOUNT_BLOCKED` - User blocked due to multiple unpaid bookings
