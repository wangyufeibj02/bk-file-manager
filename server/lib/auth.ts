import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'bk-file-management-jwt-secret-2026';
const SALT_ROUNDS = 12;

// 密码哈希 - 使用 bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 生成 JWT Token
export function generateToken(userId: string, username: string, role: string): string {
  return jwt.sign(
    { userId, username, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 验证 JWT Token
export function verifyToken(token: string): { userId: string; username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
  } catch {
    return null;
  }
}

// 认证中间件
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // 获取 token
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  // 也支持从 cookie 获取
  const cookieToken = req.cookies?.token;
  const finalToken = token || cookieToken;
  
  if (!finalToken) {
    return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
  }
  
  const decoded = verifyToken(finalToken);
  if (!decoded) {
    return res.status(401).json({ error: 'Token 无效或已过期', code: 'TOKEN_INVALID' });
  }
  
  req.user = decoded;
  next();
}

// 管理员权限中间件
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限', code: 'FORBIDDEN' });
  }
  next();
}

// 可选认证中间件（不强制要求登录）
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.token;
  const finalToken = token || cookieToken;
  
  if (finalToken) {
    const decoded = verifyToken(finalToken);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}
