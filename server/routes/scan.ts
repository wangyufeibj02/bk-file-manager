import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../lib/auth.js';
import { validate, scanDirectorySchema } from '../lib/validation.js';
import { clearFolderCache } from './files.js';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import mime from 'mime-types';
import { processImage } from '../lib/imageProcessor.js';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// Configure ffmpeg paths
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
ffmpeg.setFfprobePath(ffprobeStatic.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THUMBNAILS_DIR = path.join(__dirname, '../../thumbnails');

// ============= 性能优化：并行处理限制器 =============
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  
  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await fn(items[currentIndex]);
      } catch (err) {
        results[currentIndex] = undefined as R;
      }
    }
  }
  
  const workers = Array(Math.min(limit, items.length)).fill(null).map(() => worker());
  await Promise.all(workers);
  return results;
}

// ============= 缩略图生成队列（后台处理）=============
interface ThumbnailTask {
  fileId: string;
  filePath: string;
  fileName: string;
  fileType: 'image' | 'video' | 'psd' | 'raw';
}

const thumbnailQueue: ThumbnailTask[] = [];
let isProcessingThumbnails = false;

async function processThumbnailQueue(): Promise<void> {
  if (isProcessingThumbnails || thumbnailQueue.length === 0) return;
  
  isProcessingThumbnails = true;
  console.log(`[ThumbnailQueue] Starting to process ${thumbnailQueue.length} tasks`);
  
  while (thumbnailQueue.length > 0) {
    const batch = thumbnailQueue.splice(0, 2); // 每次处理2个（减少SQLite并发压力）
    
    await parallelLimit(batch, 1, async (task) => { // 串行处理，避免数据库锁定
      try {
        let thumbnailPath: string | null = null;
        let width: number | null = null;
        let height: number | null = null;
        let dominantColor: string | null = null;
        let palette: string | null = null;
        let duration: number | null = null;
        let codec: string | null = null;
        let bitrate: number | null = null;
        let fps: number | null = null;
        
        if (task.fileType === 'image') {
          const result = await processImage(task.filePath, task.fileName);
          thumbnailPath = result.thumbnailPath;
          width = result.metadata.width;
          height = result.metadata.height;
          dominantColor = result.metadata.dominantColor;
          palette = JSON.stringify(result.metadata.palette);
        } else if (task.fileType === 'video') {
          const videoMeta = await generateVideoThumbnail(task.filePath, task.fileName);
          thumbnailPath = videoMeta.thumbnailPath;
          width = videoMeta.width;
          height = videoMeta.height;
          duration = videoMeta.duration;
          codec = videoMeta.codec;
          bitrate = videoMeta.bitrate;
          fps = videoMeta.fps;
        } else if (task.fileType === 'psd') {
          thumbnailPath = await generatePsdThumbnail(task.filePath, task.fileName);
        } else if (task.fileType === 'raw') {
          thumbnailPath = await generateRawThumbnail(task.filePath, task.fileName);
        }
        
        // 更新数据库
        await prisma.file.update({
          where: { id: task.fileId },
          data: {
            thumbnailPath,
            width,
            height,
            dominantColor,
            palette,
            duration,
            codec,
            bitrate,
            fps,
          },
        });
      } catch (err) {
        console.error(`[ThumbnailQueue] Error processing ${task.fileName}:`, err);
      }
    });
  }
  
  isProcessingThumbnails = false;
  console.log('[ThumbnailQueue] Queue processing complete');
}

function addToThumbnailQueue(task: ThumbnailTask): void {
  thumbnailQueue.push(task);
  // 异步启动队列处理（不阻塞）
  setImmediate(() => processThumbnailQueue());
}

const router = Router();

// 所有扫描路由都需要认证
router.use(authMiddleware);

// Ensure thumbnails directory exists
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// 视频元数据接口
interface VideoMetadata {
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  codec: string | null;
  bitrate: number | null;
  fps: number | null;
}

// 解析帧率字符串 (如 "30000/1001" 或 "30")
function parseFrameRate(frameRate: string | undefined): number | null {
  if (!frameRate) return null;
  if (frameRate.includes('/')) {
    const [num, den] = frameRate.split('/').map(Number);
    if (den === 0) return null;
    return Math.round((num / den) * 100) / 100; // 保留两位小数
  }
  const parsed = parseFloat(frameRate);
  return isNaN(parsed) ? null : parsed;
}

// 获取视频元数据
async function getVideoMetadata(videoPath: string): Promise<Omit<VideoMetadata, 'thumbnailPath'>> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('FFprobe error:', err.message);
        resolve({ width: null, height: null, duration: null, codec: null, bitrate: null, fps: null });
        return;
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      
      // 解析帧率 - 优先使用 avg_frame_rate，其次 r_frame_rate
      const fpsStr = videoStream?.avg_frame_rate || videoStream?.r_frame_rate;
      const fps = parseFrameRate(fpsStr);
      
      resolve({
        width: videoStream?.width || null,
        height: videoStream?.height || null,
        duration: metadata.format?.duration || null,
        codec: videoStream?.codec_name || null,
        bitrate: metadata.format?.bit_rate ? parseInt(String(metadata.format.bit_rate)) : null,
        fps,
      });
    });
  });
}

// Generate video thumbnail and extract metadata using ffmpeg
async function generateVideoThumbnail(videoPath: string, fileName: string): Promise<VideoMetadata> {
  const metadata = await getVideoMetadata(videoPath);
  
  return new Promise((resolve) => {
    const thumbnailName = `thumb_${Date.now()}_${path.parse(fileName).name}.jpg`;
    const thumbnailFullPath = path.join(THUMBNAILS_DIR, thumbnailName);
    
    ffmpeg(videoPath)
      .on('end', () => {
        resolve({
          ...metadata,
          thumbnailPath: `/thumbnails/${thumbnailName}`,
        });
      })
      .on('error', (err) => {
        console.error('Video thumbnail error:', err.message);
        resolve({
          ...metadata,
          thumbnailPath: null,
        });
      })
      .screenshots({
        timestamps: ['00:00:01'],
        filename: thumbnailName,
        folder: THUMBNAILS_DIR,
        size: '320x?'
      });
  });
}

// Generate PSD thumbnail - extract composite image using sharp
async function generatePsdThumbnail(psdPath: string, fileName: string): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const thumbnailName = `thumb_${Date.now()}_${path.parse(fileName).name}.jpg`;
    const thumbnailFullPath = path.join(THUMBNAILS_DIR, thumbnailName);
    
    // Try to extract the composite image from PSD using sharp
    // Sharp can read the flattened composite from PSD files
    await sharp(psdPath, { pages: -1 })
      .resize(320, 320, { fit: 'inside' })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toFile(thumbnailFullPath);
    
    return `/thumbnails/${thumbnailName}`;
  } catch (err) {
    console.error('PSD thumbnail error:', err);
  }
  return null;
}

// Generate RAW thumbnail - extract embedded preview using sharp
async function generateRawThumbnail(rawPath: string, fileName: string): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const thumbnailName = `thumb_${Date.now()}_${path.parse(fileName).name}.jpg`;
    const thumbnailFullPath = path.join(THUMBNAILS_DIR, thumbnailName);
    
    // Sharp with libraw can extract embedded JPEG preview from RAW files
    // Most RAW files contain a full-size JPEG preview
    await sharp(rawPath)
      .resize(320, 320, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toFile(thumbnailFullPath);
    
    return `/thumbnails/${thumbnailName}`;
  } catch (err) {
    console.error('RAW thumbnail error:', err);
  }
  return null;
}

interface ScanResult {
  totalFiles: number;
  folders: number;
  fileTypes: Record<string, number>;
  errors: string[];
}

// 扫描进度回调类型
interface ScanProgress {
  phase: 'counting' | 'scanning' | 'complete';
  currentFile?: string;
  processedFiles: number;
  totalFiles: number;
  processedFolders: number;
  startTime: number;
  fileTypes: Record<string, number>;
  errors: string[];
}

type ProgressCallback = (progress: ScanProgress) => void;

// Get file type category from mime type and extension
function getFileTypeCategory(mimeType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // RAW camera files
  const rawExtensions = ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'dng', 'orf', 'rw2', 'raf', 'pef', 'srw', 'raw'];
  if (rawExtensions.includes(ext)) return 'RAW照片';
  
  // 3D Models
  if (['obj', 'fbx', 'gltf', 'glb', 'stl', '3ds', 'dae', 'ply', 'blend', 'abc', 'ma', 'mb'].includes(ext)) return '3D模型';
  
  // Design files
  if (ext === 'psd' || mimeType.includes('photoshop')) return 'PSD设计';
  if (ext === 'ai') return 'AI矢量';
  if (ext === 'sketch') return 'Sketch';
  if (ext === 'xd') return 'Adobe XD';
  if (ext === 'fig') return 'Figma';
  if (ext === 'aep' || ext === 'aet') return 'AE工程';
  if (ext === 'prproj') return 'PR工程';
  
  // Images
  if (mimeType.startsWith('image/')) return '图片';
  
  // Video
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp'].includes(ext)) return '视频';
  
  // Audio
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'aiff'].includes(ext)) return '音频';
  
  // Documents
  if (mimeType.includes('pdf') || ext === 'pdf') return 'PDF文档';
  if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx'].includes(ext)) return 'Word文档';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || ['xls', 'xlsx'].includes(ext)) return 'Excel表格';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'PPT演示';
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return '压缩包';
  
  // Fonts
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) return '字体';
  
  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'scss', 'html', 'json', 'xml', 'yaml', 'yml', 'md'].includes(ext)) return '代码';
  
  // Text
  if (mimeType.includes('text') || ext === 'txt') return '文本文件';
  
  return '其他';
}

// Get color for file type tag
function getTypeColor(category: string): string {
  const colors: Record<string, string> = {
    '图片': '#22c55e',
    '视频': '#3b82f6',
    '音频': '#a855f7',
    '3D模型': '#06b6d4',
    'RAW照片': '#d97706',
    'PSD设计': '#ec4899',
    'AI矢量': '#f97316',
    'Sketch': '#facc15',
    'Adobe XD': '#ff61f6',
    'Figma': '#a855f7',
    'AE工程': '#9333ea',
    'PR工程': '#7c3aed',
    'PDF文档': '#ef4444',
    'Word文档': '#2563eb',
    'Excel表格': '#16a34a',
    'PPT演示': '#ea580c',
    '压缩包': '#eab308',
    '字体': '#8b5cf6',
    '代码': '#10b981',
    '文本文件': '#6b7280',
    '其他': '#9ca3af',
  };
  return colors[category] || '#6b7280';
}

// 快速统计文件总数（不处理文件）- 使用异步版本
async function countTotalFilesAsync(dirPath: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const promises: Promise<number>[] = [];
    
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        promises.push(countTotalFilesAsync(fullPath));
      } else if (entry.isFile()) {
        count++;
      }
    }
    
    const subCounts = await Promise.all(promises);
    count += subCounts.reduce((a, b) => a + b, 0);
  } catch (err) {
    // 忽略权限错误等
  }
  return count;
}

// 同步版本保留用于兼容
function countTotalFiles(dirPath: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        count += countTotalFiles(fullPath);
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch (err) {
    // 忽略权限错误等
  }
  return count;
}

// ============= 优化：文件信息收集（不处理缩略图）=============
interface FileInfo {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  typeCategory: string;
  birthtime: Date;
  mtime: Date;
  relativePath: string;
}

interface FolderInfo {
  name: string;
  relativePath: string;
  parentPath: string;
}

// 快速收集所有文件和文件夹信息（异步并行）
async function collectFilesAsync(
  dirPath: string,
  basePath: string,
  onProgress?: (collected: number) => void
): Promise<{ files: FileInfo[]; folders: FolderInfo[] }> {
  const files: FileInfo[] = [];
  const folders: FolderInfo[] = [];
  let collectedCount = 0;
  
  async function scanDir(currentPath: string, relativePath: string): Promise<void> {
    try {
      const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
      
      // 分离文件和文件夹
      const fileEntries: fs.Dirent[] = [];
      const dirEntries: fs.Dirent[] = [];
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        if (entry.isDirectory()) {
          dirEntries.push(entry);
        } else if (entry.isFile()) {
          fileEntries.push(entry);
        }
      }
      
      // 记录文件夹
      for (const dir of dirEntries) {
        folders.push({
          name: dir.name,
          relativePath: path.join(relativePath, dir.name),
          parentPath: relativePath,
        });
      }
      
      // 并行获取文件信息（限制并发）
      await parallelLimit(fileEntries, 20, async (entry) => {
        const fullPath = path.join(currentPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        try {
          const stats = await fsPromises.stat(fullPath);
          const mimeType = mime.lookup(entry.name) || 'application/octet-stream';
          const typeCategory = getFileTypeCategory(mimeType, entry.name);
          
          files.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            mimeType,
            typeCategory,
            birthtime: stats.birthtime,
            mtime: stats.mtime,
            relativePath: relPath,
          });
          
          collectedCount++;
          if (onProgress && collectedCount % 100 === 0) {
            onProgress(collectedCount);
          }
        } catch (err) {
          // 忽略无法访问的文件
        }
      });
      
      // 并行扫描子目录
      await parallelLimit(dirEntries, 5, async (dir) => {
        const fullPath = path.join(currentPath, dir.name);
        const relPath = path.join(relativePath, dir.name);
        await scanDir(fullPath, relPath);
      });
      
    } catch (err) {
      // 忽略无法访问的目录
    }
  }
  
  await scanDir(dirPath, '');
  return { files, folders };
}

// ============= 优化：批量插入数据库 =============
async function batchInsertFolders(
  folders: FolderInfo[],
  rootFolderId: string | null,
  onProgress?: (inserted: number) => void
): Promise<Map<string, string>> {
  const folderIdMap = new Map<string, string>(); // relativePath -> folderId
  folderIdMap.set('', rootFolderId || ''); // 根目录
  
  // 按层级排序（确保父文件夹先创建）
  folders.sort((a, b) => {
    const depthA = a.relativePath.split(path.sep).length;
    const depthB = b.relativePath.split(path.sep).length;
    return depthA - depthB;
  });
  
  let insertedCount = 0;
  
  // 分批插入文件夹
  const BATCH_SIZE = 50;
  for (let i = 0; i < folders.length; i += BATCH_SIZE) {
    const batch = folders.slice(i, i + BATCH_SIZE);
    
    // 由于文件夹有父子关系，需要逐个创建
    for (const folder of batch) {
      const parentId = folderIdMap.get(folder.parentPath) || null;
      
      try {
        const created = await prisma.folder.create({
          data: {
            name: folder.name,
            parentId: parentId === '' ? null : parentId,
            color: '#4a9eff',
          },
        });
        folderIdMap.set(folder.relativePath, created.id);
        insertedCount++;
        
        if (onProgress && insertedCount % 20 === 0) {
          onProgress(insertedCount);
        }
      } catch (err) {
        console.error('Failed to create folder:', folder.name, err);
      }
    }
  }
  
  return folderIdMap;
}

async function batchInsertFiles(
  files: FileInfo[],
  folderIdMap: Map<string, string>,
  typeTagsCache: Map<string, string>,
  onProgress?: (inserted: number, current: string) => void
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let insertedCount = 0;
  
  // 预先获取/创建所有需要的标签
  const categories = [...new Set(files.map(f => f.typeCategory))];
  for (const category of categories) {
    if (!typeTagsCache.has(category)) {
      try {
        let tag = await prisma.tag.findUnique({ where: { name: category } });
        if (!tag) {
          tag = await prisma.tag.create({
            data: { name: category, color: getTypeColor(category) },
          });
        }
        typeTagsCache.set(category, tag.id);
      } catch (err) {
        console.error('Failed to create tag:', category, err);
      }
    }
  }
  
  // 批量检查已存在的文件
  const existingPaths = new Set<string>();
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const paths = batch.map(f => f.path);
    
    const existing = await prisma.file.findMany({
      where: { path: { in: paths } },
      select: { path: true },
    });
    
    existing.forEach(f => existingPaths.add(f.path));
  }
  
  // 过滤掉已存在的文件
  const newFiles = files.filter(f => !existingPaths.has(f.path));
  console.log(`[Scan] Skipping ${files.length - newFiles.length} existing files`);
  
  // 分批插入新文件
  for (let i = 0; i < newFiles.length; i += BATCH_SIZE) {
    const batch = newFiles.slice(i, i + BATCH_SIZE);
    
    // 使用事务批量插入
    try {
      await prisma.$transaction(async (tx) => {
        for (const file of batch) {
          const folderPath = path.dirname(file.relativePath);
          const folderId = folderIdMap.get(folderPath);
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          
          // 创建文件记录（不包含缩略图）
          const createdFile = await tx.file.create({
            data: {
              name: file.name,
              originalName: file.name,
              path: file.path,
              thumbnailPath: null, // 稍后异步生成
              mimeType: file.mimeType,
              size: file.size,
              folderId: folderId === '' ? null : folderId || null,
              fileCreatedAt: file.birthtime,
              fileModifiedAt: file.mtime,
            },
          });
          
          // 添加标签关联
          const tagId = typeTagsCache.get(file.typeCategory);
          if (tagId) {
            await tx.fileTag.create({
              data: { fileId: createdFile.id, tagId },
            });
          }
          
          // 将缩略图生成任务加入队列
          const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'mts'];
          const rawExtensions = ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'dng', 'orf', 'rw2', 'raf', 'pef', 'srw', 'raw'];
          
          let fileType: ThumbnailTask['fileType'] | null = null;
          if (file.mimeType.startsWith('image/') && ext !== 'psd') {
            fileType = 'image';
          } else if (file.mimeType.startsWith('video/') || videoExtensions.includes(ext)) {
            fileType = 'video';
          } else if (ext === 'psd' || file.mimeType.includes('photoshop')) {
            fileType = 'psd';
          } else if (rawExtensions.includes(ext)) {
            fileType = 'raw';
          }
          
          if (fileType) {
            addToThumbnailQueue({
              fileId: createdFile.id,
              filePath: file.path,
              fileName: file.name,
              fileType,
            });
          }
          
          insertedCount++;
        }
      });
      
      if (onProgress) {
        const lastFile = batch[batch.length - 1];
        onProgress(insertedCount, lastFile?.name || '');
      }
    } catch (err) {
      console.error('Batch insert error:', err);
      errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  return { inserted: insertedCount, errors };
}

// Recursively scan directory with progress callback
async function scanDirectory(
  dirPath: string,
  parentFolderId: string | null,
  result: ScanResult,
  typeTagsCache: Map<string, string>,
  progress?: { current: ScanProgress; callback?: ProgressCallback }
): Promise<void> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    try {
      if (entry.isDirectory()) {
        // Skip hidden folders and system folders
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        // Create folder in database
        const folder = await prisma.folder.create({
          data: {
            name: entry.name,
            parentId: parentFolderId,
            color: '#4a9eff',
          },
        });
        result.folders++;
        
        // 更新进度 - 文件夹
        if (progress) {
          progress.current.processedFolders = result.folders;
          progress.callback?.(progress.current);
        }
        
        // Recursively scan subfolder
        await scanDirectory(fullPath, folder.id, result, typeTagsCache, progress);
        
      } else if (entry.isFile()) {
        // Skip hidden files
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        const stats = fs.statSync(fullPath);
        const mimeType = mime.lookup(entry.name) || 'application/octet-stream';
        const typeCategory = getFileTypeCategory(mimeType, entry.name);
        
        // Get or create file type tag
        let typeTagId = typeTagsCache.get(typeCategory);
        if (!typeTagId) {
          const existingTag = await prisma.tag.findUnique({
            where: { name: typeCategory },
          });
          if (existingTag) {
            typeTagId = existingTag.id;
          } else {
            const newTag = await prisma.tag.create({
              data: {
                name: typeCategory,
                color: getTypeColor(typeCategory),
              },
            });
            typeTagId = newTag.id;
          }
          typeTagsCache.set(typeCategory, typeTagId);
        }
        
        // Check if file already exists in database
        const existingFile = await prisma.file.findFirst({
          where: { path: fullPath },
        });
        
        if (existingFile) {
          // Skip already indexed files
          continue;
        }
        
        // Get file metadata and generate thumbnails
        let width = null;
        let height = null;
        let dominantColor = null;
        let palette = null;
        let thumbnailPath = null;
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        
        // Process images
        if (mimeType.startsWith('image/') && ext !== 'psd') {
          try {
            const imageResult = await processImage(fullPath, entry.name);
            width = imageResult.metadata.width;
            height = imageResult.metadata.height;
            dominantColor = imageResult.metadata.dominantColor;
            palette = JSON.stringify(imageResult.metadata.palette);
            thumbnailPath = imageResult.thumbnailPath;
          } catch (err) {
            console.error('Image processing failed for:', fullPath, err);
          }
        }
        
        // Process videos (including MOV) - extract metadata and thumbnail
        let duration: number | null = null;
        let codec: string | null = null;
        let bitrate: number | null = null;
        let fps: number | null = null;
        const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'mts'];
        if (mimeType.startsWith('video/') || videoExtensions.includes(ext)) {
          try {
            const videoMeta = await generateVideoThumbnail(fullPath, entry.name);
            thumbnailPath = videoMeta.thumbnailPath;
            width = videoMeta.width;
            height = videoMeta.height;
            duration = videoMeta.duration;
            codec = videoMeta.codec;
            bitrate = videoMeta.bitrate;
            fps = videoMeta.fps;
          } catch (err) {
            console.error('Video processing failed for:', fullPath, err);
          }
        }
        
        // Process PSD files
        if (ext === 'psd' || mimeType.includes('photoshop')) {
          try {
            thumbnailPath = await generatePsdThumbnail(fullPath, entry.name);
          } catch (err) {
            console.error('PSD thumbnail failed for:', fullPath, err);
          }
        }
        
        // Process RAW files (camera raw formats)
        const rawExtensions = ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'dng', 'orf', 'rw2', 'raf', 'pef', 'srw', 'raw'];
        if (rawExtensions.includes(ext)) {
          try {
            thumbnailPath = await generateRawThumbnail(fullPath, entry.name);
          } catch (err) {
            console.error('RAW thumbnail failed for:', fullPath, err);
          }
        }
        
        // Create file record
        const file = await prisma.file.create({
          data: {
            name: entry.name,
            originalName: entry.name,
            path: fullPath, // Use absolute path
            thumbnailPath,
            mimeType,
            size: stats.size,
            width,
            height,
            duration,
            dominantColor,
            palette,
            folderId: parentFolderId,
            fileCreatedAt: stats.birthtime,
            fileModifiedAt: stats.mtime,
            // 视频元数据
            codec,
            bitrate,
            fps,
          },
        });
        
        // Add file type tag
        await prisma.fileTag.create({
          data: {
            fileId: file.id,
            tagId: typeTagId,
          },
        });
        
        result.totalFiles++;
        result.fileTypes[typeCategory] = (result.fileTypes[typeCategory] || 0) + 1;
        
        // 更新进度 - 文件处理完成
        if (progress) {
          progress.current.processedFiles = result.totalFiles;
          progress.current.currentFile = entry.name;
          progress.current.fileTypes = { ...result.fileTypes };
          progress.callback?.(progress.current);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${fullPath}: ${errorMsg}`);
      console.error('Error processing:', fullPath, err);
      
      // 更新进度 - 错误
      if (progress) {
        progress.current.errors = [...result.errors];
        progress.callback?.(progress.current);
      }
    }
  }
}

// Scan a directory and import files
router.post('/directory', async (req, res) => {
  try {
    const { directoryPath, createRootFolder } = req.body;
    
    if (!directoryPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }
    
    // Normalize path
    const normalizedPath = path.normalize(directoryPath);
    
    // Check if directory exists
    if (!fs.existsSync(normalizedPath)) {
      return res.status(400).json({ error: 'Directory does not exist' });
    }
    
    if (!fs.statSync(normalizedPath).isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    const result: ScanResult = {
      totalFiles: 0,
      folders: 0,
      fileTypes: {},
      errors: [],
    };
    
    const typeTagsCache = new Map<string, string>();
    
    // Optionally create a root folder for this scan
    let rootFolderId: string | null = null;
    if (createRootFolder) {
      const folderName = path.basename(normalizedPath);
      const rootFolder = await prisma.folder.create({
        data: {
          name: folderName,
          color: '#8b5cf6',
        },
      });
      rootFolderId = rootFolder.id;
      result.folders++;
    }
    
    // Start scanning
    await scanDirectory(normalizedPath, rootFolderId, result, typeTagsCache);
    
    res.json({
      success: true,
      message: `Scan complete. Found ${result.totalFiles} files in ${result.folders} folders.`,
      result,
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      error: 'Failed to scan directory',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// 带实时进度的扫描 (SSE) - 优化版本
router.get('/directory-sse', async (req: AuthRequest, res) => {
  const directoryPath = req.query.path as string;
  const createRootFolder = req.query.createRootFolder === 'true';
  
  if (!directoryPath) {
    return res.status(400).json({ error: 'Directory path is required' });
  }
  
  const normalizedPath = path.normalize(directoryPath);
  
  if (!fs.existsSync(normalizedPath)) {
    return res.status(400).json({ error: 'Directory does not exist' });
  }
  
  if (!fs.statSync(normalizedPath).isDirectory()) {
    return res.status(400).json({ error: 'Path is not a directory' });
  }
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
  res.flushHeaders();
  
  // 发送 SSE 消息的辅助函数
  const sendProgress = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    const startTime = Date.now();
    const typeTagsCache = new Map<string, string>();
    
    // ========== 阶段1：快速收集文件信息（并行异步）==========
    sendProgress({ phase: 'collecting', message: '正在快速扫描文件结构...' });
    
    let collectedCount = 0;
    const { files, folders } = await collectFilesAsync(normalizedPath, normalizedPath, (count) => {
      collectedCount = count;
      sendProgress({
        phase: 'collecting',
        collected: count,
        message: `已扫描 ${count} 个文件...`,
      });
    });
    
    const totalFiles = files.length;
    const totalFolders = folders.length;
    
    sendProgress({
      phase: 'collecting',
      collected: totalFiles,
      totalFolders,
      message: `扫描完成：${totalFiles} 个文件，${totalFolders} 个文件夹`,
    });
    
    // 统计文件类型
    const fileTypes: Record<string, number> = {};
    for (const file of files) {
      fileTypes[file.typeCategory] = (fileTypes[file.typeCategory] || 0) + 1;
    }
    
    // ========== 阶段2：创建根文件夹 ==========
    let rootFolderId: string | null = null;
    if (createRootFolder) {
      const folderName = path.basename(normalizedPath);
      const rootFolder = await prisma.folder.create({
        data: {
          name: folderName,
          color: '#8b5cf6',
        },
      });
      rootFolderId = rootFolder.id;
    }
    
    // ========== 阶段3：批量插入文件夹 ==========
    sendProgress({ phase: 'folders', message: '正在创建文件夹结构...', total: totalFolders });
    
    const folderIdMap = await batchInsertFolders(folders, rootFolderId, (inserted) => {
      sendProgress({
        phase: 'folders',
        inserted,
        total: totalFolders,
        progress: Math.round((inserted / totalFolders) * 100),
        message: `已创建 ${inserted}/${totalFolders} 个文件夹`,
      });
    });
    
    // ========== 阶段4：批量插入文件 ==========
    sendProgress({ phase: 'files', message: '正在导入文件...', total: totalFiles });
    
    const { inserted, errors } = await batchInsertFiles(
      files,
      folderIdMap,
      typeTagsCache,
      (insertedCount, currentFile) => {
        const now = Date.now();
        const elapsed = now - startTime;
        const speed = insertedCount > 0 ? (insertedCount / elapsed) * 1000 : 0;
        const remaining = speed > 0 ? (totalFiles - insertedCount) / speed : 0;
        
        sendProgress({
          phase: 'files',
          currentFile,
          processedFiles: insertedCount,
          totalFiles,
          progress: Math.round((insertedCount / totalFiles) * 100),
          speed: Math.round(speed * 10) / 10,
          elapsedTime: elapsed,
          remainingTime: Math.round(remaining * 1000),
          fileTypes,
        });
      }
    );
    
    // ========== 完成 ==========
    // 清除文件夹缓存（新扫描后需要刷新）
    clearFolderCache();
    
    const elapsedTime = Date.now() - startTime;
    sendProgress({
      phase: 'complete',
      success: true,
      message: `扫描完成！共导入 ${inserted} 个文件，创建 ${folderIdMap.size} 个文件夹（缩略图将在后台生成）`,
      result: {
        totalFiles: inserted,
        folders: folderIdMap.size,
        fileTypes,
        errors,
        thumbnailsPending: thumbnailQueue.length,
      },
      elapsedTime,
    });
    
  } catch (error) {
    console.error('Scan SSE error:', error);
    sendProgress({
      phase: 'complete',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    res.end();
  }
});

// Get scan preview (list files without importing)
router.post('/preview', async (req, res) => {
  try {
    const { directoryPath } = req.body;
    
    if (!directoryPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }
    
    const normalizedPath = path.normalize(directoryPath);
    
    if (!fs.existsSync(normalizedPath)) {
      return res.status(400).json({ error: 'Directory does not exist' });
    }
    
    if (!fs.statSync(normalizedPath).isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    const preview = {
      path: normalizedPath,
      name: path.basename(normalizedPath),
      totalFiles: 0,
      totalFolders: 0,
      fileTypes: {} as Record<string, number>,
      sampleFiles: [] as { name: string; type: string; size: number; folder: string }[],
    };
    
    function countFiles(dirPath: string, relativePath: string = '') {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          preview.totalFolders++;
          countFiles(fullPath, relPath);
        } else if (entry.isFile()) {
          const mimeType = mime.lookup(entry.name) || 'application/octet-stream';
          const category = getFileTypeCategory(mimeType, entry.name);
          preview.totalFiles++;
          preview.fileTypes[category] = (preview.fileTypes[category] || 0) + 1;
          
          // Collect sample files (first 20)
          if (preview.sampleFiles.length < 20) {
            const stats = fs.statSync(fullPath);
            preview.sampleFiles.push({
              name: entry.name,
              type: category,
              size: stats.size,
              folder: relativePath || '根目录',
            });
          }
        }
      }
    }
    
    countFiles(normalizedPath);
    
    res.json(preview);
    
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      error: 'Failed to preview directory',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as scanRoutes };
