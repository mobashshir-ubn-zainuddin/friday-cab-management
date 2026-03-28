# Friday Cab Management System

A comprehensive full-stack web application for IIT Kharagpur students to manage cab bookings for Jumu'ah (Friday prayer). The system allows students to book cabs, with payment done AFTER the trip completion.

## Features
 
### User Features
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
- Passport.js for authentication
- Razorpay for payments
- Nodemailer for email notifications

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

## Security Features

- JWT-based authentication
- Rate limiting on API endpoints
- Helmet for security headers
- CORS configuration
- Input validation with Zod
- SQL injection protection via Prisma

## Contributors

- IIT Kharagpur Students

## Support

For support, please contact the admin team or create an issue in the repository.
