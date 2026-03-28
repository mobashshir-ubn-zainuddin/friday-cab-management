import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../utils/prisma';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

// Validate email domain - strictly enforce IITKGP emails ONLY
const isValidInstituteEmail = (email: string): boolean => {
  const lowerEmail = email.toLowerCase().trim();
  return lowerEmail.endsWith('@kgpian.iitkgp.ac.in');
};

// Strict email validation with additional checks
const validateIITKGPEmail = (email: string): { valid: boolean; error?: string } => {
  const lowerEmail = email.toLowerCase().trim();

  // Check if email ends with required domain
  if (!lowerEmail.endsWith('@kgpian.iitkgp.ac.in')) {
    return {
      valid: false,
      error: 'Only @kgpian.iitkgp.ac.in email addresses are allowed'
    };
  }

  // Extract local part
  const localPart = lowerEmail.split('@')[0];

  // Simple validation for local part (should not be empty)
  if (!localPart || localPart.length < 1) {
    return {
      valid: false,
      error: 'Invalid email prefix'
    };
  }

  return { valid: true };
};

// Extract roll number from email (e.g., mobo@kgpian.iitkgp.ac.in -> mobo)
const extractRollNumber = (email: string): string | null => {
  const match = email.match(/^([^@]+)@kgpian\.iitkgp\.ac\.in$/);
  return match ? match[1] : null;
};

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: 'No email provided' });
        }

        // STRICT validation: Only IITKGP emails allowed
        const emailValidation = validateIITKGPEmail(email);
        if (!emailValidation.valid) {
          return done(null, false, { message: emailValidation.error });
        }

        // Double check with simple validation too
        if (!isValidInstituteEmail(email)) {
          return done(null, false, {
            message: 'Only @kgpian.iitkgp.ac.in email addresses are allowed'
          });
        }

        const rollNumber = extractRollNumber(email);
        const name = profile.displayName || profile.name?.givenName || 'Unknown';

        // Check if user exists
        let user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() }
        });

        // Check if admin
        const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
        const isAdmin = adminEmails.includes(email.toLowerCase().trim());

        if (!user) {
          // Create new user with strict email validation
          user = await prisma.user.create({
            data: {
              email: email.toLowerCase().trim(),
              name,
              rollNumber,
              isAdmin,
              isBlocked: false
            }
          });
        } else {
          // Update user info if changed
          if (user.name !== name || user.isAdmin !== isAdmin) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { name, isAdmin }
            });
          }
        }

        if (user.isBlocked) {
          return done(null, false, { message: 'Your account has been blocked' });
        }

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
