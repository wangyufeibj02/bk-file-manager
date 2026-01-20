import sharp from 'sharp';
import path from 'path';
import { thumbnailsDir } from './upload.js';

interface ImageMetadata {
  width: number;
  height: number;
  dominantColor: string;
  palette: string[];
}

export async function processImage(filePath: string, filename: string): Promise<{
  thumbnailPath: string;
  metadata: ImageMetadata;
}> {
  const thumbnailName = `thumb_${filename}`;
  const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

  try {
    // Generate thumbnail
    const image = sharp(filePath);
    const metadata = await image.metadata();

    await image
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath.replace(/\.[^.]+$/, '.jpg'));

    // Extract dominant color using sharp stats
    const { dominant } = await sharp(filePath)
      .resize(50, 50, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(async ({ data, info }) => {
        const pixels: { r: number; g: number; b: number }[] = [];
        for (let i = 0; i < data.length; i += info.channels) {
          pixels.push({
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
          });
        }
        
        // Simple average color calculation
        const avgR = Math.round(pixels.reduce((sum, p) => sum + p.r, 0) / pixels.length);
        const avgG = Math.round(pixels.reduce((sum, p) => sum + p.g, 0) / pixels.length);
        const avgB = Math.round(pixels.reduce((sum, p) => sum + p.b, 0) / pixels.length);
        
        return {
          dominant: `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`,
        };
      });

    // Generate a simple palette (simplified version)
    const palette = await generateColorPalette(filePath);

    return {
      thumbnailPath: `/thumbnails/${thumbnailName.replace(/\.[^.]+$/, '.jpg')}`,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        dominantColor: dominant,
        palette,
      },
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      thumbnailPath: '',
      metadata: {
        width: 0,
        height: 0,
        dominantColor: '#888888',
        palette: [],
      },
    };
  }
}

async function generateColorPalette(filePath: string): Promise<string[]> {
  try {
    const { data, info } = await sharp(filePath)
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colorMap = new Map<string, number>();
    
    for (let i = 0; i < data.length; i += info.channels) {
      // Quantize colors to reduce variations
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
    }

    // Sort by frequency and take top 5
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => color);

    return sortedColors;
  } catch {
    return [];
  }
}

export async function getVideoThumbnail(filePath: string, filename: string): Promise<string> {
  // For video files, we'd need ffmpeg - returning placeholder for now
  const thumbnailName = `thumb_${filename}.jpg`;
  return `/thumbnails/${thumbnailName}`;
}
