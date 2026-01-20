/**
 * Convert file path to a URL that can be loaded in the browser
 * - For uploaded files: /uploads/xxx or /thumbnails/xxx
 * - For local files: /local-file?path=xxx (absolute paths like D:\xxx)
 */
export function getFileUrl(filePath: string | null): string {
  if (!filePath) return '';
  
  // If it's already a relative URL (starts with /), use as-is
  if (filePath.startsWith('/uploads') || filePath.startsWith('/thumbnails')) {
    return filePath;
  }
  
  // If it's an absolute path (Windows or Unix), use local-file API
  if (filePath.match(/^[A-Za-z]:/) || filePath.startsWith('/')) {
    return `/local-file?path=${encodeURIComponent(filePath)}`;
  }
  
  return filePath;
}

/**
 * Get thumbnail URL for a file
 */
export function getThumbnailUrl(file: { thumbnailPath: string | null; path: string; mimeType: string; originalName?: string }): string {
  // If there's a thumbnail, use it
  if (file.thumbnailPath) {
    return getFileUrl(file.thumbnailPath);
  }
  
  // Check file extension for formats that can't be displayed directly
  const ext = (file.originalName || file.path).split('.').pop()?.toLowerCase() || '';
  const nonDisplayableFormats = ['psd', 'psb', 'ai', 'eps', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2', 'raf', 'pef', 'srw', 'tif', 'tiff', 'bmp', 'ico', 'webp'];
  
  // For images that browser can't display, return empty (will show icon)
  if (nonDisplayableFormats.includes(ext)) {
    return '';
  }
  
  // For regular images without thumbnails, use the original
  if (file.mimeType.startsWith('image/')) {
    return getFileUrl(file.path);
  }
  
  // For other types, return empty (will show icon)
  return '';
}
