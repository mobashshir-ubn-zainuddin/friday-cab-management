import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabaseClient';
import { prisma, getCachedUser, setCachedUser, clearRequestUserCache } from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { User } from '@prisma/client';

// Clear cache at the start of each request
export const clearUserCacheMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  clearRequestUserCache();
  next();
};

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

    // Check cache first (token -> user)
    // Use full token as cache key — substring(0,32) is identical for every
    // Supabase JWT (same base64 header) and caused cross-user cache poisoning.
    const cacheKey = `token:${token}`;
    const cachedUser = getCachedUser(cacheKey);
    
    let user: any;
    let dbUser: User;

    if (cachedUser) {
      user = { id: cachedUser.supabaseUserId, email: cachedUser.email };
      dbUser = cachedUser;
    } else {
      // Verify token with Supabase
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

      if (error || !supabaseUser) {
        res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
        return;
      }

      user = supabaseUser;
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
      const emailCacheKey = `email:${email}`;
      dbUser = getCachedUser(emailCacheKey) as User;

      if (!dbUser) {
        dbUser = await prisma.user.findUnique({
          where: { email: email }
        });

        if (!dbUser) {
          // No account in our DB — reject. Users must register first.
          res.status(403).json({
            success: false,
            error: 'ACCOUNT_NOT_FOUND',
            message: 'No account found for this email. Please register at /register.'
          });
          return;
        } else if (!dbUser.supabaseUserId) {
          // Update existing user with Supabase ID if missing
          dbUser = await prisma.user.update({
            where: { email: email },
            data: { supabaseUserId: user.id }
          });
        }

        // Cache the user
        setCachedUser(emailCacheKey, dbUser);
      }

      // Cache token -> user mapping
      setCachedUser(cacheKey, dbUser);
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