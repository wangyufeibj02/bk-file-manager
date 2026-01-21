import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../lib/auth.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Action types for history
export type HistoryAction = 'view' | 'edit' | 'rename' | 'move' | 'tag' | 'rate' | 'delete' | 'restore';

// Add history record
export async function addHistory(
  fileId: string,
  fileName: string,
  action: HistoryAction,
  details?: Record<string, unknown>,
  filePath?: string,
  userId?: string
) {
  try {
    await prisma.history.create({
      data: {
        fileId,
        fileName,
        filePath,
        action,
        details: details ? JSON.stringify(details) : null,
        userId,
      },
    });
  } catch (err) {
    console.error('Failed to add history:', err);
  }
}

// Get history records with pagination and load more support
router.get('/', optionalAuthMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const action = req.query.action as string;

    const where: Record<string, unknown> = {};
    if (action && ['view', 'edit', 'rename', 'move', 'tag', 'rate', 'delete', 'restore'].includes(action)) {
      where.action = action;
    }

    const [records, total] = await Promise.all([
      prisma.history.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.history.count({ where }),
    ]);

    // 获取所有用户信息
    const userIds = [...new Set(records.map(r => r.userId).filter(Boolean))] as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map(u => [u.id, u.username]));

    // Parse details JSON and add username
    const parsedRecords = records.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : null,
      userName: r.userId ? userMap.get(r.userId) || '未知用户' : null,
    }));

    res.json({
      records: parsedRecords,
      total,
      limit,
      offset,
      hasMore: offset + records.length < total,
      nextOffset: offset + records.length < total ? offset + limit : null,
    });
  } catch (err) {
    console.error('Failed to get history:', err);
    res.status(500).json({ 
      error: '获取历史记录失败',
      code: 'INTERNAL_ERROR' 
    });
  }
});

// Clear history
router.delete('/', authMiddleware, async (req, res) => {
  try {
    await prisma.history.deleteMany({});
    res.json({ success: true, message: '历史记录已清空' });
  } catch (err) {
    console.error('Failed to clear history:', err);
    res.status(500).json({ 
      error: '清除历史记录失败',
      code: 'INTERNAL_ERROR' 
    });
  }
});

// Get trash items with file existence check and user info
router.get('/trash', optionalAuthMiddleware, async (req, res) => {
  try {
    const items = await prisma.trash.findMany({
      orderBy: { deletedAt: 'desc' },
    });
    
    // 获取所有删除者的用户信息
    const userIds = [...new Set(items.map(item => item.deletedBy).filter(Boolean))] as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map(u => [u.id, u.username]));
    
    // 检查物理文件是否存在并添加用户名
    const itemsWithStatus = items.map(item => {
      let fileExists = false;
      try {
        // 处理绝对路径和相对路径
        const filePath = item.originalPath.startsWith('/') || item.originalPath.includes(':')
          ? item.originalPath
          : path.resolve(process.cwd(), item.originalPath.replace(/^\//, ''));
        fileExists = fs.existsSync(filePath);
      } catch {
        // ignore
      }
      return {
        ...item,
        fileExists,
        canRestore: fileExists,
        deletedByName: item.deletedBy ? userMap.get(item.deletedBy) || '未知用户' : null,
      };
    });
    
    res.json(itemsWithStatus);
  } catch (err) {
    console.error('Failed to get trash:', err);
    res.status(500).json({ 
      error: '获取回收站失败',
      code: 'INTERNAL_ERROR' 
    });
  }
});

// Restore file from trash with physical file check
router.post('/trash/:id/restore', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const trashItem = await prisma.trash.findUnique({ where: { id } });

    if (!trashItem) {
      return res.status(404).json({ 
        error: '回收站项目不存在',
        code: 'NOT_FOUND' 
      });
    }

    // 检查物理文件是否存在
    const filePath = trashItem.originalPath.startsWith('/') || trashItem.originalPath.includes(':')
      ? trashItem.originalPath
      : path.resolve(process.cwd(), trashItem.originalPath.replace(/^\//, ''));
    
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ 
        error: '原始文件已不存在，无法恢复',
        code: 'FILE_NOT_FOUND',
        details: {
          path: filePath,
          suggestion: '文件可能已被手动删除或移动'
        }
      });
    }

    // 检查是否已经有同ID的文件存在
    const existingFile = await prisma.file.findUnique({
      where: { id: trashItem.fileId }
    });
    
    if (existingFile) {
      // 如果已存在，只需删除回收站记录
      await prisma.trash.delete({ where: { id } });
      return res.json({ 
        success: true, 
        file: existingFile,
        message: '文件已恢复' 
      });
    }

    // Recreate file in database
    const file = await prisma.file.create({
      data: {
        id: trashItem.fileId,
        name: trashItem.originalName.split('.').slice(0, -1).join('.') || trashItem.originalName,
        originalName: trashItem.originalName,
        path: trashItem.originalPath,
        thumbnailPath: trashItem.thumbnailPath,
        mimeType: trashItem.mimeType,
        size: trashItem.size,
        folderId: trashItem.folderId,
      },
    });

    // Remove from trash
    await prisma.trash.delete({ where: { id } });

    // Add history
    await addHistory(file.id, file.originalName, 'restore', { from: 'trash' }, file.path, req.user?.userId);

    res.json({ 
      success: true, 
      file,
      message: '文件已恢复' 
    });
  } catch (err) {
    console.error('Failed to restore file:', err);
    res.status(500).json({ 
      error: '恢复文件失败',
      code: 'INTERNAL_ERROR' 
    });
  }
});

// Permanently delete from trash
router.delete('/trash/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const deletePhysical = req.query.deletePhysical === 'true';
    
    const trashItem = await prisma.trash.findUnique({ where: { id } });
    if (!trashItem) {
      return res.status(404).json({ 
        error: '回收站项目不存在',
        code: 'NOT_FOUND' 
      });
    }
    
    // 可选：删除物理文件
    if (deletePhysical) {
      try {
        const filePath = trashItem.originalPath.startsWith('/') || trashItem.originalPath.includes(':')
          ? trashItem.originalPath
          : path.resolve(process.cwd(), trashItem.originalPath.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        // 也删除缩略图
        if (trashItem.thumbnailPath) {
          const thumbPath = path.resolve(process.cwd(), trashItem.thumbnailPath.replace(/^\//, ''));
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
          }
        }
      } catch (err) {
        console.error('Failed to delete physical file:', err);
        // 继续删除数据库记录
      }
    }
    
    await prisma.trash.delete({ where: { id } });
    res.json({ success: true, message: '已永久删除' });
  } catch (err) {
    console.error('Failed to delete from trash:', err);
    res.status(500).json({ 
      error: '永久删除失败',
      code: 'INTERNAL_ERROR' 
    });
  }
});

// Empty trash
router.delete('/trash', authMiddleware, async (req, res) => {
  try {
    const deletePhysical = req.query.deletePhysical === 'true';
    
    if (deletePhysical) {
      const items = await prisma.trash.findMany();
      for (const item of items) {
        try {
          const filePath = item.originalPath.startsWith('/') || item.originalPath.includes(':')
            ? item.originalPath
            : path.resolve(process.cwd(), item.originalPath.replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // ignore individual file errors
        }
      }
    }
    
    const { count } = await prisma.trash.deleteMany({});
    res.json({ success: true, count, message: `已清空回收站 (${count} 个项目)` });
  } catch (err) {
    console.error('Failed to empty trash:', err);
    res.status(500).json({ 
      error: '清空回收站失败',
      code: 'INTERNAL_ERROR' 
    });
  }
});

export default router;
