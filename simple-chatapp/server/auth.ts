import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { User } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '7d') as string;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

// JWT payload interface
export interface JWTPayload {
  userId: string;
  username: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: string, username: string): string {
  const payload: JWTPayload = { userId, username };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' as const });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(
  username: string,
  email: string,
  password: string
): Promise<User> {
  // Check if user already exists
  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
    .get(email, username);

  if (existingUser) {
    throw new Error('User with this email or username already exists');
  }

  const id = uuidv4();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, username, email, passwordHash, now, now);

  return {
    id,
    username,
    email,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: User; token: string } | null> {
  const row = db
    .prepare(
      `SELECT id, username, email, password_hash, created_at as createdAt, updated_at as updatedAt
       FROM users
       WHERE email = ?`
    )
    .get(email) as any;

  if (!row) {
    return null;
  }

  const isValid = await verifyPassword(password, row.password_hash);
  if (!isValid) {
    return null;
  }

  const user: User = {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  const token = generateToken(user.id, user.username);

  return { user, token };
}

/**
 * Get a user by ID
 */
export function getUserById(userId: string): User | null {
  const row = db
    .prepare(
      `SELECT id, username, email, created_at as createdAt, updated_at as updatedAt
       FROM users
       WHERE id = ?`
    )
    .get(userId) as User | undefined;

  return row || null;
}
