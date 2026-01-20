import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { FiStar, FiPlay, FiMusic, FiFile, FiCheck, FiBox, FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { FileItem, ViewMode, UserSettings, Pagination } from '../types';
import { getFileUrl, getThumbnailUrl } from '../utils/filePath';
import { highlightFilename } from '../utils/highlight';
import { VideoThumbnail } from './VideoThumbnail';
import { SequenceCard } from './SequenceCard';
import { SequencePlayer } from './SequencePlayer';
import { detectSequences, SequenceGroup } from '../utils/sequenceDetector';

interface FileGridProps {
  files: FileItem[];
  viewMode: ViewMode;
  selectedFiles: string[];
  onFileSelect: (fileId: string, multi: boolean) => void;
  onBatchSelect?: (fileIds: string[]) => void; // 批量选择
  onFileDoubleClick: (file: FileItem) => void;
  onRateFile: (fileId: string, rating: number) => void;
  onHoverFile?: (file: FileItem | null) => void;
  loading: boolean;
  userSettings?: UserSettings;
  pagination?: Pagination | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  searchQuery?: string; // 用于高亮搜索结果
}

// 框选状态
interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// 高亮搜索文本的组件
function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !highlight.trim()) {
    return <>{text}</>;
  }
  
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-500/50 text-white rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatResolution(width: number | null, height: number | null): string {
  if (!width || !height) return '';
  // 判断分辨率等级
  const pixels = width * height;
  let label = '';
  if (width >= 7680) label = '8K';
  else if (width >= 3840) label = '4K';
  else if (width >= 2560) label = '2K';
  else if (width >= 1920) label = 'FHD';
  else if (width >= 1280) label = 'HD';
  else if (width >= 720) label = 'SD';
  
  return `${width}×${height}${label ? ` (${label})` : ''}`;
}

function getImageType(mimeType: string, originalName: string): string {
  const ext = originalName.split('.').pop()?.toUpperCase() || '';
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'image/bmp': 'BMP',
    'image/tiff': 'TIFF',
    'image/vnd.adobe.photoshop': 'PSD',
  };
  return mimeMap[mimeType] || ext || 'IMAGE';
}

function getVideoCodec(mimeType: string, originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const codecMap: Record<string, string> = {
    'mp4': 'H.264/H.265',
    'mov': 'ProRes/H.264',
    'avi': 'DivX/XviD',
    'mkv': 'H.264/VP9',
    'webm': 'VP8/VP9',
    'wmv': 'WMV',
    'flv': 'FLV',
  };
  return codecMap[ext] || ext.toUpperCase();
}

function getAspectRatio(width: number | null, height: number | null): string {
  if (!width || !height) return '';
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  // 简化常见比例
  if ((w === 16 && h === 9) || (w === 32 && h === 18)) return '16:9';
  if ((w === 4 && h === 3) || (w === 8 && h === 6)) return '4:3';
  if ((w === 21 && h === 9) || (w === 64 && h === 27)) return '21:9';
  if (w === 1 && h === 1) return '1:1';
  if ((w === 9 && h === 16) || (w === 18 && h === 32)) return '9:16';
  if (w <= 100 && h <= 100) return `${w}:${h}`;
  return '';
}

function FileCard({ 
  file, 
  isSelected, 
  onSelect, 
  onDoubleClick,
  onRate,
  onHover,
  viewMode,
  searchQuery,
  registerRef,
  isDragging,
}: { 
  file: FileItem;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
  onDoubleClick: () => void;
  onRate: (rating: number) => void;
  onHover?: (hovering: boolean) => void;
  viewMode: ViewMode;
  searchQuery?: string;
  registerRef?: (el: HTMLElement | null) => void;
  isDragging?: boolean;
}) {
  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const ext = file.originalName.split('.').pop()?.toLowerCase() || '';
  const is3D = ['obj', 'fbx', 'gltf', 'glb', 'stl', '3ds', 'dae', 'ply'].includes(ext);

  const thumbnail = getThumbnailUrl(file);

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center gap-4 px-4 py-3 border-b border-eagle-border cursor-pointer transition-fast ${
          isSelected ? 'bg-eagle-accent/20' : 'hover:bg-eagle-hover'
        }`}
        onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      >
        {/* Checkbox */}
        <div 
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-fast ${
            isSelected 
              ? 'bg-eagle-accent border-eagle-accent' 
              : 'border-eagle-border hover:border-eagle-accent'
          }`}
        >
          {isSelected && <FiCheck size={12} className="text-white" />}
        </div>

        {/* Thumbnail */}
        <div className="w-12 h-12 bg-eagle-bg rounded overflow-hidden flex-shrink-0">
          {isImage ? (
            <img 
              src={thumbnail} 
              alt={file.originalName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-blue-500/20">
              <FiPlay className="text-blue-400" size={20} />
            </div>
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
              <FiMusic className="text-purple-400" size={20} />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-eagle-hover">
              <FiFile className="text-eagle-textSecondary" size={20} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-eagle-text truncate">
            {searchQuery ? highlightFilename(file.originalName, searchQuery) : file.originalName}
          </div>
          <div className="text-xs text-eagle-textSecondary flex items-center gap-1.5 flex-wrap">
            {/* 文件类型标签 */}
            <span className={`font-medium ${
              isImage ? 'text-green-400' : 
              isVideo ? 'text-blue-400' : 
              isAudio ? 'text-purple-400' : 
              'text-orange-400'
            }`}>
              {isImage ? getImageType(file.mimeType, file.originalName) :
               isVideo ? getVideoCodec(file.mimeType, file.originalName) :
               ext.toUpperCase()}
            </span>
            <span>•</span>
            <span>{formatFileSize(file.size)}</span>
            {/* 分辨率/尺寸 */}
            {file.width && file.height && (
              <>
                <span>•</span>
                <span>{formatResolution(file.width, file.height)}</span>
              </>
            )}
            {/* 时长 */}
            {file.duration && (
              <>
                <span>•</span>
                <span className="text-green-400">{formatDuration(file.duration)}</span>
              </>
            )}
            {/* 宽高比 */}
            {file.width && file.height && getAspectRatio(file.width, file.height) && (
              <>
                <span>•</span>
                <span className="text-gray-500">{getAspectRatio(file.width, file.height)}</span>
              </>
            )}
            {/* 主色调 */}
            {file.dominantColor && isImage && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ background: file.dominantColor }} />
                </span>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        {file.tags.length > 0 && (
          <div className="flex gap-1">
            {file.tags.slice(0, 3).map(ft => (
              <div
                key={ft.id}
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ 
                  backgroundColor: `${ft.tag.color}20`,
                  color: ft.tag.color || '#888'
                }}
              >
                {ft.tag.name}
              </div>
            ))}
          </div>
        )}

        {/* Rating */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={(e) => {
                e.stopPropagation();
                onRate(file.rating === star ? 0 : star);
              }}
              className="p-0.5 hover:scale-110 transition-transform"
            >
              <FiStar
                size={14}
                className={
                  star <= file.rating
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-eagle-textSecondary'
                }
              />
            </button>
          ))}
        </div>

        {/* Color */}
        {file.dominantColor && (
          <div 
            className="w-6 h-6 rounded-full border-2 border-eagle-border"
            style={{ backgroundColor: file.dominantColor }}
          />
        )}
      </div>
    );
  }

  // Grid and Masonry view
  return (
    <div
      ref={registerRef}
      data-file-card
      className={`group relative bg-eagle-card rounded-xl overflow-hidden cursor-pointer transition-all duration-200 file-card ${
        isSelected ? 'ring-2 ring-eagle-accent' : ''
      }`}
      onClick={(e) => {
        // 如果正在框选，不触发点击
        if (isDragging) return;
        onSelect(e.ctrlKey || e.metaKey);
      }}
      onDoubleClick={(e) => {
        if (isDragging) return;
        onDoubleClick();
      }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {/* Selection Checkbox */}
      <div 
        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
          isSelected 
            ? 'bg-eagle-accent border-eagle-accent opacity-100' 
            : 'border-white/50 bg-black/30 opacity-0 group-hover:opacity-100'
        }`}
      >
        {isSelected && <FiCheck size={14} className="text-white" />}
      </div>

      {/* Thumbnail */}
      <div 
        className={`relative bg-eagle-bg ${viewMode === 'masonry' && file.width && file.height ? '' : 'aspect-square'}`}
        style={viewMode === 'masonry' && file.width && file.height ? {
          aspectRatio: `${file.width} / ${file.height}`,
          maxHeight: '400px'
        } : undefined}
      >
        {isImage && thumbnail ? (
          <img 
            src={thumbnail} 
            alt={file.originalName}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // 加载失败时显示图标
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement?.classList.add('show-fallback');
            }}
          />
        ) : isImage && !thumbnail ? (
          // PSD 等没有缩略图的图片格式
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <div className="text-center">
              <div className="text-3xl mb-1">🎨</div>
              <div className="text-xs text-white/60 uppercase">{ext}</div>
            </div>
          </div>
        ) : isVideo ? (
          <VideoThumbnail
            videoPath={file.path}
            thumbnailPath={file.thumbnailPath}
            className="w-full h-full"
          />
        ) : isAudio ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <FiMusic className="text-white" size={32} />
            </div>
          </div>
        ) : is3D ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <FiBox className="text-cyan-400" size={32} />
            </div>
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
              3D
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-eagle-hover">
            <FiFile className="text-eagle-textSecondary" size={48} />
          </div>
        )}

        {/* Dominant Color Strip */}
        {file.dominantColor && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: file.dominantColor }}
          />
        )}
      </div>

      {/* File Name - Always visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
        <div className="text-xs text-white truncate font-medium leading-tight">
          {searchQuery ? highlightFilename(file.originalName, searchQuery) : file.originalName}
        </div>
      </div>

      {/* Hover Info Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
        {/* 文件名 */}
        <div className="text-sm text-white truncate font-medium mb-2">
          {searchQuery ? highlightFilename(file.originalName, searchQuery) : file.originalName}
        </div>
        
        {/* 详细信息 */}
        <div className="space-y-1 mb-2">
          {/* 图片信息 */}
          {isImage && (
            <>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-cyan-400 font-medium">{getImageType(file.mimeType, file.originalName)}</span>
                {file.width && file.height && (
                  <span className="text-white/70">{formatResolution(file.width, file.height)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                <span>{formatFileSize(file.size)}</span>
                {file.width && file.height && (
                  <>
                    <span>•</span>
                    <span>{getAspectRatio(file.width, file.height) || `${file.width}×${file.height}`}</span>
                  </>
                )}
                {file.dominantColor && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: file.dominantColor }} />
                      {file.dominantColor}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
          
          {/* 视频信息 */}
          {isVideo && (
            <>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-blue-400 font-medium">{getVideoCodec(file.mimeType, file.originalName)}</span>
                {file.width && file.height && (
                  <span className="text-white/70">{formatResolution(file.width, file.height)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                <span>{formatFileSize(file.size)}</span>
                {file.duration && (
                  <>
                    <span>•</span>
                    <span className="text-green-400">{formatDuration(file.duration)}</span>
                  </>
                )}
                {file.width && file.height && getAspectRatio(file.width, file.height) && (
                  <>
                    <span>•</span>
                    <span>{getAspectRatio(file.width, file.height)}</span>
                  </>
                )}
              </div>
            </>
          )}
          
          {/* 音频信息 */}
          {isAudio && (
            <div className="flex items-center gap-2 text-[11px] text-white/60">
              <span className="text-purple-400 font-medium">
                {file.originalName.split('.').pop()?.toUpperCase()}
              </span>
              <span>{formatFileSize(file.size)}</span>
              {file.duration && (
                <>
                  <span>•</span>
                  <span className="text-green-400">{formatDuration(file.duration)}</span>
                </>
              )}
            </div>
          )}
          
          {/* 其他文件 */}
          {!isImage && !isVideo && !isAudio && (
            <div className="flex items-center gap-2 text-[11px] text-white/60">
              <span className="text-orange-400 font-medium">
                {file.originalName.split('.').pop()?.toUpperCase()}
              </span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          )}
        </div>
        
        {/* 评分 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={(e) => {
                  e.stopPropagation();
                  onRate(file.rating === star ? 0 : star);
                }}
                className="p-0.5 hover:scale-110 transition-transform"
              >
                <FiStar
                  size={12}
                  className={
                    star <= file.rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-white/50'
                  }
                />
              </button>
            ))}
          </div>
          {/* 标签预览 */}
          {file.tags.length > 0 && (
            <div className="flex gap-1">
              {file.tags.slice(0, 2).map(ft => (
                <span
                  key={ft.id}
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{ 
                    background: `${ft.tag.color}30`,
                    color: ft.tag.color || '#888'
                  }}
                >
                  {ft.tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tags Badge */}
      {file.tags.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1">
          {file.tags.slice(0, 2).map(ft => (
            <div
              key={ft.id}
              className="w-3 h-3 rounded-full border border-white/30"
              style={{ backgroundColor: ft.tag.color || '#888' }}
              title={ft.tag.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 分页组件
function PaginationBar({ 
  pagination, 
  currentPage, 
  onPageChange,
  primaryColor,
}: { 
  pagination: Pagination;
  currentPage: number;
  onPageChange: (page: number) => void;
  primaryColor: string;
}) {
  const { total, totalPages } = pagination;
  
  // 生成页码数组
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('...');
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div 
      className="flex items-center justify-center gap-2 py-4 px-4 border-t"
      style={{ 
        borderColor: `${primaryColor}20`,
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      {/* 文件统计 */}
      <div className="text-sm text-gray-400 mr-4">
        共 <span style={{ color: primaryColor }}>{total}</span> 个文件
      </div>

      {/* 首页 */}
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
        title="首页"
      >
        <FiChevronsLeft size={16} style={{ color: currentPage === 1 ? '#666' : primaryColor }} />
      </button>

      {/* 上一页 */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
        title="上一页"
      >
        <FiChevronLeft size={16} style={{ color: currentPage === 1 ? '#666' : primaryColor }} />
      </button>

      {/* 页码 */}
      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, index) => (
          typeof page === 'number' ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              className="min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all"
              style={{
                background: currentPage === page 
                  ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}80)` 
                  : 'transparent',
                color: currentPage === page ? '#000' : '#999',
                boxShadow: currentPage === page ? `0 0 15px ${primaryColor}50` : 'none',
              }}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="px-2 text-gray-500">...</span>
          )
        ))}
      </div>

      {/* 下一页 */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
        title="下一页"
      >
        <FiChevronRight size={16} style={{ color: currentPage === totalPages ? '#666' : primaryColor }} />
      </button>

      {/* 末页 */}
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
        title="末页"
      >
        <FiChevronsRight size={16} style={{ color: currentPage === totalPages ? '#666' : primaryColor }} />
      </button>

      {/* 页码跳转 */}
      <div className="flex items-center gap-2 ml-4">
        <span className="text-sm text-gray-400">跳至</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          defaultValue={currentPage}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const value = parseInt((e.target as HTMLInputElement).value);
              if (value >= 1 && value <= totalPages) {
                onPageChange(value);
              }
            }
          }}
          className="w-14 px-2 py-1 text-center text-sm rounded-lg bg-black/40 border text-white focus:outline-none"
          style={{ borderColor: `${primaryColor}40` }}
        />
        <span className="text-sm text-gray-400">页</span>
      </div>
    </div>
  );
}

export function FileGrid({
  files,
  viewMode,
  selectedFiles,
  onFileSelect,
  onBatchSelect,
  onFileDoubleClick,
  onRateFile,
  onHoverFile,
  loading,
  userSettings,
  pagination,
  currentPage = 1,
  onPageChange,
  searchQuery,
}: FileGridProps) {
  const primaryColor = userSettings?.primaryColor || '#00ffff';
  const [playingSequence, setPlayingSequence] = useState<SequenceGroup | null>(null);
  
  // 框选状态
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const wasDraggingRef = useRef(false); // 用于阻止拖动后的点击事件
  const fileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const DRAG_THRESHOLD = 10; // 拖动阈值（像素）

  // 注册文件元素引用
  const registerFileRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      fileRefs.current.set(id, el);
    } else {
      fileRefs.current.delete(id);
    }
  }, []);

  // 计算框选区域内的文件
  const getFilesInSelection = useCallback((box: SelectionBox): string[] => {
    if (!containerRef.current) return [];
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const scrollLeft = containerRef.current.scrollLeft;
    
    // 计算选择框的边界（考虑滚动）
    const selLeft = Math.min(box.startX, box.currentX);
    const selRight = Math.max(box.startX, box.currentX);
    const selTop = Math.min(box.startY, box.currentY);
    const selBottom = Math.max(box.startY, box.currentY);
    
    const selectedIds: string[] = [];
    
    fileRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      // 转换为相对于容器的坐标
      const fileLeft = rect.left - containerRect.left + scrollLeft;
      const fileRight = rect.right - containerRect.left + scrollLeft;
      const fileTop = rect.top - containerRect.top + scrollTop;
      const fileBottom = rect.bottom - containerRect.top + scrollTop;
      
      // 检查是否相交
      if (
        fileLeft < selRight &&
        fileRight > selLeft &&
        fileTop < selBottom &&
        fileBottom > selTop
      ) {
        selectedIds.push(id);
      }
    });
    
    return selectedIds;
  }, []);

  // 鼠标按下 - 准备框选
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;
    
    // 记录起始位置，但不立即开始框选
    dragStartRef.current = { 
      x: e.clientX, 
      y: e.clientY,
      startX: x, 
      startY: y 
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + container.scrollLeft;
      const y = e.clientY - rect.top + container.scrollTop;
      
      // 如果已经在拖动，更新选择框
      if (isDragging && selectionBox) {
        setSelectionBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
        return;
      }
      
      // 检查是否超过拖动阈值
      if (dragStartRef.current) {
        const dx = Math.abs(e.clientX - dragStartRef.current.x);
        const dy = Math.abs(e.clientY - dragStartRef.current.y);
        
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          // 超过阈值，开始框选
          setIsDragging(true);
          setSelectionBox({
            startX: dragStartRef.current.startX,
            startY: dragStartRef.current.startY,
            currentX: x,
            currentY: y,
          });
        }
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging && selectionBox && onBatchSelect) {
        const selectedIds = getFilesInSelection(selectionBox);
        if (selectedIds.length > 0) {
          onBatchSelect(selectedIds);
        }
        // 标记刚刚完成拖动，阻止后续的点击事件
        wasDraggingRef.current = true;
        setTimeout(() => {
          wasDraggingRef.current = false;
        }, 100);
      }
      setSelectionBox(null);
      setIsDragging(false);
      dragStartRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, selectionBox, getFilesInSelection, onBatchSelect]);

  // 计算选择框样式
  const selectionBoxStyle = useMemo(() => {
    if (!selectionBox || !isDragging) return null;
    
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);
    
    // 最小尺寸，避免太小看不见
    if (width < 5 && height < 5) return null;
    
    return { left, top, width, height };
  }, [selectionBox, isDragging]);

  // Detect sequences in files
  const { sequences, nonSequenceFiles } = useMemo(() => {
    return detectSequences(files);
  }, [files]);

  // Masonry columns (only for non-sequence files)
  const columns = useMemo(() => {
    if (viewMode !== 'masonry') return [];
    
    const colCount = 5;
    const cols: FileItem[][] = Array.from({ length: colCount }, () => []);
    const heights: number[] = Array(colCount).fill(0);
    
    nonSequenceFiles.forEach(file => {
      const minHeightIndex = heights.indexOf(Math.min(...heights));
      cols[minHeightIndex].push(file);
      heights[minHeightIndex] += file.height && file.width 
        ? (file.height / file.width) * 200
        : 200;
    });
    
    return cols;
  }, [nonSequenceFiles, viewMode]);

  if (loading && files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-eagle-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-eagle-textSecondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-eagle-card flex items-center justify-center">
            <FiFile size={40} className="text-eagle-textSecondary" />
          </div>
          <h3 className="text-lg font-medium text-eagle-text mb-2">暂无文件</h3>
          <p className="text-eagle-textSecondary">拖拽文件到此处上传</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto content-scroll">
          {/* Sequence info in list view */}
          {sequences.length > 0 && (
            <div className="p-4 border-b border-apple-glassBorder">
              <h3 className="text-sm font-medium text-apple-textSecondary mb-2">
                检测到 {sequences.length} 组序列帧
              </h3>
              <div className="flex flex-wrap gap-2">
                {sequences.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => setPlayingSequence(seq)}
                    className="px-3 py-1.5 rounded-lg bg-apple-glass hover:bg-apple-glassHover border border-apple-glassBorder text-sm text-apple-text transition-colors"
                  >
                    {seq.baseName}* ({seq.frameCount} 帧)
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="divide-y divide-eagle-border">
            {nonSequenceFiles.map(file => (
              <FileCard
                key={file.id}
                file={file}
                isSelected={selectedFiles.includes(file.id)}
                onSelect={(multi) => onFileSelect(file.id, multi)}
                onDoubleClick={() => onFileDoubleClick(file)}
                onRate={(rating) => onRateFile(file.id, rating)}
                onHover={(hovering) => onHoverFile?.(hovering ? file : null)}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>

        {/* Pagination */}
        {pagination && onPageChange && (
          <PaginationBar
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={onPageChange}
            primaryColor={primaryColor}
          />
        )}

        {playingSequence && (
          <SequencePlayer
            sequence={playingSequence}
            onClose={() => setPlayingSequence(null)}
          />
        )}
      </div>
    );
  }

  if (viewMode === 'masonry') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto content-scroll p-4">
          <div className="masonry-grid">
            {columns.map((column, colIndex) => (
              <div key={colIndex} className="masonry-column flex-1">
                {column.map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isSelected={selectedFiles.includes(file.id)}
                    onSelect={(multi) => onFileSelect(file.id, multi)}
                    onDoubleClick={() => onFileDoubleClick(file)}
                    onRate={(rating) => onRateFile(file.id, rating)}
                    onHover={(hovering) => onHoverFile?.(hovering ? file : null)}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {pagination && onPageChange && (
          <PaginationBar
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={onPageChange}
            primaryColor={primaryColor}
          />
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto content-scroll p-4 relative select-none"
        onMouseDown={handleMouseDown}
      >
        {/* 框选框 */}
        {selectionBoxStyle && (
          <div
            data-selection-box
            className="absolute pointer-events-none z-50"
            style={{
              left: selectionBoxStyle.left,
              top: selectionBoxStyle.top,
              width: selectionBoxStyle.width,
              height: selectionBoxStyle.height,
              background: `${primaryColor}30`,
              border: `2px solid ${primaryColor}`,
              borderRadius: 4,
              boxShadow: `0 0 10px ${primaryColor}50`,
            }}
          />
        )}

        {/* Sequence Groups */}
        {sequences.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-apple-textSecondary mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-apple-accent" />
              序列帧 ({sequences.length} 组)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sequences.map(seq => (
                <SequenceCard
                  key={seq.id}
                  sequence={seq}
                  onClick={() => setPlayingSequence(seq)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Files */}
        {nonSequenceFiles.length > 0 && (
          <>
            {sequences.length > 0 && (
              <h3 className="text-sm font-medium text-apple-textSecondary mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-apple-textTertiary" />
                其他文件 ({nonSequenceFiles.length})
              </h3>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {nonSequenceFiles.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.includes(file.id)}
                  onSelect={(multi) => onFileSelect(file.id, multi)}
                  onDoubleClick={() => onFileDoubleClick(file)}
                  onRate={(rating) => onRateFile(file.id, rating)}
                  onHover={(hovering) => onHoverFile?.(hovering ? file : null)}
                  viewMode={viewMode}
                  registerRef={(el) => registerFileRef(file.id, el)}
                  isDragging={isDragging}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination && onPageChange && (
        <PaginationBar
          pagination={pagination}
          currentPage={currentPage}
          onPageChange={onPageChange}
          primaryColor={primaryColor}
        />
      )}

      {/* Sequence Player Modal */}
      {playingSequence && (
        <SequencePlayer
          sequence={playingSequence}
          onClose={() => setPlayingSequence(null)}
        />
      )}
    </div>
  );
}
