import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../lib/auth.js';
import { validate, scanDirectorySchema } from '../lib/validation.js';
import path from 'path';
import fs from 'fs';
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

// Recursively scan directory
async function scanDirectory(
  dirPath: string,
  parentFolderId: string | null,
  result: ScanResult,
  typeTagsCache: Map<string, string>
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
        
        // Recursively scan subfolder
        await scanDirectory(fullPath, folder.id, result, typeTagsCache);
        
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
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${fullPath}: ${errorMsg}`);
      console.error('Error processing:', fullPath, err);
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
