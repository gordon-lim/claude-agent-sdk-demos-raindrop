import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';

/**
 * Express middleware to require authentication
 * Validates JWT token from Authorization header and adds userId to request
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  // Add userId to request object for downstream handlers
  req.userId = payload.userId;
  next();
}
