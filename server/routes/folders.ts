import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuthMiddleware, authMiddleware, AuthRequest } from '../lib/auth.js';
import { validate, createFolderSchema } from '../lib/validation.js';
import { clearFolderCache } from './files.js';

const router = Router();

// 添加文件夹操作历史记录
async function addFolderHistory(
  folderId: string,
  folderName: string,
  action: string,
  details?: Record<string, any>,
  userId?: string
) {
  try {
    await prisma.history.create({
      data: {
        fileId: folderId, // 使用 folderId 作为标识
        fileName: `📁 ${folderName}`, // 添加文件夹图标前缀
        filePath: null,
        action,
        details: details ? JSON.stringify({ ...details, isFolder: true }) : JSON.stringify({ isFolder: true }),
        userId,
      },
    });
  } catch (err) {
    console.error('Failed to add folder history:', err);
  }
}

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

// 优化版：单次查询所有文件夹，内存中构建树
async function buildFolderTreeOptimized(): Promise<any[]> {
  // 一次性获取所有文件夹，按 sortOrder 排序
  const allFolders = await prisma.folder.findMany({
    include: {
      _count: { select: { files: true } },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { name: 'asc' },
    ],
  });
  
  // 构建父子关系映射
  const folderMap = new Map<string, any>();
  const childrenMap = new Map<string | null, string[]>();
  
  // 初始化
  allFolders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
    const parentId = folder.parentId;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(folder.id);
  });
  
  // 构建树结构
  function buildTree(parentId: string | null): any[] {
    const childIds = childrenMap.get(parentId) || [];
    return childIds.map(id => {
      const folder = folderMap.get(id);
      folder.children = buildTree(id);
      return folder;
    });
  }
  
  return buildTree(null);
}

// Get folder tree (hierarchical structure) - 优化版单次查询
router.get('/tree', async (_req, res) => {
  try {
    const folders = await buildFolderTreeOptimized();
    res.json(folders);
  } catch (error) {
    console.error('获取文件夹树错误:', error);
    res.status(500).json({ error: '获取文件夹树失败', code: 'SERVER_ERROR' });
  }
});

// 批量更新文件夹排序 (必须在 /:id 路由之前定义)
router.put('/reorder', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: '无效的排序数据' });
    }
    
    // 验证数据格式
    for (const item of orders) {
      if (!item.id || typeof item.sortOrder !== 'number') {
        return res.status(400).json({ error: '排序数据格式错误' });
      }
    }
    
    // 批量更新
    await prisma.$transaction(
      orders.map((item: { id: string; sortOrder: number }) =>
        prisma.folder.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    
    // 清除缓存
    clearFolderCache();
    
    res.json({ success: true, message: '排序已更新' });
  } catch (error) {
    console.error('更新排序错误:', error);
    res.status(500).json({ error: '更新排序失败', code: 'SERVER_ERROR' });
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
    let parentFolder = null;
    if (parentId) {
      parentFolder = await prisma.folder.findUnique({ where: { id: parentId } });
      if (!parentFolder) {
        return res.status(400).json({ error: '父文件夹不存在' });
      }
    }

    // 获取同级文件夹的最大 sortOrder
    const maxSortOrder = await prisma.folder.aggregate({
      where: { parentId: parentId || null },
      _max: { sortOrder: true },
    });
    const newSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        color: color || '#4a9eff',
        icon,
        sortOrder: newSortOrder,
      },
    });

    // 记录创建历史
    await addFolderHistory(folder.id, folder.name, 'edit', {
      type: 'create',
      parent: parentFolder?.name || '根目录',
    }, req.user?.userId);

    // 清除文件夹缓存
    clearFolderCache();

    res.status(201).json(folder);
  } catch (error) {
    console.error('创建文件夹错误:', error);
    res.status(500).json({ error: '创建文件夹失败', code: 'SERVER_ERROR' });
  }
});

// Update folder
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
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

    // 获取原文件夹信息
    const oldFolder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { parent: true },
    });

    if (!oldFolder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }

    const folder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        name,
        parentId,
        color,
        icon,
      },
      include: { parent: true },
    });

    // 记录历史
    const userId = req.user?.userId;
    
    // 重命名
    if (name && name !== oldFolder.name) {
      await addFolderHistory(folderId, folder.name, 'rename', {
        from: oldFolder.name,
        to: name,
      }, userId);
    }
    
    // 移动
    if (parentId !== undefined && parentId !== oldFolder.parentId) {
      const newParent = folder.parent;
      await addFolderHistory(folderId, folder.name, 'move', {
        fromFolder: oldFolder.parent?.name || '根目录',
        toFolder: newParent?.name || '根目录',
      }, userId);
    }
    
    // 编辑（颜色或图标变更）
    if ((color && color !== oldFolder.color) || (icon && icon !== oldFolder.icon)) {
      await addFolderHistory(folderId, folder.name, 'edit', {
        type: 'appearance',
        color: color !== oldFolder.color ? { from: oldFolder.color, to: color } : undefined,
        icon: icon !== oldFolder.icon ? { from: oldFolder.icon, to: icon } : undefined,
      }, userId);
    }

    res.json(folder);
  } catch (error) {
    console.error('更新文件夹错误:', error);
    res.status(500).json({ error: '更新文件夹失败', code: 'SERVER_ERROR' });
  }
});

// 递归删除文件夹及其所有内容
async function deleteFolderRecursively(folderId: string): Promise<{ filesDeleted: number; foldersDeleted: number }> {
  let filesDeleted = 0;
  let foldersDeleted = 0;
  
  // 获取所有子文件夹
  const childFolders = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  
  // 递归删除子文件夹
  for (const child of childFolders) {
    const result = await deleteFolderRecursively(child.id);
    filesDeleted += result.filesDeleted;
    foldersDeleted += result.foldersDeleted;
  }
  
  // 删除该文件夹中的所有文件（先删除文件标签关联）
  const files = await prisma.file.findMany({
    where: { folderId },
    select: { id: true },
  });
  
  if (files.length > 0) {
    const fileIds = files.map(f => f.id);
    
    // 删除文件标签关联
    await prisma.fileTag.deleteMany({
      where: { fileId: { in: fileIds } },
    });
    
    // 删除文件
    await prisma.file.deleteMany({
      where: { folderId },
    });
    
    filesDeleted += files.length;
  }
  
  // 删除文件夹本身
  await prisma.folder.delete({
    where: { id: folderId },
  });
  foldersDeleted += 1;
  
  return { filesDeleted, foldersDeleted };
}

// Delete folder
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const folderId = req.params.id;
    if (!/^[a-f0-9-]+$/i.test(folderId)) {
      return res.status(400).json({ error: '无效的文件夹ID' });
    }

    // 是否强制删除（级联删除所有内容）
    const force = req.query.force === 'true';

    // 获取文件夹信息
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        _count: { select: { files: true, children: true } },
        parent: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }

    const hasContent = folder._count.files > 0 || folder._count.children > 0;

    // 如果文件夹不为空且没有指定强制删除，返回确认信息
    if (hasContent && !force) {
      // 统计将要删除的内容数量
      const stats = await countFolderContents(folderId);
      return res.status(400).json({ 
        error: '文件夹不为空',
        code: 'FOLDER_NOT_EMPTY',
        needConfirm: true,
        stats: {
          totalFiles: stats.files,
          totalFolders: stats.folders,
        },
        message: `该文件夹包含 ${stats.files} 个文件和 ${stats.folders} 个子文件夹，确定要全部删除吗？`
      });
    }

    // 记录删除历史
    await addFolderHistory(folderId, folder.name, 'delete', {
      parent: folder.parent?.name || '根目录',
      cascade: hasContent,
    }, req.user?.userId);

    // 执行删除
    if (hasContent) {
      // 级联删除
      const result = await deleteFolderRecursively(folderId);
      // 清除文件夹缓存
      clearFolderCache();
      res.json({ 
        success: true, 
        message: `已删除 ${result.filesDeleted} 个文件和 ${result.foldersDeleted} 个文件夹`,
        deleted: result,
      });
    } else {
      // 直接删除空文件夹
      await prisma.folder.delete({
        where: { id: folderId },
      });
      // 清除文件夹缓存
      clearFolderCache();
      res.status(204).send();
    }
  } catch (error) {
    console.error('删除文件夹错误:', error);
    res.status(500).json({ error: '删除文件夹失败', code: 'SERVER_ERROR' });
  }
});

// 统计文件夹及其子文件夹中的内容数量
async function countFolderContents(folderId: string): Promise<{ files: number; folders: number }> {
  let files = 0;
  let folders = 0;
  
  // 获取当前文件夹的文件数量
  const fileCount = await prisma.file.count({
    where: { folderId },
  });
  files += fileCount;
  
  // 获取所有子文件夹
  const childFolders = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  
  folders += childFolders.length;
  
  // 递归统计子文件夹
  for (const child of childFolders) {
    const childStats = await countFolderContents(child.id);
    files += childStats.files;
    folders += childStats.folders;
  }
  
  return { files, folders };
}

// 移动文件夹到新位置（支持改变父级和排序）
router.put('/:id/move', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const folderId = req.params.id;
    const { parentId, sortOrder } = req.body;
    
    if (!/^[a-f0-9-]+$/i.test(folderId)) {
      return res.status(400).json({ error: '无效的文件夹ID' });
    }
    
    // 不能移动到自身
    if (parentId === folderId) {
      return res.status(400).json({ error: '不能将文件夹移动到自身' });
    }
    
    // 获取原文件夹
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { parent: true },
    });
    
    if (!folder) {
      return res.status(404).json({ error: '文件夹不存在' });
    }
    
    // 检查是否移动到子文件夹下（不允许）
    if (parentId) {
      const isDescendant = await checkIsDescendant(folderId, parentId);
      if (isDescendant) {
        return res.status(400).json({ error: '不能将文件夹移动到其子文件夹下' });
      }
    }
    
    // 计算新的 sortOrder
    let newSortOrder = sortOrder;
    if (newSortOrder === undefined) {
      const maxSortOrder = await prisma.folder.aggregate({
        where: { parentId: parentId || null },
        _max: { sortOrder: true },
      });
      newSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
    }
    
    // 更新文件夹
    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        parentId: parentId === undefined ? folder.parentId : parentId,
        sortOrder: newSortOrder,
      },
      include: { parent: true },
    });
    
    // 记录历史
    if (parentId !== undefined && parentId !== folder.parentId) {
      await addFolderHistory(folderId, folder.name, 'move', {
        fromFolder: folder.parent?.name || '根目录',
        toFolder: updatedFolder.parent?.name || '根目录',
      }, req.user?.userId);
    }
    
    // 清除缓存
    clearFolderCache();
    
    res.json(updatedFolder);
  } catch (error) {
    console.error('移动文件夹错误:', error);
    res.status(500).json({ error: '移动文件夹失败', code: 'SERVER_ERROR' });
  }
});

// 检查 targetId 是否是 folderId 的子孙文件夹
async function checkIsDescendant(folderId: string, targetId: string): Promise<boolean> {
  const children = await prisma.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  
  for (const child of children) {
    if (child.id === targetId) {
      return true;
    }
    if (await checkIsDescendant(child.id, targetId)) {
      return true;
    }
  }
  
  return false;
}

export { router as folderRoutes };
