import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabaseClient';
import { prisma } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';

export const verifySupabaseUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }

    const email = user.email;

    // 🔒 HARD SECURITY CHECK: Only allow @kgpian.iitkgp.ac.in
    if (!email?.endsWith('@kgpian.iitkgp.ac.in')) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized domain. Only @kgpian.iitkgp.ac.in emails are allowed.'
      });
      return;
    }

    // Find or create user in our DB
    let dbUser = await prisma.user.findUnique({
      where: { email: email }
    });

    if (!dbUser) {
      // Create new user if not exists
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
      const isAdmin = adminEmails.includes(email.toLowerCase());

      dbUser = await prisma.user.create({
        data: {
          email,
          name: user.user_metadata?.full_name || user.name || '',
          isAdmin,
          isBlocked: false
        }
      });
    }

    // Attach user to request
    req.user = dbUser;
    
    next();
  } catch (error) {
    console.error('Supabase auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};
