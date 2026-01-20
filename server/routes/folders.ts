import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuthMiddleware, authMiddleware, AuthRequest } from '../lib/auth.js';
import { validate, createFolderSchema } from '../lib/validation.js';

const router = Router();

// 读取可选认证，写入需要认证
router.use(optionalAuthMiddleware);

// Get all folders
router.get('/', async (_req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      include: {
        children: true,
        _count: {
          select: { files: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(folders);
  } catch (error) {
    console.error('获取文件夹错误:', error);
    res.status(500).json({ error: '获取文件夹失败', code: 'SERVER_ERROR' });
  }
});

// Get folder tree (hierarchical structure)
router.get('/tree', async (_req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true,
                _count: { select: { files: true } },
              },
            },
            _count: { select: { files: true } },
          },
        },
        _count: { select: { files: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(folders);
  } catch (error) {
    console.error('获取文件夹树错误:', error);
    res.status(500).json({ error: '获取文件夹树失败', code: 'SERVER_ERROR' });
  }
});

// Get single folder with files
router.get('/:id', async (req, res) => {
  try {
    const folderId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(folderId)) {
      return res.status(400).json({ error: '无效的文件夹ID' });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        files: {
          include: {
            tags: { include: { tag: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        children: {
          include: {
            _count: { select: { files: true } },
          },
        },
      },
    });
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在', code: 'NOT_FOUND' });
    }
    res.json(folder);
  } catch (error) {
    console.error('获取文件夹错误:', error);
    res.status(500).json({ error: '获取文件夹失败', code: 'SERVER_ERROR' });
  }
});

// Create folder
router.post('/', authMiddleware, validate(createFolderSchema), async (req: AuthRequest, res) => {
  try {
    const { name, parentId, color, icon } = req.body;
    
    // 验证父文件夹是否存在
    if (parentId) {
      const parent = await prisma.folder.findUnique({ where: { id: parentId } });
      if (!parent) {
        return res.status(400).json({ error: '父文件夹不存在' });
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        color: color || '#4a9eff',
        icon,
      },
    });
    res.status(201).json(folder);
  } catch (error) {
    console.error('创建文件夹错误:', error);
    res.status(500).json({ error: '创建文件夹失败', code: 'SERVER_ERROR' });
  }
});

// Update folder
router.patch('/:id', async (req, res) => {
  try {
    const folderId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(folderId)) {
      return res.status(400).json({ error: '无效的文件夹ID' });
    }

    const { name, parentId, color, icon } = req.body;
    
    // 防止将文件夹移动到自己的子文件夹下
    if (parentId === folderId) {
      return res.status(400).json({ error: '不能将文件夹移动到自身' });
    }

    const folder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        name,
        parentId,
        color,
        icon,
      },
    });
    res.json(folder);
  } catch (error) {
    console.error('更新文件夹错误:', error);
    res.status(500).json({ error: '更新文件夹失败', code: 'SERVER_ERROR' });
  }
});

// Delete folder
router.delete('/:id', async (req, res) => {
  try {
    const folderId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(folderId)) {
      return res.status(400).json({ error: '无效的文件夹ID' });
    }

    // 检查是否有子文件夹或文件
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        _count: { select: { files: true, children: true } },
      },
    });

    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }

    if (folder._count.files > 0 || folder._count.children > 0) {
      return res.status(400).json({ 
        error: '文件夹不为空，请先删除其中的文件和子文件夹',
        code: 'FOLDER_NOT_EMPTY' 
      });
    }

    await prisma.folder.delete({
      where: { id: folderId },
    });
    res.status(204).send();
  } catch (error) {
    console.error('删除文件夹错误:', error);
    res.status(500).json({ error: '删除文件夹失败', code: 'SERVER_ERROR' });
  }
});

export { router as folderRoutes };
