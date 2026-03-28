# Friday Cab Management System - Project Summary
 
## Overview
A production-ready, full-stack web application for IIT Kharagpur students to manage cab bookings for Friday prayer (Jumu'ah). The key difference from the previous system is that **payment happens AFTER the trip completion**, not before booking.

## Architecture

### Frontend (React + TypeScript + Vite)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 3.4 + shadcn/ui components
- **Routing**: React Router DOM v6 
- **State Management**: React Context API (AuthContext)
- **HTTP Client**: Axios
- **UI Components**: 40+ pre-installed shadcn/ui components

### Backend (Node.js + Express + TypeScript)
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **ORM**: Prisma 5.10
- **Database**: PostgreSQL
- **Authentication**: Passport.js with Google OAuth 2.0
- **Payments**: Razorpay integration
- **Email**: Nodemailer with Gmail SMTP
- **Security**: Helmet, CORS, Rate Limiting, JWT

## Features Implemented

### 1. Authentication System
- Google OAuth login restricted to `@kgpian.iitkgp.ac.in` emails
- JWT token-based authentication
- One account per student policy
- Admin role management

### 2. User Dashboard
- Total trips statistics
- Active bookings count
- Completed trips tracking
- Upcoming trips view
- Pending payments alert
- Total spent calculation

### 3. Booking System
- Browse available trips
- Book trips during booking window
- **Payment blocking**: Users with pending payments cannot book new trips
- Booking cancellation before deadline

### 4. My Bookings Page
- Active and past bookings separation
- Visual timeline tracking:
  - Booked
  - Booking Closed
  - Cab Assigned
  - Trip Completed
  - Payment Status
- Cab details with seat numbers
- Driver information

### 5. Payment System (Razorpay)
- Payment ONLY after trip completion
- Admin sets total trip cost
- Automatic per-person cost calculation
- Razorpay checkout integration
- Payment verification
- Pending payment blocking for new bookings

### 6. Profile Management
- View profile information
- Edit name, phone, department
- View account status

### 7. Admin Dashboard
- Total users count
- Total bookings
- Revenue statistics
- Active trips
- Pending payments
- Today's bookings

### 8. Trip Management (Admin)
- Create new trips
- Set booking window (start/end times)
- Set cancellation deadline
- Open/close booking window
- Open/close payment window
- Delete trips

### 9. Cab Allocation (Admin)
- Add vehicles: Cab (7 seats), Auto (10 seats), Toto (5 seats)
- Auto-assign algorithm (fills one cab before next)
- Manual assignment
- View assigned passengers
- Remove assignments

### 10. Payment Control (Admin)
- Open payment window with total cost
- Automatic per-person calculation
- Close payment window
- View pending payments
- Export payment reports

### 11. User Management (Admin)
- View all users
- Search by name/email/roll number
- Block/unblock users
- Grant/revoke admin privileges
- View booking and payment counts

### 12. Analytics (Admin)
- Monthly revenue/expense/profit
- Daily breakdown
- Vehicle distribution
- Payment status distribution
- Profit/loss reports
- Monthly comparisons

### 13. Email Notifications
- New trip notifications to all users
- Payment reminders
- Booking confirmations

## Database Schema

### Tables
1. **User** - Student accounts
2. **Trip** - Trip details and status
3. **Booking** - User trip bookings
4. **Cab** - Vehicle information
5. **CabAssignment** - Passenger assignments
6. **Payment** - Payment records
7. **Analytics** - Monthly analytics data

### Key Relationships
- User → Bookings (1:N)
- Trip → Bookings (1:N)
- Trip → Cabs (1:N)
- Cab → Assignments (1:N)
- Booking → Payment (1:1)

## API Structure

### Routes
- `/api/auth` - Authentication
- `/api/users` - User management
- `/api/trips` - Trip operations
- `/api/bookings` - Booking operations
- `/api/payments` - Payment operations
- `/api/admin` - Admin operations
- `/api/analytics` - Analytics data

## Security Features
1. JWT authentication
2. Google OAuth domain restriction
3. Rate limiting (100 requests per 15 minutes)
4. Helmet security headers
5. CORS configuration
6. Input validation with Zod
7. SQL injection protection via Prisma

## File Structure
```
friday-cab-system/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layouts/
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   └── AdminLayout.tsx
│   │   │   └── ui/ (40+ shadcn components)
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── AuthCallback.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Trips.tsx
│   │   │   ├── TripDetails.tsx
│   │   │   ├── MyBookings.tsx
│   │   │   ├── Payments.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.tsx
│   │   │       ├── TripManagement.tsx
│   │   │       ├── CabAllocation.tsx
│   │   │       ├── PaymentControl.tsx
│   │   │       ├── UserManagement.tsx
│   │   │       └── Analytics.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── passport.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── validation.ts
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── user.ts
│   │   │   ├── trip.ts
│   │   │   ├── booking.ts
│   │   │   ├── payment.ts
│   │   │   ├── admin.ts
│   │   │   └── analytics.ts
│   │   ├── utils/
│   │   │   ├── jwt.ts
│   │   │   ├── email.ts
│   │   │   └── razorpay.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── server.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
└── README.md
```

## Environment Setup

### Required Environment Variables

#### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay API secret
- `SMTP_USER` - Gmail address for notifications
- `SMTP_PASS` - Gmail app password
- `ADMIN_EMAILS` - Comma-separated admin emails

#### Frontend
- `VITE_API_URL` - Backend API URL

## Deployment Instructions

### Backend Deployment
1. Set up PostgreSQL database
2. Configure environment variables
3. Run `npm install`
4. Run `npx prisma migrate deploy`
5. Run `npm run build`
6. Start with `npm start`

### Frontend Deployment
1. Configure `VITE_API_URL`
2. Run `npm install`
3. Run `npm run build`
4. Deploy `dist/` folder

## Key Business Rules

1. **Payment Blocking**: Users with pending payments cannot book new trips
2. **Booking Window**: Bookings only allowed during specified time window
3. **Cancellation Deadline**: Users can cancel before the admin-set deadline
4. **Auto-assign Logic**: Fill one cab completely before moving to next
5. **Payment Calculation**: Total cost divided equally among attendees only

## Future Enhancements
- QR code check-in
- WhatsApp notifications
- Real-time seat tracking
- Mobile app
- Push notifications


# Friday Cab Management System

A comprehensive full-stack web application for IIT Kharagpur students to manage cab bookings for Jumu'ah (Friday prayer). The system allows students to book cabs, with payment done AFTER the trip completion.

## Features
 
### User Features
- **Google OAuth Login** - Secure authentication restricted to `@kgpian.iitkgp.ac.in` emails
- **Dashboard** - View trip statistics, active bookings, and payment status
- **Trip Booking** - Browse and book available trips
- **My Bookings** - Track booking status with visual timeline
- **Payments** - Pay for completed trips via Razorpay integration
- **Profile Management** - Update personal information

### Admin Features
- **Admin Dashboard** - View system statistics and revenue
- **Trip Management** - Create, edit, and manage trips
- **Cab Allocation** - Assign vehicles (Cab/Auto/Toto) to bookings
- **Payment Control** - Open/close payment windows and set trip costs
- **User Management** - Block/unblock users and manage admin privileges
- **Analytics** - View profit/loss reports and monthly comparisons

## Tech Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router DOM
- Axios for API calls

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL Database
- Passport.js for Google OAuth
- Razorpay for payments
- Nodemailer for email notifications

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Google OAuth credentials
- Razorpay account

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/friday_cab_db"

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Admin
ADMIN_EMAILS=admin1@kgpian.iitkgp.ac.in,admin2@kgpian.iitkgp.ac.in
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd friday-cab-system
```

2. **Install Backend Dependencies**
```bash
cd backend
npm install
```

3. **Setup Database**
```bash
npx prisma generate
npx prisma migrate dev
```

4. **Install Frontend Dependencies**
```bash
cd ../frontend
npm install
```

### Running the Application

1. **Start Backend Server**
```bash
cd backend
npm run dev
```

2. **Start Frontend Development Server**
```bash
cd frontend
npm run dev
```

3. **Access the Application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Key Business Logic

### Payment Flow
1. Admin creates a trip
2. Students book during the booking window
3. Trip is completed
4. Admin marks attendance
5. Admin opens payment window with total cost
6. System calculates cost per person (total / attendees)
7. Students pay their share via Razorpay
8. Payment records are updated

### Booking Restrictions
- Users with pending payments CANNOT book new trips
- Booking only allowed during the booking window
- Cancellation allowed before the cancellation deadline

### Cab Allocation
- Supports 3 vehicle types: Cab (7 seats), Auto (10 seats), Toto (5 seats)
- Auto-assign fills one cab before moving to the next
- Manual assignment also available

## API Endpoints

### Authentication
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users (admin)
- `GET /api/users/dashboard` - Get user dashboard stats
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update profile
- `PATCH /api/users/:id/block` - Block/unblock user
- `PATCH /api/users/:id/admin` - Set admin status

### Trips
- `GET /api/trips` - Get all trips
- `GET /api/trips/:id` - Get trip details
- `POST /api/trips` - Create trip (admin)
- `PATCH /api/trips/:id` - Update trip (admin)
- `PATCH /api/trips/:id/status` - Update trip status
- `PATCH /api/trips/:id/booking-window` - Toggle booking window
- `PATCH /api/trips/:id/payment-window` - Toggle payment window
- `DELETE /api/trips/:id` - Delete trip (admin)

### Bookings
- `GET /api/bookings/my-bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking details
- `POST /api/bookings` - Create booking
- `PATCH /api/bookings/:id/cancel` - Cancel booking
- `PATCH /api/bookings/:id/attendance` - Mark attendance (admin)
- `POST /api/bookings/bulk-attendance` - Bulk mark attendance (admin)

### Payments
- `GET /api/payments/my-payments` - Get user's payments
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment
- `GET /api/payments` - Get all payments (admin)
- `GET /api/payments/report/export` - Export payment report

### Admin
- `GET /api/admin/dashboard` - Get admin dashboard stats
- `GET /api/admin/trips/:tripId/cabs` - Get trip cabs
- `POST /api/admin/cabs` - Create cab
- `PATCH /api/admin/cabs/:id` - Update cab
- `DELETE /api/admin/cabs/:id` - Delete cab
- `POST /api/admin/trips/:tripId/auto-assign` - Auto-assign cabs
- `POST /api/admin/assign-cab` - Manual cab assignment
- `GET /api/admin/payments/pending-summary` - Get pending payments summary

### Analytics
- `GET /api/analytics` - Get analytics data
- `GET /api/analytics/profit-loss` - Get profit/loss report
- `GET /api/analytics/users` - Get user analytics
- `GET /api/analytics/monthly-comparison` - Get monthly comparison

## Security Features

- JWT-based authentication
- Google OAuth with domain restriction
- Rate limiting on API endpoints
- Helmet for security headers
- CORS configuration
- Input validation with Zod
- SQL injection protection via Prisma

## License

MIT License

## Contributors

- IIT Kharagpur Students

## Support

For support, please contact the admin team or create an issue in the repository.