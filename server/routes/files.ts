import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { upload, uploadsDir } from '../lib/upload.js';
import { processImage } from '../lib/imageProcessor.js';
import { addHistory } from './history.js';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../lib/auth.js';
import { 
  validate, 
  fileQuerySchema, 
  updateFileSchema,
  bulkMoveSchema,
  bulkTagSchema,
  bulkOperationSchema
} from '../lib/validation.js';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { exec } from 'child_process';

const router = Router();

// 缓存所有文件夹关系（优化性能）
let folderCache: Map<string, string[]> | null = null;
let folderCacheTime = 0;
const CACHE_TTL = 30000; // 30秒缓存

// 获取文件夹及其所有子文件夹的 ID（优化版本：单次查询 + 缓存）
async function getAllChildFolderIds(folderId: string): Promise<string[]> {
  const now = Date.now();
  
  // 检查缓存是否有效
  if (!folderCache || now - folderCacheTime > CACHE_TTL) {
    // 一次性获取所有文件夹
    const allFolders = await prisma.folder.findMany({
      select: { id: true, parentId: true },
    });
    
    // 构建父子关系映射
    folderCache = new Map<string, string[]>();
    for (const folder of allFolders) {
      if (folder.parentId) {
        const children = folderCache.get(folder.parentId) || [];
        children.push(folder.id);
        folderCache.set(folder.parentId, children);
      }
    }
    folderCacheTime = now;
  }
  
  // 在内存中递归收集子文件夹 ID
  const result: string[] = [folderId];
  const stack = [folderId];
  
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = folderCache.get(currentId) || [];
    for (const childId of children) {
      result.push(childId);
      stack.push(childId);
    }
  }
  
  return result;
}

// 清除文件夹缓存（在文件夹变更时调用）
export function clearFolderCache() {
  folderCache = null;
}

// 颜色分类 - 按色相范围定义
interface ColorCategory {
  name: string;
  color: string;
  hueRange?: [number, number];
  hueRange2?: [number, number]; // 红色跨越0度
  isNeutral?: boolean;
  isDark?: boolean;
}

const COLOR_CATEGORIES: ColorCategory[] = [
  { name: '红色系', color: '#ef4444', hueRange: [0, 15], hueRange2: [345, 360] },
  { name: '橙色系', color: '#f97316', hueRange: [15, 45] },
  { name: '黄色系', color: '#eab308', hueRange: [45, 70] },
  { name: '绿色系', color: '#22c55e', hueRange: [70, 160] },
  { name: '青色系', color: '#14b8a6', hueRange: [160, 200] },
  { name: '蓝色系', color: '#3b82f6', hueRange: [200, 260] },
  { name: '紫色系', color: '#8b5cf6', hueRange: [260, 290] },
  { name: '粉色系', color: '#ec4899', hueRange: [290, 345] },
  { name: '灰白系', color: '#9ca3af', isNeutral: true },
  { name: '黑暗系', color: '#374151', isDark: true },
];

// 将十六进制颜色转换为 HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// 检查颜色是否属于某个分类
function colorMatchesCategory(dominantColor: string, categoryColor: string): boolean {
  const category = COLOR_CATEGORIES.find(c => c.color === categoryColor);
  if (!category) return false;

  const hsl = hexToHsl(dominantColor);
  if (!hsl) return false;

  // 灰白系 - 低饱和度高亮度
  if (category.isNeutral) {
    return hsl.s < 15 && hsl.l > 60;
  }

  // 黑暗系 - 低亮度
  if (category.isDark) {
    return hsl.l < 25;
  }

  // 按色相范围匹配
  if (category.hueRange) {
    const [min, max] = category.hueRange;
    if (hsl.h >= min && hsl.h < max && hsl.s > 15) {
      return true;
    }
  }
  if (category.hueRange2) {
    const [min, max] = category.hueRange2;
    if (hsl.h >= min && hsl.h < max && hsl.s > 15) {
      return true;
    }
  }

  return false;
}

// 大多数文件路由需要认证，但读取可选
router.use(optionalAuthMiddleware);

// Get all files with filters
router.get('/', validate(fileQuerySchema), async (req, res) => {
  try {
    const {
      folderId,
      search,
      mimeType,
      color,
      rating,
      tagIds,
      format,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = req.query as any;

    const where: Record<string, unknown> = {};

    // 如果指定了文件夹，递归获取该文件夹及其所有子文件夹中的文件
    if (folderId) {
      const allFolderIds = await getAllChildFolderIds(String(folderId));
      where.folderId = { in: allFolderIds };
    }

    if (search) {
      const sanitizedSearch = String(search).slice(0, 200);
      where.OR = [
        { name: { contains: sanitizedSearch } },
        { originalName: { contains: sanitizedSearch } },
        { annotation: { contains: sanitizedSearch } },
      ];
    }

    if (mimeType) {
      where.mimeType = { startsWith: String(mimeType) };
    }

    // Format filter - filter by file extension
    if (format) {
      const formats = String(format).split(',').map(f => f.toLowerCase().trim()).slice(0, 50);
      const formatConditions: Record<string, unknown>[] = [];
      formats.forEach(f => {
        if (/^[a-z0-9]+$/i.test(f)) { // 只允许字母数字
          formatConditions.push({ originalName: { endsWith: `.${f}` } });
          formatConditions.push({ originalName: { endsWith: `.${f.toUpperCase()}` } });
        }
      });
      
      if (formatConditions.length > 0) {
        if (where.OR) {
          where.AND = [
            { OR: where.OR as unknown[] },
            { OR: formatConditions }
          ];
          delete where.OR;
        } else {
          where.OR = formatConditions;
        }
      }
    }

    // 颜色筛选 - 支持多颜色
    let filterColors: string[] = [];
    if (color) {
      // 支持逗号分隔的多颜色
      const colorStr = String(color);
      filterColors = colorStr.split(',')
        .map(c => c.trim())
        .filter(c => /^#[0-9A-Fa-f]{6}$/.test(c));
    }
    // 只筛选有主题色的文件
    if (filterColors.length > 0) {
      where.dominantColor = { not: null };
    }

    if (rating) {
      const ratingNum = Math.min(5, Math.max(0, parseInt(String(rating), 10)));
      where.rating = { gte: ratingNum };
    }

    if (tagIds) {
      const ids = String(tagIds).split(',').filter(id => /^[a-f0-9-]+$/i.test(id)).slice(0, 20);
      if (ids.length > 0) {
        where.tags = {
          some: {
            tagId: { in: ids },
          },
        };
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

    // 如果有颜色筛选，需要后处理
    const hasColorFilter = filterColors.length > 0;

    let files: any[];
    let total: number;

    // 处理格式类型排序（需要按文件扩展名排序）
    const getFileExtension = (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      return ext || '';
    };

    // 如果按格式类型排序，需要获取所有文件后在内存中排序
    const needsInMemorySort = sortBy === 'format';

    if (hasColorFilter || needsInMemorySort) {
      // 颜色筛选或格式排序：获取更多数据后内存处理
      let allFiles = await prisma.file.findMany({
        where,
        include: {
          tags: { include: { tag: true } },
          folder: true,
        },
        // 如果不需要内存排序，使用数据库排序
        orderBy: needsInMemorySort ? undefined : { [sortBy as string]: sortOrder },
        take: needsInMemorySort ? 10000 : 1000, // 格式排序需要更多数据
      });

      // 内存过滤颜色
      if (hasColorFilter) {
        allFiles = allFiles.filter(f => 
          f.dominantColor && filterColors.some(fc => colorMatchesCategory(f.dominantColor!, fc))
        );
      }

      // 格式类型排序
      if (needsInMemorySort) {
        allFiles.sort((a, b) => {
          const extA = getFileExtension(a.originalName);
          const extB = getFileExtension(b.originalName);
          const comparison = extA.localeCompare(extB);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      }

      total = allFiles.length;
      files = allFiles.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    } else {
      // 优化：使用事务合并 count 和 findMany，减少数据库往返
      const [countResult, filesResult] = await prisma.$transaction([
        prisma.file.count({ where }),
        prisma.file.findMany({
          where,
          include: {
            tags: { include: { tag: true } },
            folder: true,
          },
          orderBy: { [sortBy as string]: sortOrder },
          take: limitNum,
          skip: (pageNum - 1) * limitNum,
        }),
      ]);

      total = countResult;
      files = filesResult;
    }

    res.json({
      files,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('获取文件错误:', error);
    res.status(500).json({ error: '获取文件失败', code: 'SERVER_ERROR' });
  }
});

// Get single file
router.get('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      return res.status(400).json({ error: '无效的文件ID' });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    });

    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // Record view history
    addHistory(file.id, file.originalName, 'view', undefined, file.path, req.user?.id);
    
    res.json(file);
  } catch (error) {
    console.error('获取文件错误:', error);
    res.status(500).json({ error: '获取文件失败' });
  }
});

// Upload files
router.post('/upload', upload.array('files', 100), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { folderId } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 验证 folderId
    if (folderId && !/^[a-f0-9-]+$/i.test(folderId)) {
      return res.status(400).json({ error: '无效的文件夹ID' });
    }

    const createdFiles = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadsDir, file.filename);
        const mimeType = mime.lookup(file.originalname) || file.mimetype;
        const isImage = mimeType.startsWith('image/');

        let thumbnailPath = '';
        let width = null;
        let height = null;
        let dominantColor = null;
        let palette = null;

        if (isImage) {
          try {
            const result = await processImage(filePath, file.filename);
            thumbnailPath = result.thumbnailPath;
            width = result.metadata.width;
            height = result.metadata.height;
            dominantColor = result.metadata.dominantColor;
            palette = JSON.stringify(result.metadata.palette);
          } catch (err) {
            console.error('图片处理失败:', err);
          }
        }

        return prisma.file.create({
          data: {
            name: file.filename,
            originalName: file.originalname,
            path: `/uploads/${file.filename}`,
            thumbnailPath,
            mimeType,
            size: file.size,
            width,
            height,
            dominantColor,
            palette,
            folderId: folderId || null,
          },
          include: {
            tags: { include: { tag: true } },
          },
        });
      })
    );

    res.status(201).json(createdFiles);
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// Update file
router.patch('/:id', authMiddleware, validate(updateFileSchema), async (req: AuthRequest, res) => {
  try {
    const fileId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      return res.status(400).json({ error: '无效的文件ID' });
    }

    const { name, folderId, rating, annotation } = req.body;
    
    // Get original file for history
    const originalFile = await prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: true },
    });

    if (!originalFile) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const file = await prisma.file.update({
      where: { id: fileId },
      data: {
        originalName: name,
        folderId,
        rating,
        annotation,
      },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    });
    
    // Record history based on what changed
    if (name && name !== originalFile.originalName) {
      addHistory(file.id, file.originalName, 'rename', { 
        from: originalFile.originalName, 
        to: name 
      }, file.path, req.user?.id);
    }
    if (folderId !== undefined && folderId !== originalFile.folderId) {
      addHistory(file.id, file.originalName, 'move', { 
        fromFolder: originalFile.folder?.name || '根目录',
        toFolder: file.folder?.name || '根目录'
      }, file.path, req.user?.id);
    }
    if (rating !== undefined && rating !== originalFile.rating) {
      addHistory(file.id, file.originalName, 'rate', { 
        from: originalFile.rating, 
        to: rating 
      }, file.path, req.user?.id);
    }
    if (annotation !== undefined && annotation !== originalFile.annotation) {
      addHistory(file.id, file.originalName, 'edit', { 
        field: 'annotation',
        from: originalFile.annotation,
        to: annotation
      }, file.path, req.user?.id);
    }
    
    res.json(file);
  } catch (error) {
    console.error('更新文件错误:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// Add tag to file
router.post('/:id/tags/:tagId', async (req, res) => {
  try {
    const { id: fileId, tagId } = req.params;
    
    // 验证 ID 格式
    if (!/^[a-f0-9-]+$/i.test(fileId) || !/^[a-f0-9-]+$/i.test(tagId)) {
      return res.status(400).json({ error: '无效的ID格式' });
    }

    await prisma.fileTag.create({
      data: { fileId, tagId },
    });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { tags: { include: { tag: true } } },
    });
    
    // Get tag name for history
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (file && tag) {
      addHistory(file.id, file.originalName, 'tag', { 
        action: 'add',
        tag: tag.name 
      }, file.path, req.user?.id);
    }
    
    res.json(file);
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({ error: '添加标签失败' });
  }
});

// Remove tag from file
router.delete('/:id/tags/:tagId', async (req, res) => {
  try {
    const { id: fileId, tagId } = req.params;
    
    if (!/^[a-f0-9-]+$/i.test(fileId) || !/^[a-f0-9-]+$/i.test(tagId)) {
      return res.status(400).json({ error: '无效的ID格式' });
    }

    await prisma.fileTag.deleteMany({
      where: { fileId, tagId },
    });
    res.status(204).send();
  } catch (error) {
    console.error('移除标签错误:', error);
    res.status(500).json({ error: '移除标签失败' });
  }
});

// Delete file (move to trash)
router.delete('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      return res.status(400).json({ error: '无效的文件ID' });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: true },
    });

    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 检查物理文件是否存在
    const physicalPath = file.path.startsWith('/') 
      ? path.join(process.cwd(), file.path)
      : file.path;
    const fileExists = fs.existsSync(physicalPath);

    // Move to trash
    await prisma.trash.create({
      data: {
        fileId: file.id,
        originalName: file.originalName,
        originalPath: file.path,
        thumbnailPath: file.thumbnailPath,
        mimeType: file.mimeType,
        size: file.size,
        folderId: file.folderId,
        folderName: file.folder?.name,
        deletedBy: req.user?.id,
      },
    });

    // Record delete history
    addHistory(file.id, file.originalName, 'delete', {
      folder: file.folder?.name || '根目录',
      physicalFileExists: fileExists,
    }, file.path, req.user?.id);

    // Remove from files table
    await prisma.file.delete({
      where: { id: fileId },
    });

    res.status(204).send();
  } catch (error) {
    console.error('删除文件错误:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// Bulk operations
router.post('/bulk/move', authMiddleware, validate(bulkMoveSchema), async (req: AuthRequest, res) => {
  try {
    const { fileIds, folderId } = req.body;
    
    // Get files and target folder for history
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      include: { folder: true },
    });

    const targetFolder = folderId 
      ? await prisma.folder.findUnique({ where: { id: folderId } })
      : null;
    
    await prisma.file.updateMany({
      where: { id: { in: fileIds } },
      data: { folderId },
    });
    
    // Record history for each file
    for (const file of files) {
      addHistory(file.id, file.originalName, 'move', {
        fromFolder: file.folder?.name || '根目录',
        toFolder: targetFolder?.name || '根目录',
      }, file.path, req.user?.id);
    }
    
    res.json({ success: true, count: fileIds.length });
  } catch (error) {
    console.error('批量移动错误:', error);
    res.status(500).json({ error: '批量移动失败' });
  }
});

router.post('/bulk/delete', authMiddleware, validate(bulkOperationSchema), async (req: AuthRequest, res) => {
  try {
    const { fileIds } = req.body;
    
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      include: { folder: true },
    });

    // Move files to trash
    for (const file of files) {
      await prisma.trash.create({
        data: {
          fileId: file.id,
          originalName: file.originalName,
          originalPath: file.path,
          thumbnailPath: file.thumbnailPath,
          mimeType: file.mimeType,
          size: file.size,
          folderId: file.folderId,
          folderName: file.folder?.name,
          deletedBy: req.user?.id,
        },
      });

      addHistory(file.id, file.originalName, 'delete', {
        folder: file.folder?.name || '根目录',
      }, file.path, req.user?.id);
    }

    await prisma.file.deleteMany({
      where: { id: { in: fileIds } },
    });

    res.json({ success: true, count: fileIds.length });
  } catch (error) {
    console.error('批量删除错误:', error);
    res.status(500).json({ error: '批量删除失败' });
  }
});

router.post('/bulk/tag', authMiddleware, validate(bulkTagSchema), async (req: AuthRequest, res) => {
  try {
    const { fileIds, tagId } = req.body;
    
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
    });
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    
    await Promise.all(
      fileIds.map((fileId: string) =>
        prisma.fileTag.upsert({
          where: {
            fileId_tagId: { fileId, tagId },
          },
          create: { fileId, tagId },
          update: {},
        })
      )
    );

    // Record history
    if (tag) {
      for (const file of files) {
        addHistory(file.id, file.originalName, 'tag', {
          action: 'add',
          tag: tag.name,
        }, file.path, req.user?.id);
      }
    }

    res.json({ success: true, count: fileIds.length });
  } catch (error) {
    console.error('批量标签错误:', error);
    res.status(500).json({ error: '批量标签失败' });
  }
});

// Open file with native application
router.post('/open', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: '文件路径必填' });
    }

    // 安全检查：防止路径遍历
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      return res.status(400).json({ error: '无效的文件路径' });
    }

    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // Use platform-specific command to open file
    const command = process.platform === 'win32' 
      ? `start "" "${normalizedPath}"`
      : process.platform === 'darwin'
        ? `open "${normalizedPath}"`
        : `xdg-open "${normalizedPath}"`;

    exec(command, (error) => {
      if (error) {
        console.error('打开文件错误:', error);
        return res.status(500).json({ error: '打开文件失败' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('打开文件错误:', error);
    res.status(500).json({ error: '打开文件失败' });
  }
});

// 检查文件物理存在性
router.get('/:id/exists', async (req, res) => {
  try {
    const fileId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      return res.status(400).json({ error: '无效的文件ID' });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return res.status(404).json({ error: '文件记录不存在' });
    }

    const physicalPath = file.path.startsWith('/') 
      ? path.join(process.cwd(), file.path)
      : file.path;
    const exists = fs.existsSync(physicalPath);

    res.json({ 
      exists, 
      path: file.path,
      physicalPath: exists ? physicalPath : null,
    });
  } catch (error) {
    console.error('检查文件存在错误:', error);
    res.status(500).json({ error: '检查失败' });
  }
});

// 重新生成视频缩略图
router.post('/regenerate-thumbnails', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // 导入必要的模块
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const ffmpegStatic = (await import('ffmpeg-static')).default;
    const ffprobeStatic = (await import('ffprobe-static')).default;
    
    // 配置 ffmpeg 路径
    if (ffmpegStatic) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
    }
    ffmpeg.setFfprobePath(ffprobeStatic.path);
    
    const THUMBNAILS_DIR = path.join(process.cwd(), 'thumbnails');
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    }
    
    // 获取所有没有缩略图的视频文件
    const videoFiles = await prisma.file.findMany({
      where: {
        OR: [
          { mimeType: { startsWith: 'video/' } },
          { path: { endsWith: '.mp4' } },
          { path: { endsWith: '.mov' } },
          { path: { endsWith: '.avi' } },
          { path: { endsWith: '.mkv' } },
          { path: { endsWith: '.webm' } },
        ],
        thumbnailPath: null,
      },
      select: {
        id: true,
        path: true,
        originalName: true,
      },
    });
    
    if (videoFiles.length === 0) {
      return res.json({ success: true, message: '没有需要生成缩略图的视频', processed: 0 });
    }
    
    let processed = 0;
    let errors = 0;
    
    // 为每个视频生成缩略图
    for (const file of videoFiles) {
      try {
        const videoPath = file.path;
        
        // 检查文件是否存在
        if (!fs.existsSync(videoPath)) {
          console.log(`视频文件不存在: ${videoPath}`);
          errors++;
          continue;
        }
        
        const thumbnailName = `thumb_${Date.now()}_${path.parse(file.originalName).name}.jpg`;
        const thumbnailFullPath = path.join(THUMBNAILS_DIR, thumbnailName);
        
        // 生成缩略图
        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .screenshots({
              timestamps: ['00:00:01'],
              filename: thumbnailName,
              folder: THUMBNAILS_DIR,
              size: '320x?'
            });
        });
        
        // 更新数据库
        await prisma.file.update({
          where: { id: file.id },
          data: { thumbnailPath: `/thumbnails/${thumbnailName}` },
        });
        
        processed++;
        console.log(`生成缩略图成功: ${file.originalName}`);
        
      } catch (err) {
        console.error(`生成缩略图失败: ${file.originalName}`, err);
        errors++;
      }
    }
    
    res.json({
      success: true,
      message: `处理完成: ${processed} 个成功, ${errors} 个失败`,
      total: videoFiles.length,
      processed,
      errors,
    });
    
  } catch (error) {
    console.error('重新生成缩略图错误:', error);
    res.status(500).json({ error: '生成缩略图失败', details: error instanceof Error ? error.message : String(error) });
  }
});

export { router as fileRoutes };
