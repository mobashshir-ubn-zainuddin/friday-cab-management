-- Supabase PostgreSQL Schema for Friday Cab Management System
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trip Status Enum
CREATE TYPE trip_status AS ENUM ('UPCOMING', 'BOOKING_OPEN', 'BOOKING_CLOSED', 'CAB_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- Booking Status Enum
CREATE TYPE booking_status AS ENUM ('CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- Vehicle Type Enum
CREATE TYPE vehicle_type AS ENUM ('CAB', 'AUTO', 'TOTO');

-- Payment Status Enum
CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    roll_number VARCHAR(20) UNIQUE,
    department VARCHAR(100),
    is_admin BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date TIMESTAMPTZ NOT NULL,
    booking_start_time TIMESTAMPTZ NOT NULL,
    booking_end_time TIMESTAMPTZ NOT NULL,
    cancellation_deadline TIMESTAMPTZ,
    departure_time TIMESTAMPTZ NOT NULL,
    return_time TIMESTAMPTZ,
    status trip_status DEFAULT 'UPCOMING',
    total_cost DECIMAL(10, 2),
    cost_per_person DECIMAL(10, 2),
    max_bookings INTEGER DEFAULT 100,
    current_bookings INTEGER DEFAULT 0,
    payment_window_open BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE CASCADE
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    status booking_status DEFAULT 'CONFIRMED',
    attended BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trip_id)
);

-- Cabs Table
CREATE TABLE IF NOT EXISTS cabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL,
    vehicle_number VARCHAR(20) NOT NULL,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    max_capacity INTEGER NOT NULL,
    current_occupancy INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cab Assignments Table
CREATE TABLE IF NOT EXISTS cab_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cab_id UUID REFERENCES cabs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    seat_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cab_id, seat_number)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status payment_status DEFAULT 'PENDING',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Table
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    total_expenses DECIMAL(10, 2) DEFAULT 0,
    total_trips INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    collected_amount DECIMAL(10, 2) DEFAULT 0,
    pending_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, year)
);

-- Create Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_trips_date ON trips(date);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_cabs_trip_id ON cabs(trip_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_trip_id ON payments(trip_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cabs_updated_at BEFORE UPDATE ON cabs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_read_own ON users
    FOR SELECT USING (auth.uid()::text = id::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true
    ));

-- Trips are readable by all authenticated users
CREATE POLICY trips_read_all ON trips FOR SELECT TO authenticated USING (true);

-- Bookings policies
CREATE POLICY bookings_read_own ON bookings
    FOR SELECT USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true
    ));

-- Payments policies
CREATE POLICY payments_read_own ON payments
    FOR SELECT USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true
    ));

-- Cabs are readable by all authenticated users
CREATE POLICY cabs_read_all ON cabs FOR SELECT TO authenticated USING (true);

-- Cab assignments are readable by assigned user or admin
CREATE POLICY cab_assignments_read ON cab_assignments
    FOR SELECT USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND is_admin = true
    ));
