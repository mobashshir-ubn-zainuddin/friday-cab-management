import nodemailer from 'nodemailer';
import { EmailOptions } from '../types';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// Create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

// Verify transporter connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('✅ Email service connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Email service connection failed:', error);
    return false;
  }
};

// Send email
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const result = await transporter.sendMail({
      from: `"Friday Cab System" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    });
    
    console.log('📧 Email sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
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
): Promise<boolean> => {
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
): Promise<boolean> => {
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
): Promise<boolean> => {
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

export default transporter;
