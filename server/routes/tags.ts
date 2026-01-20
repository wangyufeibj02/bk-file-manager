import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuthMiddleware, authMiddleware, AuthRequest } from '../lib/auth.js';
import { validate, createTagSchema } from '../lib/validation.js';

const router = Router();

// 读取可选认证，写入需要认证
router.use(optionalAuthMiddleware);

// Get all tags
router.get('/', async (_req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        children: true,
        _count: {
          select: { files: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    console.error('获取标签错误:', error);
    res.status(500).json({ error: '获取标签失败', code: 'SERVER_ERROR' });
  }
});

// Get tag tree
router.get('/tree', async (_req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: true,
            _count: { select: { files: true } },
          },
        },
        _count: { select: { files: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    console.error('获取标签树错误:', error);
    res.status(500).json({ error: '获取标签树失败', code: 'SERVER_ERROR' });
  }
});

// Create tag
router.post('/', authMiddleware, validate(createTagSchema), async (req: AuthRequest, res) => {
  try {
    const { name, color, parentId } = req.body;
    
    // 检查标签名是否已存在
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: '标签名称已存在', code: 'DUPLICATE' });
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#4a9eff',
        parentId: parentId || null,
      },
    });
    res.status(201).json(tag);
  } catch (error) {
    console.error('创建标签错误:', error);
    res.status(500).json({ error: '创建标签失败', code: 'SERVER_ERROR' });
  }
});

// Update tag
router.patch('/:id', async (req, res) => {
  try {
    const tagId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(tagId)) {
      return res.status(400).json({ error: '无效的标签ID' });
    }

    const { name, color, parentId } = req.body;
    
    // 如果修改名称，检查是否重复
    if (name) {
      const existing = await prisma.tag.findFirst({ 
        where: { name, id: { not: tagId } } 
      });
      if (existing) {
        return res.status(400).json({ error: '标签名称已存在', code: 'DUPLICATE' });
      }
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        name,
        color,
        parentId,
      },
    });
    res.json(tag);
  } catch (error) {
    console.error('更新标签错误:', error);
    res.status(500).json({ error: '更新标签失败', code: 'SERVER_ERROR' });
  }
});

// Delete tag
router.delete('/:id', async (req, res) => {
  try {
    const tagId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(tagId)) {
      return res.status(400).json({ error: '无效的标签ID' });
    }

    // 检查标签是否存在
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        _count: { select: { files: true, children: true } },
      },
    });

    if (!tag) {
      return res.status(404).json({ error: '标签不存在', code: 'NOT_FOUND' });
    }

    // 删除标签（级联删除会自动移除文件关联）
    await prisma.tag.delete({
      where: { id: tagId },
    });
    
    res.json({ 
      success: true, 
      message: `标签 "${tag.name}" 已删除`,
      affectedFiles: tag._count.files,
    });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({ error: '删除标签失败', code: 'SERVER_ERROR' });
  }
});

// 批量删除标签
router.post('/bulk/delete', async (req, res) => {
  try {
    const { tagIds } = req.body;
    
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: '请选择要删除的标签' });
    }

    // 验证所有 ID 格式
    for (const id of tagIds) {
      if (!/^[a-f0-9-]+$/i.test(id)) {
        return res.status(400).json({ error: '包含无效的标签ID' });
      }
    }

    const result = await prisma.tag.deleteMany({
      where: { id: { in: tagIds } },
    });
    
    res.json({ 
      success: true, 
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('批量删除标签错误:', error);
    res.status(500).json({ error: '批量删除标签失败', code: 'SERVER_ERROR' });
  }
});

export { router as tagRoutes };
