import { useState, useEffect, useCallback } from 'react';
import { 
  FiX, 
  FiChevronLeft, 
  FiChevronRight, 
  FiStar, 
  FiTag,
  FiDownload,
  FiTrash2,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiShare2
} from 'react-icons/fi';
import { FileItem, Tag } from '../types';
import { getFileUrl } from '../utils/filePath';
import { PdfPreview } from './previews/PdfPreview';
import { PsdPreview } from './previews/PsdPreview';
import { OfficePreview } from './previews/OfficePreview';
import { VideoPreview } from './previews/VideoPreview';
import { ThreeDPreview } from './previews/ThreeDPreview';
import { TextPreview } from './previews/TextPreview';

interface FilePreviewProps {
  file: FileItem;
  files: FileItem[];
  onClose: () => void;
  onNavigate: (file: FileItem) => void;
  onRateFile: (fileId: string, rating: number) => void;
  onRenameFile?: (fileId: string, newName: string) => void;
  tags: Tag[];
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onShare?: (fileId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN');
}

function getFileType(mimeType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // 3D models - comprehensive list
  if (['obj', 'fbx', 'gltf', 'glb', 'stl', '3ds', 'dae', 'ply', 'abc', 'usd', 'usda', 'usdc', 'usdz'].includes(ext)) return '3d';
  
  // Text/code files - preview as text
  if (['txt', 'json', 'xml', 'md', 'csv', 'html', 'css', 'js', 'ts', 'py', 'yml', 'yaml', 'ini', 'log', 'rtf'].includes(ext)) return 'text';
  
  // RAW camera files
  const rawExtensions = ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'dng', 'orf', 'rw2', 'raf', 'pef', 'srw', 'raw'];
  if (rawExtensions.includes(ext)) return 'raw';
  
  // APNG (animated PNG) - treat as animatedImage
  if (ext === 'apng' || mimeType === 'image/apng') return 'animatedImage';
  
  // Images - including special formats
  if (mimeType.startsWith('image/')) {
    if (ext === 'psd' || mimeType.includes('photoshop')) return 'psd';
    // SVG is viewable as image
    if (ext === 'svg') return 'image';
    // GIF and WebP can be animated
    if (ext === 'gif' || ext === 'webp') return 'animatedImage';
    if (ext === 'ai' && !mimeType.includes('postscript')) return 'ai'; // AI files
    return 'image';
  }
  
  // AI files (Adobe Illustrator)
  if (ext === 'ai') return 'ai';
  
  // Video - all formats including MOV
  if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'mts'].includes(ext)) return 'video';
  
  // Audio
  if (mimeType.startsWith('audio/')) return 'audio';
  
  // PDF
  if (mimeType.includes('pdf') || ext === 'pdf') return 'pdf';
  
  // Office documents
  if (mimeType.includes('word') || mimeType.includes('document') || ext === 'doc' || ext === 'docx') return 'office';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx') return 'office';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || ext === 'ppt' || ext === 'pptx') return 'office';
  
  // Design files (project files)
  if (ext === 'psd') return 'psd';
  if (ext === 'sketch') return 'project';
  if (ext === 'xd') return 'project';
  if (ext === 'fig') return 'project';
  
  // Project files (should open with native app)
  if (['aep', 'aet', 'prproj', 'drp', 'blend', 'c4d', 'max', 'ma', 'mb', 'hip', 'nk'].includes(ext)) return 'project';
  
  // Fonts
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) return 'font';
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  
  return 'other';
}

export function FilePreview({
  file,
  files,
  onClose,
  onNavigate,
  onRateFile,
  onRenameFile,
  tags,
  onAddTag,
  onRemoveTag,
  onShare,
}: FilePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState(file.originalName);

  const currentIndex = files.findIndex(f => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1;

  const fileType = getFileType(file.mimeType, file.originalName);
  const fileUrl = getFileUrl(file.path);

  const navigate = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev' && hasPrev) {
      onNavigate(files[currentIndex - 1]);
    } else if (direction === 'next' && hasNext) {
      onNavigate(files[currentIndex + 1]);
    }
  }, [currentIndex, files, hasPrev, hasNext, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // 视频预览时，箭头键由视频组件处理
      if (fileType !== 'video') {
        if (e.key === 'ArrowLeft') navigate('prev');
        if (e.key === 'ArrowRight') navigate('next');
      }
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
      if (e.key === '0') setZoom(1);
      if (e.key === 'i') setShowInfo(s => !s);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, navigate, fileType]);

  const fileTags = file.tags.map(ft => ft.tag);
  const availableTags = tags.filter(t => !fileTags.some(ft => ft.id === t.id));

  const renderPreviewContent = () => {
    switch (fileType) {
      case 'image':
        return (
          <img
            src={fileUrl}
            alt={file.originalName}
            className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out will-change-transform"
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        );
      
      case 'animatedImage':
        // APNG, GIF, animated WebP - 直接显示动画
        return (
          <div className="relative">
            <img
              src={fileUrl}
              alt={file.originalName}
              className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out will-change-transform"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
            {/* 动图标识 */}
            <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-white flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              动态图片
            </div>
          </div>
        );
      
      case 'psd':
        return <PsdPreview url={fileUrl} fileName={file.originalName} />;
      
      case 'raw':
        // RAW files - show thumbnail if available, or show info
        const rawBrands: Record<string, string> = {
          cr2: 'Canon', cr3: 'Canon', nef: 'Nikon', nrw: 'Nikon',
          arw: 'Sony', dng: 'Adobe DNG', orf: 'Olympus', rw2: 'Panasonic',
          raf: 'Fujifilm', pef: 'Pentax', srw: 'Samsung', raw: 'RAW'
        };
        const rawExt = file.originalName.split('.').pop()?.toLowerCase() || 'raw';
        const brand = rawBrands[rawExt] || 'Camera RAW';
        
        return (
          <div className="flex flex-col items-center justify-center h-full">
            {file.thumbnailPath ? (
              <img
                src={getFileUrl(file.thumbnailPath)}
                alt={file.originalName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg mb-4"
                style={{ transform: `scale(${zoom})` }}
              />
            ) : (
              <div className="w-32 h-32 mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <span className="text-4xl">📷</span>
              </div>
            )}
            <p className="text-xl text-white mb-2">{file.originalName}</p>
            <p className="text-gray-400 mb-2">{brand} RAW 格式</p>
            {file.width && file.height && (
              <p className="text-gray-500 text-sm mb-4">{file.width} × {file.height} px</p>
            )}
            <a
              href={fileUrl}
              download={file.originalName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
            >
              <FiDownload size={18} />
              下载原始文件
            </a>
          </div>
        );
      
      case 'video':
        return (
          <VideoPreview 
            url={fileUrl} 
            mimeType={file.mimeType} 
            fileName={file.originalName}
            thumbnailUrl={file.thumbnailPath ? getFileUrl(file.thumbnailPath) : undefined}
            width={file.width}
            height={file.height}
            duration={file.duration}
            codec={file.codec}
            bitrate={file.bitrate}
            fps={file.fps}
            fileSize={file.size}
          />
        );
      
      case 'audio':
        return (
          <div className="text-center">
            <div className="w-48 h-48 mx-auto mb-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
              <div className="w-32 h-32 rounded-full bg-black/30 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-white" />
              </div>
            </div>
            <p className="text-white text-lg mb-4">{file.originalName}</p>
            <audio src={fileUrl} controls autoPlay className="w-full max-w-md mx-auto" />
          </div>
        );
      
      case 'pdf':
        return <PdfPreview url={fileUrl} />;
      
      case 'office':
        return (
          <OfficePreview 
            url={fileUrl} 
            fileName={file.originalName} 
            mimeType={file.mimeType}
            fileSize={file.size}
          />
        );
      
      case '3d':
        return <ThreeDPreview url={fileUrl} fileName={file.originalName} />;
      
      case 'text':
        return <TextPreview url={fileUrl} fileName={file.originalName} />;
      
      case 'ai':
        return (
          <div className="text-center text-white">
            <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">Ai</span>
            </div>
            <p className="text-xl mb-2">{file.originalName}</p>
            <p className="text-gray-400 mb-6">Adobe Illustrator 文件</p>
            <p className="text-gray-500 text-sm mb-4">双击可使用本地应用打开</p>
            <a
              href={fileUrl}
              download={file.originalName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
            >
              <FiDownload size={18} />
              下载文件
            </a>
          </div>
        );
      
      case 'project':
        const projectIcons: Record<string, { icon: string; name: string; color: string }> = {
          sketch: { icon: '💎', name: 'Sketch', color: 'from-yellow-500 to-orange-500' },
          xd: { icon: '🎯', name: 'Adobe XD', color: 'from-pink-500 to-purple-500' },
          fig: { icon: '🎨', name: 'Figma', color: 'from-purple-500 to-blue-500' },
          aep: { icon: '🎬', name: 'After Effects', color: 'from-purple-600 to-blue-600' },
          aet: { icon: '🎬', name: 'AE Template', color: 'from-purple-600 to-blue-600' },
          prproj: { icon: '🎞️', name: 'Premiere Pro', color: 'from-purple-500 to-pink-500' },
          drp: { icon: '🎬', name: 'DaVinci Resolve', color: 'from-orange-500 to-red-500' },
          blend: { icon: '🧊', name: 'Blender', color: 'from-orange-400 to-yellow-500' },
          c4d: { icon: '🎨', name: 'Cinema 4D', color: 'from-blue-500 to-cyan-500' },
          max: { icon: '🏗️', name: '3ds Max', color: 'from-teal-500 to-blue-500' },
          ma: { icon: '🌀', name: 'Maya ASCII', color: 'from-cyan-500 to-blue-500' },
          mb: { icon: '🌀', name: 'Maya Binary', color: 'from-cyan-500 to-blue-500' },
          hip: { icon: '🔥', name: 'Houdini', color: 'from-red-500 to-orange-500' },
          nk: { icon: '💥', name: 'Nuke', color: 'from-yellow-500 to-orange-500' },
        };
        const ext = file.originalName.split('.').pop()?.toLowerCase() || '';
        const projectInfo = projectIcons[ext] || { icon: '📁', name: '工程文件', color: 'from-gray-500 to-gray-600' };
        
        return (
          <div className="text-center text-white">
            <div className={`w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${projectInfo.color} flex items-center justify-center`}>
              <span className="text-4xl">{projectInfo.icon}</span>
            </div>
            <p className="text-xl mb-2">{file.originalName}</p>
            <p className="text-gray-400 mb-2">{projectInfo.name} 工程文件</p>
            <p className="text-gray-500 text-sm mb-6">双击可使用本地应用打开</p>
            <a
              href={fileUrl}
              download={file.originalName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
            >
              <FiDownload size={18} />
              下载文件
            </a>
          </div>
        );
      
      case 'font':
        return (
          <div className="text-center text-white">
            <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="text-5xl font-serif">Aa</span>
            </div>
            <p className="text-xl mb-2">{file.originalName}</p>
            <p className="text-gray-400 mb-6">字体文件</p>
            <a
              href={fileUrl}
              download={file.originalName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
            >
              <FiDownload size={18} />
              下载字体
            </a>
          </div>
        );
      
      case 'archive':
        return (
          <div className="text-center text-white">
            <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
            <p className="text-xl mb-2">{file.originalName}</p>
            <p className="text-gray-400 mb-6">压缩包</p>
            <a
              href={fileUrl}
              download={file.originalName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
            >
              <FiDownload size={18} />
              下载文件
            </a>
          </div>
        );
      
      default:
        return (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-xl mb-2">{file.originalName}</p>
            <p className="text-gray-400 mb-6">此文件类型暂不支持预览</p>
            <a
              href={fileUrl}
              download={file.originalName}
              className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
            >
              <FiDownload size={18} />
              下载文件
            </a>
          </div>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex animate-fade-in"
      style={{ 
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* 快捷键提示 */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-4 text-white/40 text-xs">
        {fileType === 'video' ? (
          <>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd>
              播放/暂停
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd>
              快退/快进
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">M</kbd>
              静音
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">F</kbd>
              全屏
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd>
              切换
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">+</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">-</kbd>
              缩放
            </span>
          </>
        )}
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd>
          关闭
        </span>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 hover:scale-110"
      >
        <FiX size={20} />
      </button>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          onClick={() => navigate('prev')}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-50 p-4 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-all duration-200 hover:scale-110 backdrop-blur-sm"
        >
          <FiChevronLeft size={28} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={() => navigate('next')}
          className={`absolute top-1/2 -translate-y-1/2 z-50 p-4 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-all duration-200 hover:scale-110 backdrop-blur-sm ${
            showInfo ? 'right-[21rem]' : 'right-6'
          }`}
        >
          <FiChevronRight size={28} />
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-12 overflow-hidden">
        <div className="animate-scale-in">
          {renderPreviewContent()}
        </div>
      </div>

      {/* Zoom controls (for images and animated images) */}
      {(fileType === 'image' || fileType === 'animatedImage') && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full p-1.5 shadow-lg">
          <button
            onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
            className="p-2.5 hover:bg-white/10 rounded-full transition-all duration-200 text-white/70 hover:text-white"
          >
            <FiZoomOut size={16} />
          </button>
          <span className="text-white text-xs min-w-[3.5rem] text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(z + 0.25, 4))}
            className="p-2.5 hover:bg-white/10 rounded-full transition-all duration-200 text-white/70 hover:text-white"
          >
            <FiZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-white/20 mx-1" />
          <button
            onClick={() => setZoom(1)}
            className="p-2.5 hover:bg-white/10 rounded-full transition-all duration-200 text-white/70 hover:text-white"
            title="适应窗口"
          >
            <FiMaximize2 size={16} />
          </button>
        </div>
      )}

      {/* Info panel */}
      <div className={`w-80 bg-eagle-sidebar border-l border-eagle-border flex flex-col transition-transform ${showInfo ? '' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-eagle-border">
          <h2 className="text-lg font-medium text-eagle-text truncate">
            {file.originalName}
          </h2>
          <p className="text-sm text-eagle-textSecondary mt-1">
            {currentIndex + 1} / {files.length}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Rating */}
          <div>
            <h3 className="text-sm font-medium text-eagle-textSecondary mb-2">评分</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => onRateFile(file.id, file.rating === star ? 0 : star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <FiStar
                    size={24}
                    className={
                      star <= file.rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-eagle-textSecondary'
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-sm font-medium text-eagle-textSecondary mb-2">标签</h3>
            <div className="flex flex-wrap gap-2">
              {fileTags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                  style={{ 
                    backgroundColor: `${tag.color}20`,
                    color: tag.color || '#888'
                  }}
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={() => onRemoveTag(tag.id)}
                    className="p-0.5 hover:bg-black/20 rounded-full"
                  >
                    <FiX size={12} />
                  </button>
                </div>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-eagle-hover text-eagle-textSecondary hover:text-eagle-text transition-colors"
                >
                  <FiTag size={12} />
                  <span>添加</span>
                </button>
                {showTagPicker && availableTags.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 bg-eagle-card border border-eagle-border rounded-lg py-1 shadow-xl z-50 min-w-32">
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          onAddTag(tag.id);
                          setShowTagPicker(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-eagle-hover text-eagle-text flex items-center gap-2 transition-colors"
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || '#888' }}
                        />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Color Palette */}
          {file.palette && (
            <div>
              <h3 className="text-sm font-medium text-eagle-textSecondary mb-2">配色</h3>
              <div className="flex gap-2">
                {JSON.parse(file.palette).map((color: string, i: number) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-lg border border-eagle-border cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => navigator.clipboard.writeText(color)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* File Info */}
          <div>
            <h3 className="text-sm font-medium text-eagle-textSecondary mb-2">文件信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-eagle-textSecondary">类型</span>
                <span className="text-eagle-text">{file.mimeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-eagle-textSecondary">大小</span>
                <span className="text-eagle-text">{formatFileSize(file.size)}</span>
              </div>
              {file.width && file.height && (
                <div className="flex justify-between">
                  <span className="text-eagle-textSecondary">尺寸</span>
                  <span className="text-eagle-text">{file.width} × {file.height}</span>
                </div>
              )}
              {file.duration && (
                <div className="flex justify-between">
                  <span className="text-eagle-textSecondary">时长</span>
                  <span className="text-eagle-text">{Math.round(file.duration)}s</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-eagle-textSecondary">添加时间</span>
                <span className="text-eagle-text">{formatDate(file.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {file.annotation && (
            <div>
              <h3 className="text-sm font-medium text-eagle-textSecondary mb-2">备注</h3>
              <p className="text-sm text-eagle-text">{file.annotation}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-eagle-border flex gap-2">
          <a
            href={fileUrl}
            download={file.originalName}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
          >
            <FiDownload size={16} />
            <span>下载</span>
          </a>
          {onShare && (
            <button
              onClick={() => onShare(file.id)}
              className="p-2 bg-eagle-hover hover:bg-cyan-500/20 text-eagle-textSecondary hover:text-cyan-400 rounded-lg transition-colors"
              title="分享"
            >
              <FiShare2 size={16} />
            </button>
          )}
          <button className="p-2 bg-eagle-hover hover:bg-eagle-danger/20 text-eagle-textSecondary hover:text-eagle-danger rounded-lg transition-colors">
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
