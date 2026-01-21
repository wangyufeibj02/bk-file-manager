import { PrismaClient } from '@prisma/client';

// 优化 SQLite 连接配置
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// 启用 SQLite WAL 模式以提升并发性能
async function enableWALMode() {
  try {
    // 使用 $queryRawUnsafe 执行 PRAGMA（允许返回结果）
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA cache_size = -64000;'); // 64MB 缓存
    await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
    console.log('[DB] SQLite WAL mode enabled');
  } catch (e) {
    console.warn('[DB] Failed to enable WAL mode:', e);
  }
}

// 初始化数据库优化
enableWALMode();

// 确保进程退出时正确关闭数据库连接
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
