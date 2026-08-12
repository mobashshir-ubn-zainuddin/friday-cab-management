import { Resend } from 'resend';
import { EmailOptions } from '../types';
import { formatInIST } from './timezone';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// Use verified domain for production, fallback to Resend test address for development
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL 
  ? (process.env.RESEND_FROM_EMAIL.includes('@') 
    ? process.env.RESEND_FROM_EMAIL 
    : `noreply@${process.env.RESEND_FROM_EMAIL}`)
  : 'onboarding@resend.dev';

const resend = new Resend(RESEND_API_KEY);

// Email-safe time formatting — always in Asia/Kolkata, independent of server TZ.
export const formatEmailDate = (d: Date | string): string =>
  formatInIST(d, 'EEEE, dd MMMM yyyy');

export const formatEmailTime = (d: Date | string): string =>
  formatInIST(d, 'hh:mm a');

export const formatEmailDateTime = (d: Date | string): string =>
  formatInIST(d, 'EEEE, dd MMMM yyyy hh:mm a');

// Email send result type
export interface EmailSendResult {
  success: boolean;
  id?: string;
  error?: string;
  rateLimited?: boolean;
}

// Verify Resend connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    // Resend doesn't have a direct verify method, so we'll just check if API key is set
    if (!RESEND_API_KEY) {
      console.error('❌ Resend API key not configured');
      return false;
    }
    console.log(`✅ Email service (Resend) configured successfully (from: ${RESEND_FROM_EMAIL})`);
    return true;
  } catch (error) {
    console.error('❌ Email service connection failed:', error);
    return false;
  }
};

// Send email using Resend
export const sendEmail = async (options: EmailOptions): Promise<EmailSendResult> => {
  try {
    const result = await resend.emails.send({
      from: `"Friday Cab System" <${RESEND_FROM_EMAIL}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text
    });
    
    if (result.error) {
      const errorMessage = result.error.message || 'Unknown error';
      console.error('❌ Failed to send email:', errorMessage);
      
      // Check for rate limiting
      const isRateLimited = errorMessage.includes('rate limit') || 
        errorMessage.includes('429') || 
        errorMessage.includes('over_email_send_rate_limit');
      
      return {
        success: false,
        error: errorMessage,
        rateLimited: isRateLimited
      };
    }
    
    console.log('📧 Email sent:', result.data?.id);
    return {
      success: true,
      id: result.data?.id
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    console.error('❌ Failed to send email:', errorMessage);
    
    const isRateLimited = errorMessage.includes('rate limit') || 
      errorMessage.includes('429') || 
      errorMessage.includes('over_email_send_rate_limit');
    
    return {
      success: false,
      error: errorMessage,
      rateLimited: isRateLimited
    };
  }
};

// Send trip notification email
export const sendTripNotification = async (
  to: string | string[],
  tripData: {
    title: string;
    date: string;
    departureTime: string;
    bookingStartTime: string;
    bookingEndTime: string;
  }
): Promise<EmailSendResult> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .trip-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗 New Trip Available!</h1>
          <p>Friday Cab Management System</p>
        </div>
        <div class="content">
          <h2>${tripData.title}</h2>
          <p>A new trip has been scheduled for Friday prayer. Book your seat now!</p>
          
          <div class="trip-details">
            <div class="detail-row">
              <span class="label">Date:</span>
              <span class="value">${tripData.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Departure Time:</span>
              <span class="value">${tripData.departureTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">Booking Opens:</span>
              <span class="value">${tripData.bookingStartTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">Booking Closes:</span>
              <span class="value">${tripData.bookingEndTime}</span>
            </div>
          </div>
          
          <center>
            <a href="${process.env.FRONTEND_URL}/trips" class="cta-button">Book Now</a>
          </center>
        </div>
        <div class="footer">
          <p>This is an automated message from Friday Cab Management System</p>
          <p>IIT Kharagpur</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🚗 New Trip: ${tripData.title}`,
    html
  });
};

// Send payment reminder email
export const sendPaymentReminder = async (
  to: string,
  paymentData: {
    tripName: string;
    amount: number;
    dueDate: string;
  }
): Promise<EmailSendResult> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .amount { font-size: 36px; font-weight: bold; color: #f5576c; }
        .cta-button { display: inline-block; background: #f5576c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💳 Payment Reminder</h1>
          <p>Friday Cab Management System</p>
        </div>
        <div class="content">
          <h2>Your payment is pending</h2>
          <p>You have an outstanding payment for your recent trip.</p>
          
          <div class="payment-details">
            <p><strong>Trip:</strong> ${paymentData.tripName}</p>
            <p class="amount">₹${paymentData.amount}</p>
            <p><strong>Due Date:</strong> ${paymentData.dueDate}</p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> You won't be able to book new trips until this payment is cleared.
          </div>
          
          <center>
            <a href="${process.env.FRONTEND_URL}/payments" class="cta-button">Pay Now</a>
          </center>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: '💳 Payment Reminder - Friday Cab System',
    html
  });
};

// Send booking confirmation email
export const sendBookingConfirmation = async (
  to: string,
  bookingData: {
    tripName: string;
    date: string;
    departureTime: string;
    cabDetails?: {
      vehicleNumber: string;
      driverName?: string;
      driverPhone?: string;
    };
  }
): Promise<EmailSendResult> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .success-icon { font-size: 60px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Booking Confirmed!</h1>
          <p>Friday Cab Management System</p>
        </div>
        <div class="content">
          <div class="success-icon">🎉</div>
          <h2>Your booking has been confirmed</h2>
          
          <div class="booking-details">
            <p><strong>Trip:</strong> ${bookingData.tripName}</p>
            <p><strong>Date:</strong> ${bookingData.date}</p>
            <p><strong>Departure Time:</strong> ${bookingData.departureTime}</p>
            ${bookingData.cabDetails ? `
            <hr>
            <p><strong>Cab Number:</strong> ${bookingData.cabDetails.vehicleNumber}</p>
            ${bookingData.cabDetails.driverName ? `<p><strong>Driver:</strong> ${bookingData.cabDetails.driverName}</p>` : ''}
            ${bookingData.cabDetails.driverPhone ? `<p><strong>Contact:</strong> ${bookingData.cabDetails.driverPhone}</p>` : ''}
            ` : ''}
          </div>
          
          <p>Please arrive at the pickup point 10 minutes before departure time.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: '✅ Booking Confirmed - Friday Cab System',
    html
  });
};

export const sendNewRegistrationToAdmins = async (
  adminEmails: string[],
  userData: {
    name: string;
    email: string;
    phone?: string | null;
    rollNumber?: string | null;
    department?: string | null;
    createdAt: Date | string;
  },
  adminDashboardUrl: string
): Promise<EmailSendResult> => {
  if (adminEmails.length === 0) {
    console.warn('⚠️ No admin emails configured; skipping new-registration notification');
    return { success: false, error: 'No admin emails configured' };
  }
  const createdAtFormatted = formatEmailDateTime(userData.createdAt);
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 640px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .user-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
        .row { display: flex; padding: 8px 0; border-bottom: 1px dashed #e5e7eb; }
        .row:last-child { border-bottom: none; }
        .label { width: 140px; font-weight: bold; color: #6b7280; }
        .value { flex: 1; color: #111827; word-break: break-all; }
        .cta-button { display: inline-block; background: #059669; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        .note { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 4px; margin-top: 20px; color: #92400e; }
        .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New User Registration</h1>
          <p>Friday Cab Management System — Admin Action Required</p>
        </div>
        <div class="content">
          <p>Hi Admin,</p>
          <p>A new user has registered on the Friday Cab portal and is waiting for your verification.
          <strong> Do NOT send a sign-in link to the user until you have reviewed and approved their details.</strong></p>

          <h3>Submitted Details</h3>
          <div class="user-card">
            <div class="row"><span class="label">Full Name</span><span class="value">${userData.name}</span></div>
            <div class="row"><span class="label">Institute Email</span><span class="value">${userData.email}</span></div>
            ${userData.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${userData.phone}</span></div>` : ''}
            ${userData.rollNumber ? `<div class="row"><span class="label">Roll Number</span><span class="value">${userData.rollNumber}</span></div>` : ''}
            ${userData.department ? `<div class="row"><span class="label">Department</span><span class="value">${userData.department}</span></div>` : ''}
            <div class="row"><span class="label">Registered At</span><span class="value">${createdAtFormatted}</span></div>
          </div>

          <div class="note">
            <strong>Next step:</strong> Review the user in the Admin Dashboard and either Approve or Reject.
            When you click <strong>Approve</strong>, the system will automatically email the secure sign-in link to the user.
          </div>

          <center>
            <a class="cta-button" href="${adminDashboardUrl}">Review Pending Users →</a>
          </center>
        </div>
        <div class="footer">
          <p>This is an automated message from Friday Cab Management System · IIT Kharagpur</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `🔔 New Registration: ${userData.name} (${userData.email}) — Awaiting Approval`,
    html
  });
};