import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// 通用验证器中间件
export function validate<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      if (!result.success) {
        const errors = result.error?.errors || [];
        return res.status(400).json({
          error: '输入验证失败',
          code: 'VALIDATION_ERROR',
          details: errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      
      // 使用验证后的数据
      if (result.data.body) req.body = result.data.body;
      if (result.data.query) req.query = result.data.query as any;
      if (result.data.params) req.params = result.data.params as any;
      next();
    } catch (error) {
      console.error('验证器内部错误:', error);
      next(error);
    }
  };
}

// 登录验证
export const loginSchema = z.object({
  body: z.object({
    username: z.string()
      .min(2, '用户名至少2个字符')
      .max(50, '用户名最多50个字符')
      .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文'),
    password: z.string()
      .min(6, '密码至少6个字符')
      .max(100, '密码最多100个字符'),
  }),
});

// 创建用户验证
export const createUserSchema = z.object({
  body: z.object({
    username: z.string()
      .min(2, '用户名至少2个字符')
      .max(50, '用户名最多50个字符')
      .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文'),
    password: z.string()
      .min(6, '密码至少6个字符')
      .max(100, '密码最多100个字符'),
    displayName: z.string().max(100).optional(),
    role: z.enum(['admin', 'user']).default('user'),
  }),
});

// 修改密码验证
export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, '请输入旧密码'),
    newPassword: z.string()
      .min(6, '新密码至少6个字符')
      .max(100, '新密码最多100个字符'),
  }),
});

// 文件查询验证
export const fileQuerySchema = z.object({
  query: z.object({
    folderId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
    mimeType: z.string().max(100).optional(),
    // 支持单个颜色或逗号分隔的多个颜色
    color: z.string().max(500).optional().refine(
      (val) => {
        if (!val) return true;
        const colors = val.split(',');
        return colors.every(c => /^#[0-9a-fA-F]{6}$/.test(c.trim()));
      },
      { message: '颜色格式无效，应为 #RRGGBB 格式' }
    ),
    rating: z.coerce.number().int().min(0).max(5).optional(),
    tagIds: z.string().optional(),
    format: z.string().max(200).optional(),
    sortBy: z.enum(['createdAt', 'format', 'name', 'size', 'rating', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

// 文件更新验证
export const updateFileSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().max(255).optional(),
    folderId: z.string().uuid().nullable().optional(),
    rating: z.number().int().min(0).max(5).optional(),
    annotation: z.string().max(5000).optional(),
  }),
});

// 文件夹创建验证
export const createFolderSchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, '文件夹名称不能为空')
      .max(255, '文件夹名称最多255个字符'),
    parentId: z.string().uuid().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    icon: z.string().max(50).optional(),
  }),
});

// 标签创建验证
export const createTagSchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, '标签名称不能为空')
      .max(100, '标签名称最多100个字符'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    parentId: z.string().uuid().optional(),
  }),
});

// 批量操作验证
export const bulkOperationSchema = z.object({
  body: z.object({
    fileIds: z.array(z.string().uuid()).min(1, '请选择至少一个文件'),
  }),
});

// 批量移动验证
export const bulkMoveSchema = z.object({
  body: z.object({
    fileIds: z.array(z.string().uuid()).min(1, '请选择至少一个文件'),
    folderId: z.string().uuid().nullable(),
  }),
});

// 批量标签验证
export const bulkTagSchema = z.object({
  body: z.object({
    fileIds: z.array(z.string().uuid()).min(1, '请选择至少一个文件'),
    tagId: z.string().uuid(),
  }),
});

// 扫描目录验证
export const scanDirectorySchema = z.object({
  body: z.object({
    directoryPath: z.string()
      .min(1, '目录路径不能为空')
      .max(1000, '路径过长'),
    createRootFolder: z.boolean().default(true),
  }),
});

// 清理和转义 HTML 防止 XSS
export function sanitizeString(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
