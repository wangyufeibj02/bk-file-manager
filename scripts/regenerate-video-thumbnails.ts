/**
 * 脚本：为缺失缩略图的视频文件重新生成缩略图
 */
import { PrismaClient } from '@prisma/client';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置 ffmpeg 路径
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
ffmpeg.setFfprobePath(ffprobeStatic.path);

const prisma = new PrismaClient();
const THUMBNAILS_DIR = path.join(__dirname, '../thumbnails');

// 确保缩略图目录存在
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

interface VideoMetadata {
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  codec: string | null;
  bitrate: number | null;
  fps: number | null;
}

// 解析帧率字符串
function parseFrameRate(frameRate: string | undefined): number | null {
  if (!frameRate) return null;
  if (frameRate.includes('/')) {
    const [num, den] = frameRate.split('/').map(Number);
    if (den === 0) return null;
    return Math.round((num / den) * 100) / 100;
  }
  return parseFloat(frameRate) || null;
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

// 生成视频缩略图
async function generateVideoThumbnail(videoPath: string, fileName: string): Promise<VideoMetadata> {
  const metadata = await getVideoMetadata(videoPath);
  
  return new Promise((resolve) => {
    const thumbnailName = `thumb_${Date.now()}_${path.parse(fileName).name}.jpg`;
    const thumbnailFullPath = path.join(THUMBNAILS_DIR, thumbnailName);
    
    ffmpeg(videoPath)
      .on('end', () => {
        console.log(`  ✓ 缩略图已生成: ${thumbnailName}`);
        resolve({
          ...metadata,
          thumbnailPath: `/thumbnails/${thumbnailName}`,
        });
      })
      .on('error', (err) => {
        console.error(`  ✗ 缩略图生成失败: ${err.message}`);
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

async function main() {
  console.log('=== 视频缩略图重新生成脚本 ===\n');
  
  // 获取所有没有缩略图的视频文件
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts', '.mts'];
  const videoExtensionsUpper = videoExtensions.map(ext => ext.toUpperCase());
  
  const videoFiles = await prisma.file.findMany({
    where: {
      AND: [
        {
          OR: [
            { mimeType: { startsWith: 'video/' } },
            { mimeType: { equals: 'application/octet-stream' } }, // 某些 .mov 文件可能被识别为这个
            ...videoExtensions.map(ext => ({ path: { endsWith: ext } })),
            ...videoExtensionsUpper.map(ext => ({ path: { endsWith: ext } })),
          ],
        },
        { thumbnailPath: null },
      ],
    },
    take: 100, // 每次处理 100 个
    orderBy: { createdAt: 'desc' },
  });
  
  console.log(`找到 ${videoFiles.length} 个缺少缩略图的视频文件\n`);
  
  if (videoFiles.length === 0) {
    console.log('没有需要处理的视频文件');
    await prisma.$disconnect();
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    console.log(`[${i + 1}/${videoFiles.length}] 处理: ${file.originalName}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(file.path)) {
      console.log(`  ✗ 文件不存在: ${file.path}`);
      failed++;
      continue;
    }
    
    try {
      const result = await generateVideoThumbnail(file.path, file.originalName);
      
      // 更新数据库
      await prisma.file.update({
        where: { id: file.id },
        data: {
          thumbnailPath: result.thumbnailPath,
          width: result.width,
          height: result.height,
          duration: result.duration,
          codec: result.codec,
          bitrate: result.bitrate,
          fps: result.fps,
        },
      });
      
      if (result.thumbnailPath) {
        success++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ 处理失败:`, err);
      failed++;
    }
    
    // 添加小延迟避免系统过载
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n=== 处理完成 ===`);
  console.log(`成功: ${success}`);
  console.log(`失败: ${failed}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
