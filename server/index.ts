import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { folderRoutes } from './routes/folders.js';
import { fileRoutes } from './routes/files.js';
import { tagRoutes } from './routes/tags.js';
import { scanRoutes } from './routes/scan.js';
import { authRoutes } from './routes/auth.js';
import historyRoutes from './routes/history.js';
import { optionalAuthMiddleware } from './lib/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 中间件
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/thumbnails', express.static(path.join(__dirname, '../thumbnails')));

// 本地文件服务（可选认证）
app.get('/local-file', optionalAuthMiddleware, (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: '路径必填' });
  }
  
  // 安全检查：规范化路径并防止路径遍历
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes('..')) {
    return res.status(400).json({ error: '无效的路径' });
  }
  
  // 检查文件是否存在
  if (!fs.existsSync(normalizedPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  // 设置正确的 MIME 类型
  const ext = path.extname(normalizedPath).toLowerCase();
  let mimeType = mime.lookup(normalizedPath) || 'application/octet-stream';
  
  // 修复常见的 MIME 类型问题
  const mimeOverrides: Record<string, string> = {
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.psd': 'image/vnd.adobe.photoshop',
    '.ai': 'application/postscript',
    '.apng': 'image/apng',
  };
  
  if (mimeOverrides[ext]) {
    mimeType = mimeOverrides[ext];
  }
  
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(normalizedPath);
});

// API 路由
app.use('/api/auth', authRoutes);  // 认证路由（部分公开）
app.use('/api/folders', folderRoutes);  // 需要认证
app.use('/api/files', fileRoutes);  // 需要认证
app.use('/api/tags', tagRoutes);  // 需要认证
app.use('/api/scan', scanRoutes);  // 需要认证
app.use('/api/history', historyRoutes);  // 需要认证

// 健康检查（公开）
app.get('/api/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.26',
  });
});

// 全局错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR',
    ...(config.nodeEnv === 'development' && { details: err.message }),
  });
});

// 404 处理
app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在', code: 'NOT_FOUND' });
});

// 启动服务器
app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 百科交互文件管理系统 v2.0.26                     ║
║                                                       ║
║   服务器地址: http://localhost:${config.port}                  ║
║   环境: ${config.nodeEnv.padEnd(45)}║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
