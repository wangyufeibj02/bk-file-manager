import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  authMiddleware, 
  adminMiddleware,
  AuthRequest 
} from '../lib/auth.js';
import { validate, loginSchema, createUserSchema, changePasswordSchema } from '../lib/validation.js';

const router = Router();

// 默认管理员密码（生产环境应使用环境变量）
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'bkadmin123';

// 初始化默认管理员用户
async function initDefaultAdmin() {
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });
  
  if (!existingAdmin) {
    const hashedPassword = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        displayName: '管理员',
        role: 'admin',
        servers: {
          create: {
            name: '本地服务器',
            url: 'http://localhost:3001',
            isDefault: true
          }
        }
      }
    });
    console.log('✅ Default admin user created: admin / [password from env or default]');
  }
}

// 初始化
initDefaultAdmin().catch(console.error);

// 登录
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { username },
      include: { servers: true }
    });
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: '账户已被禁用', code: 'ACCOUNT_DISABLED' });
    }
    
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误', code: 'INVALID_CREDENTIALS' });
    }
    
    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    // 生成 JWT Token
    const token = generateToken(user.id, user.username, user.role);
    
    // 设置 cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 天
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        servers: user.servers.map(s => ({
          id: s.id,
          name: s.name,
          url: s.url,
          isDefault: s.isDefault
        }))
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败，请稍后重试', code: 'INTERNAL_ERROR' });
  }
});

// 登出
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { servers: true }
    });
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在', code: 'USER_NOT_FOUND' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      servers: user.servers.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        isDefault: s.isDefault
      }))
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: '获取用户信息失败', code: 'INTERNAL_ERROR' });
  }
});

// 更新用户服务器
router.put('/servers', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { servers } = req.body;
    
    // 删除现有服务器配置
    await prisma.userServer.deleteMany({ where: { userId } });
    
    // 创建新的服务器配置
    if (servers && servers.length > 0) {
      await prisma.userServer.createMany({
        data: servers.map((s: { name: string; url: string; isDefault: boolean }) => ({
          userId,
          name: s.name,
          url: s.url,
          isDefault: s.isDefault
        }))
      });
    }
    
    const updatedServers = await prisma.userServer.findMany({ where: { userId } });
    
    res.json({
      success: true,
      servers: updatedServers.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        isDefault: s.isDefault
      }))
    });
  } catch (error) {
    console.error('Update servers error:', error);
    res.status(500).json({ error: '更新服务器失败', code: 'INTERNAL_ERROR' });
  }
});

// 修改密码
router.post('/change-password', authMiddleware, validate(changePasswordSchema), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { oldPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在', code: 'USER_NOT_FOUND' });
    }
    
    const isValidPassword = await verifyPassword(oldPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '旧密码错误', code: 'INVALID_PASSWORD' });
    }
    
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败', code: 'INTERNAL_ERROR' });
  }
});

// 管理员：获取用户列表
router.get('/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: '获取用户列表失败', code: 'INTERNAL_ERROR' });
  }
});

// 管理员：创建用户
router.post('/users', authMiddleware, adminMiddleware, validate(createUserSchema), async (req: AuthRequest, res) => {
  try {
    const { username, password, displayName, role } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在', code: 'USERNAME_EXISTS' });
    }
    
    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        displayName: displayName || username,
        role: role || 'user',
        servers: {
          create: {
            name: '本地服务器',
            url: 'http://localhost:3001',
            isDefault: true
          }
        }
      }
    });
    
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: '创建用户失败', code: 'INTERNAL_ERROR' });
  }
});

// 管理员：更新用户
router.patch('/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const targetId = req.params.id;
    const { displayName, role, isActive, password } = req.body;
    
    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.password = await hashPassword(password);
    
    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: '更新用户失败', code: 'INTERNAL_ERROR' });
  }
});

// 管理员：删除用户
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const targetId = req.params.id;
    
    if (targetId === req.user!.userId) {
      return res.status(400).json({ error: '不能删除自己', code: 'CANNOT_DELETE_SELF' });
    }
    
    await prisma.user.delete({ where: { id: targetId } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败', code: 'INTERNAL_ERROR' });
  }
});

export { router as authRoutes };
