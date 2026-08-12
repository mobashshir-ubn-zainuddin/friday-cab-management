# Friday Cab Management System

A production-oriented full-stack cab booking and management platform designed for IIT Kharagpur students.

The system manages the complete lifecycle of Friday prayer cab trips — from trip creation and student booking to cab allocation, attendance, post-trip payment collection, email notifications, and administrative analytics.

The application is designed with a strong focus on:

- API performance
- Security
- Authentication
- Persistent state management
- Idempotent operations
- Concurrent request handling
- Database consistency
- Secure payment processing
- Reliable email notifications
- Role-based access control

---

# Table of Contents

- [Overview](#overview)
- [Key Engineering Improvements](#key-engineering-improvements)
- [Technology Stack](#technology-stack)
- [High-Level System Architecture](#high-level-system-architecture)
- [Performance Optimization](#performance-optimization)
- [Persistence Architecture](#persistence-architecture)
- [Idempotency](#idempotency)
- [Authentication and Security Architecture](#authentication-and-security-architecture)
- [PKCE Authentication](#pkce-authentication)
- [Registration Flow](#registration-flow)
- [Login Flow](#login-flow)
- [Trip Creation Workflow](#trip-creation-workflow)
- [Email Notification Workflow](#email-notification-workflow)
- [Trip Booking Workflow](#trip-booking-workflow)
- [Cab Allocation Workflow](#cab-allocation-workflow)
- [Post-Trip Payment Workflow](#post-trip-payment-workflow)
- [Database and Data Integrity](#database-and-data-integrity)
- [API Request Lifecycle](#api-request-lifecycle)
- [Security Architecture](#security-architecture)
- [Error Handling](#error-handling)
- [Project Structure](#project-structure)
- [Deployment Architecture](#deployment-architecture)
- [Engineering Highlights](#engineering-highlights)
- [Future Improvements](#future-improvements)

---

# Overview

The Friday Cab Management System provides two primary interfaces:

### Student/User Portal

Students can:

- Browse available Friday prayer trips
- Book available trips
- View booking status
- Track cab assignments
- View attendance/payment status
- Complete post-trip payments
- Manage their profile

### Admin Panel

Administrators can:

- Create and manage trips
- Configure booking windows
- Allocate vehicles
- Manage bookings
- Record attendance
- Open/close payment windows
- Configure trip costs
- Manage users
- Manage administrator privileges
- Monitor revenue and analytics

A major business requirement is that:

> **Students do not pay during booking. Payment is collected after the trip has been completed.**

---

# Key Engineering Improvements

The system has undergone significant backend and infrastructure improvements focused on performance, reliability, security, and consistency.

### Major improvements

- Reduced API latency through optimized database access
- Parallelized independent database operations
- Reduced unnecessary sequential API requests
- Reduced redundant database queries
- Eliminated unnecessary database connection-pooling overhead
- Added persistent database-backed application state
- Implemented idempotent state-changing operations
- Added PKCE-based authentication
- Added authentication and authorization checks
- Added role-based administrative access
- Added API-level input validation
- Added rate limiting
- Added HTTP security headers
- Added structured error handling
- Added database-level integrity protection
- Improved concurrent request handling
- Added reliable email notification workflows
- Improved production reliability of PostgreSQL/Supabase-backed operations

---

# Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React | UI framework |
| TypeScript | Type safety |
| Vite | Frontend build tooling |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| React Router DOM | Client-side routing |
| Axios | HTTP/API communication |

## Backend

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js | REST API framework |
| TypeScript | Backend type safety |
| Prisma ORM | Database access |
| PostgreSQL | Persistent relational database |
| Zod | Request/input validation |
| Passport.js | Authentication middleware |
| Helmet | HTTP security headers |
| Rate Limiting | API abuse protection |

## Authentication

- PKCE
- JWT/session-based authentication
- Authentication middleware
- Role-based authorization
- Protected administrative routes

## External Services

| Service | Purpose |
|---|---|
| Supabase/PostgreSQL | Persistent database/authentication infrastructure |
| Razorpay | Payment processing |
| Nodemailer | Email notifications |

---

# High-Level System Architecture

The application follows a layered client-server architecture.

```mermaid
flowchart TB

    USER["Student / Admin"]

    FRONTEND["React + TypeScript + Vite
    Frontend"]

    API["Node.js + Express
    REST API"]

    AUTH["Authentication
    PKCE + Session/JWT"]

    VALIDATION["Validation Layer
    Zod"]

    BUSINESS["Business Logic Layer"]

    IDEMPOTENCY["Idempotency
    & Duplicate Protection"]

    PRISMA["Prisma ORM"]

    DB[("PostgreSQL
    Persistent Database")]

    EMAIL["Nodemailer
    Email Service"]

    RAZORPAY["Razorpay
    Payment Gateway"]

    USER --> FRONTEND

    FRONTEND --> API

    API --> AUTH
    API --> VALIDATION
    API --> BUSINESS

    BUSINESS --> IDEMPOTENCY
    BUSINESS --> PRISMA

    PRISMA --> DB

    BUSINESS --> EMAIL
    BUSINESS --> RAZORPAY
