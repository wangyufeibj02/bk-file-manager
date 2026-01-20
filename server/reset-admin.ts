import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

const prisma = new PrismaClient();

async function resetAdmin() {
  try {
    // 删除现有的 admin 用户
    await prisma.user.deleteMany({
      where: { username: 'admin' }
    });
    
    console.log('✅ 已删除旧的 admin 用户');
    
    // 创建新的 admin 用户（使用 bcrypt 加密）
    const hashedPassword = await bcrypt.hash(config.defaultAdmin.password, config.bcryptRounds);
    
    await prisma.user.create({
      data: {
        username: config.defaultAdmin.username,
        password: hashedPassword,
        displayName: config.defaultAdmin.displayName,
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
    
    console.log('✅ 已创建新的 admin 用户');
    console.log(`   用户名: ${config.defaultAdmin.username}`);
    console.log(`   密码: ${config.defaultAdmin.password}`);
    
  } catch (error) {
    console.error('❌ 重置失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();
