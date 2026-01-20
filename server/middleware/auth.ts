import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

// JWT Token 载荷类型
interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

// 验证 JWT Token
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: '未登录',
      code: 'UNAUTHORIZED' 
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return res.status(403).json({ 
      error: 'Token 无效或已过期',
      code: 'TOKEN_INVALID' 
    });
  }
}

// 验证管理员权限
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      error: '未登录',
      code: 'UNAUTHORIZED' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: '需要管理员权限',
      code: 'FORBIDDEN' 
    });
  }

  next();
}

// 可选验证（如果有 token 就验证，没有也放行）
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
    } catch (err) {
      // Token 无效时静默忽略
    }
  }

  next();
}

// 生成 JWT Token
export function generateToken(user: { id: string; username: string; role: string }): string {
  const payload: JwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

// 刷新 Token
export async function refreshToken(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: '未登录' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: '用户不存在或已禁用' });
  }

  const newToken = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  res.json({ token: newToken });
}
