import { useState, useEffect, useRef } from 'react';
import { 
  FiSearch, 
  FiGrid, 
  FiList, 
  FiTrash2,
  FiMove,
  FiTag,
  FiFilter,
  FiStar,
  FiDroplet,
  FiChevronDown,
  FiChevronRight,
  FiUser,
  FiLogOut,
  FiServer,
  FiSettings,
  FiX,
  FiCheck,
  FiImage,
  FiVideo,
  FiMusic,
  FiFile,
  FiBox,
  FiTool,
  FiClock
} from 'react-icons/fi';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { ViewMode, FileFilters, Folder, Tag, UserSettings } from '../types';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';

// 文件格式分类（详细版，包含每个格式）
const FILE_CATEGORIES = {
  images: {
    name: '图片',
    icon: FiImage,
    color: '#22c55e',
    formats: [
      { ext: 'jpg,jpeg', name: 'JPEG', desc: '通用压缩图片' },
      { ext: 'png', name: 'PNG', desc: '无损透明图片' },
      { ext: 'apng', name: 'APNG', desc: '动态PNG图片' },
      { ext: 'gif', name: 'GIF', desc: '动图/简单动画' },
      { ext: 'webp', name: 'WebP', desc: '现代网页格式' },
      { ext: 'svg', name: 'SVG', desc: '矢量图形' },
      { ext: 'bmp', name: 'BMP', desc: '位图格式' },
      { ext: 'psd', name: 'PSD', desc: 'Photoshop文件' },
      { ext: 'ai', name: 'AI', desc: 'Illustrator文件' },
      { ext: 'raw,cr2,nef,arw,dng', name: 'RAW', desc: '相机原始格式' },
      { ext: 'tiff,tif', name: 'TIFF', desc: '高质量图片' },
      { ext: 'ico', name: 'ICO', desc: '图标文件' },
    ]
  },
  videos: {
    name: '视频',
    icon: FiVideo,
    color: '#3b82f6',
    formats: [
      { ext: 'mp4', name: 'MP4', desc: 'H.264/H.265' },
      { ext: 'mov', name: 'MOV', desc: 'QuickTime' },
      { ext: 'avi', name: 'AVI', desc: 'Windows视频' },
      { ext: 'mkv', name: 'MKV', desc: 'Matroska' },
      { ext: 'wmv', name: 'WMV', desc: 'Windows Media' },
      { ext: 'flv', name: 'FLV', desc: 'Flash视频' },
      { ext: 'webm', name: 'WebM', desc: '网页视频' },
      { ext: 'm4v', name: 'M4V', desc: 'iTunes视频' },
      { ext: 'mpg,mpeg', name: 'MPEG', desc: 'MPEG视频' },
      { ext: '3gp', name: '3GP', desc: '手机视频' },
    ]
  },
  audios: {
    name: '音频',
    icon: FiMusic,
    color: '#a855f7',
    formats: [
      { ext: 'mp3', name: 'MP3', desc: '通用音频' },
      { ext: 'wav', name: 'WAV', desc: '无损音频' },
      { ext: 'ogg', name: 'OGG', desc: 'Vorbis音频' },
      { ext: 'flac', name: 'FLAC', desc: '无损压缩' },
      { ext: 'm4a', name: 'M4A', desc: 'AAC音频' },
      { ext: 'aac', name: 'AAC', desc: '高级音频' },
      { ext: 'wma', name: 'WMA', desc: 'Windows音频' },
      { ext: 'aiff,aif', name: 'AIFF', desc: 'Apple无损' },
    ]
  },
  documents: {
    name: '文档',
    icon: FiFile,
    color: '#f97316',
    formats: [
      { ext: 'pdf', name: 'PDF', desc: '便携文档' },
      { ext: 'doc,docx', name: 'Word', desc: 'Word文档' },
      { ext: 'xls,xlsx', name: 'Excel', desc: '电子表格' },
      { ext: 'ppt,pptx', name: 'PPT', desc: '演示文稿' },
      { ext: 'txt', name: 'TXT', desc: '纯文本' },
      { ext: 'rtf', name: 'RTF', desc: '富文本' },
      { ext: 'md', name: 'Markdown', desc: 'MD文档' },
      { ext: 'csv', name: 'CSV', desc: '表格数据' },
      { ext: 'json', name: 'JSON', desc: '数据文件' },
      { ext: 'xml', name: 'XML', desc: '标记语言' },
    ]
  },
  models3d: {
    name: '3D模型',
    icon: FiBox,
    color: '#06b6d4',
    formats: [
      { ext: 'obj', name: 'OBJ', desc: '通用3D格式' },
      { ext: 'fbx', name: 'FBX', desc: 'Autodesk交换' },
      { ext: 'gltf,glb', name: 'glTF', desc: 'Web 3D格式' },
      { ext: 'stl', name: 'STL', desc: '3D打印' },
      { ext: 'blend', name: 'Blend', desc: 'Blender文件' },
      { ext: 'dae', name: 'DAE', desc: 'Collada格式' },
      { ext: '3ds', name: '3DS', desc: '3DS Max' },
      { ext: 'ply', name: 'PLY', desc: '点云数据' },
    ]
  },
  projects: {
    name: '工程',
    icon: FiTool,
    color: '#ec4899',
    formats: [
      { ext: 'psd', name: 'PSD', desc: 'Photoshop工程' },
      { ext: 'ai', name: 'AI', desc: 'Illustrator工程' },
      { ext: 'aep', name: 'AEP', desc: 'After Effects' },
      { ext: 'prproj', name: 'Premiere', desc: 'Premiere Pro' },
      { ext: 'blend', name: 'Blend', desc: 'Blender工程' },
      { ext: 'c4d', name: 'C4D', desc: 'Cinema 4D' },
      { ext: 'max', name: '3DS Max', desc: '3DS Max工程' },
      { ext: 'ma,mb', name: 'Maya', desc: 'Maya工程' },
      { ext: 'skp', name: 'SketchUp', desc: 'SketchUp工程' },
    ]
  },
};

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSearch: (query: string) => void;
  onFilterByColor: (colors: string[] | null) => void; // 支持多颜色
  onFilterByType: (type: string | null) => void;
  onFilterByFormat?: (format: string | null) => void; // 按文件格式筛选
  selectedFormat?: string | null; // 当前选中的格式
  onSortChange: (sortBy: FileFilters['sortBy'], sortOrder: FileFilters['sortOrder']) => void;
  selectedCount: number;
  totalCount: number; // 总文件数
  onDeleteSelected: () => void;
  onSelectAll: () => void; // 全选
  filters: FileFilters;
  folders: Folder[];
  tags: Tag[];
  onMoveFiles: (folderId: string | null) => void;
  onTagFiles: (tagId: string) => void;
  username?: string;
  servers?: ServerConfig[];
  onLogout?: () => void;
  userSettings?: UserSettings;
  onOpenSettings?: () => void;
  // 缩略图大小控制
  thumbnailSize?: number;
  onThumbnailSizeChange?: (size: number) => void;
}

// 更直观的颜色分类 - 按色相范围筛选
const COLOR_CATEGORIES = [
  { name: '红色系', color: '#ef4444', hueRange: [0, 15], hueRange2: [345, 360] },
  { name: '橙色系', color: '#f97316', hueRange: [15, 45] },
  { name: '黄色系', color: '#eab308', hueRange: [45, 70] },
  { name: '绿色系', color: '#22c55e', hueRange: [70, 160] },
  { name: '青色系', color: '#14b8a6', hueRange: [160, 200] },
  { name: '蓝色系', color: '#3b82f6', hueRange: [200, 260] },
  { name: '紫色系', color: '#8b5cf6', hueRange: [260, 290] },
  { name: '粉色系', color: '#ec4899', hueRange: [290, 345] },
  { name: '灰白系', color: '#9ca3af', isNeutral: true },
  { name: '黑暗系', color: '#374151', isDark: true },
];

const FILE_TYPES = [
  { label: '全部文件', value: null, icon: '📁' },
  { label: '图片', value: 'image/', icon: '🖼️' },
  { label: '视频', value: 'video/', icon: '🎬' },
  { label: '音频', value: 'audio/', icon: '🎵' },
  { label: '文档', value: 'application/', icon: '📄' },
];

const SORT_OPTIONS = [
  { label: '添加时间', value: 'createdAt', icon: '🕐' },
  { label: '格式类型', value: 'format', icon: '📁' },
  { label: '文件名称', value: 'name', icon: '📝' },
  { label: '文件大小', value: 'size', icon: '📊' },
  { label: '评分高低', value: 'rating', icon: '⭐' },
];

// 通用下拉菜单组件
function Dropdown({ 
  trigger, 
  children, 
  isOpen, 
  onClose,
  align = 'left'
}: { 
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {isOpen && (
        <>
          {/* 背景遮罩 - 移动端友好 */}
          <div 
            className="fixed inset-0 z-[190]" 
            onClick={onClose}
          />
          {/* 下拉内容 */}
          <div 
            className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} z-[200] animate-fade-in`}
            style={{
              minWidth: '180px',
            }}
          >
            <div className="cyber-panel p-2 shadow-2xl" style={{ 
              background: 'rgba(15, 15, 25, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
            }}>
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Toolbar({
  viewMode,
  onViewModeChange,
  onSearch,
  onFilterByColor,
  onFilterByType,
  onFilterByFormat,
  selectedFormat,
  onSortChange,
  selectedCount,
  totalCount,
  onDeleteSelected,
  onSelectAll,
  filters,
  folders,
  tags,
  onMoveFiles,
  onTagFiles,
  username,
  servers,
  onLogout,
  userSettings,
  onOpenSettings,
  thumbnailSize = 200,
  onThumbnailSizeChange,
}: ToolbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<FileFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<FileFilters['sortOrder']>('desc');
  const [selectedColors, setSelectedColors] = useState<string[]>([]); // 多颜色选择
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set()); // 展开的类型分类
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('bk-search-history');
    return saved ? JSON.parse(saved) : [];
  });
  
  // 切换类型分类展开
  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  
  // 获取分类的所有扩展名
  const getCategoryExts = (cat: typeof FILE_CATEGORIES.images) => {
    return cat.formats.map(f => f.ext).join(',');
  };
  
  // 检查格式是否被选中
  const isFormatSelected = (ext: string) => {
    if (!selectedFormat) return false;
    const selectedExts = selectedFormat.split(',');
    const formatExts = ext.split(',');
    return formatExts.every(e => selectedExts.includes(e));
  };
  
  // 检查整个分类是否被选中
  const isCategorySelected = (cat: typeof FILE_CATEGORIES.images) => {
    if (!selectedFormat) return false;
    const allExts = getCategoryExts(cat);
    return selectedFormat === allExts;
  };
  
  // 处理分类点击
  const handleCategoryClick = (allExts: string) => {
    if (selectedFormat === allExts) {
      onFilterByFormat?.(null);
    } else {
      onFilterByFormat?.(allExts);
    }
  };
  
  // 获取当前选中的类型名称
  const getSelectedTypeName = () => {
    if (!selectedFormat) return '类型';
    // 检查是否选中了完整分类
    for (const [, cat] of Object.entries(FILE_CATEGORIES)) {
      if (isCategorySelected(cat)) {
        return cat.name;
      }
      // 检查是否选中了具体格式
      for (const format of cat.formats) {
        if (selectedFormat === format.ext) {
          return format.name;
        }
      }
    }
    return '类型';
  };

  const primaryColor = userSettings?.primaryColor || '#00ffff';
  const secondaryColor = userSettings?.secondaryColor || '#ff00ff';

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const closeDropdown = () => setActiveDropdown(null);

  const handleSortChange = (newSortBy: FileFilters['sortBy']) => {
    const newOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    onSortChange(newSortBy, newOrder);
    closeDropdown();
  };

  const flattenFolders = (folders: Folder[], depth = 0): { folder: Folder; depth: number }[] => {
    return folders.flatMap(folder => [
      { folder, depth },
      ...(folder.children ? flattenFolders(folder.children, depth + 1) : [])
    ]);
  };

  // 获取当前激活的筛选数量
  const activeFiltersCount = [
    filters.color,
    selectedFormat,
  ].filter(Boolean).length;

  return (
    <div 
      className="relative border-b px-4 py-3"
      style={{ 
        background: 'rgba(10, 10, 15, 0.95)',
        borderColor: `${primaryColor}30`,
        zIndex: 100,
      }}
    >
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <FiSearch 
            className="absolute left-3 top-1/2 -translate-y-1/2" 
            size={16}
            style={{ color: primaryColor }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            onFocus={() => setShowSearchHistory(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                // 保存搜索历史
                const newHistory = [searchQuery.trim(), ...searchHistory.filter(h => h !== searchQuery.trim())].slice(0, 10);
                setSearchHistory(newHistory);
                localStorage.setItem('bk-search-history', JSON.stringify(newHistory));
                setShowSearchHistory(false);
              }
            }}
            placeholder="搜索文件名..."
            className="w-full pl-10 pr-20 py-2.5 bg-black/40 border rounded-lg text-sm text-cyber-text placeholder-cyber-muted focus:outline-none transition-all"
            style={{
              borderColor: searchQuery ? primaryColor : 'rgba(255,255,255,0.1)',
              boxShadow: searchQuery ? `0 0 10px ${primaryColor}30` : 'none',
            }}
            data-search-input
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  onSearch('');
                  setShowSearchHistory(false);
                }}
                className="p-1 hover:bg-white/10 rounded"
              >
                <FiX size={14} className="text-cyber-muted" />
              </button>
            )}
            <button
              onClick={() => setShowAdvancedSearch(true)}
              className="p-1 hover:bg-white/10 rounded"
              title="高级搜索"
            >
              <FiFilter size={14} className="text-cyber-muted" />
            </button>
          </div>
          
          {/* 搜索历史下拉 */}
          {showSearchHistory && searchHistory.length > 0 && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowSearchHistory(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-xl z-40 max-h-64 overflow-y-auto">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                    <FiClock size={14} />
                    搜索历史
                  </div>
                  {searchHistory.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchQuery(item);
                        onSearch(item);
                        setShowSearchHistory(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg text-white transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 分隔线 */}
        <div className="h-6 w-px bg-white/10" />

        {/* 筛选按钮组 */}
        <div className="flex items-center gap-1">
          {/* 类型筛选 - 详细格式分类 */}
          <Dropdown
            isOpen={activeDropdown === 'type'}
            onClose={closeDropdown}
            trigger={
              <button
                onClick={() => toggleDropdown('type')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm"
                style={{
                  background: selectedFormat ? `${primaryColor}20` : 'transparent',
                  color: selectedFormat ? primaryColor : '#999',
                }}
              >
                <FiFilter size={15} />
                <span>{getSelectedTypeName()}</span>
                <FiChevronDown size={14} />
              </button>
            }
          >
            <div className="space-y-0.5 max-h-[400px] overflow-y-auto custom-scrollbar" style={{ minWidth: '220px' }}>
              {/* 全部文件选项 */}
              <button
                onClick={() => {
                  onFilterByFormat?.(null);
                  closeDropdown();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all"
                style={{
                  background: !selectedFormat ? `${primaryColor}20` : 'transparent',
                  color: !selectedFormat ? primaryColor : '#ddd',
                }}
              >
                <FiFile size={14} />
                <span>全部文件</span>
                {!selectedFormat && (
                  <FiCheck size={14} className="ml-auto" style={{ color: primaryColor }} />
                )}
              </button>
              
              <div className="h-px bg-white/10 my-1" />
              
              {/* 详细类型分类 */}
              {Object.entries(FILE_CATEGORIES).map(([key, cat]) => {
                const Icon = cat.icon;
                const allExts = getCategoryExts(cat);
                const isExpanded = expandedCategories.has(key);
                const isCatSelected = isCategorySelected(cat);
                const hasSelectedFormat = cat.formats.some(f => isFormatSelected(f.ext));
                
                return (
                  <div key={key}>
                    {/* 主分类 */}
                    <div className="flex items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCategory(key); }}
                        className="p-1.5 rounded hover:bg-white/10"
                      >
                        {isExpanded ? 
                          <FiChevronDown size={12} style={{ color: cat.color }} /> : 
                          <FiChevronRight size={12} className="text-gray-500" />
                        }
                      </button>
                      <button
                        onClick={() => {
                          handleCategoryClick(allExts);
                          closeDropdown();
                        }}
                        className="flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-all hover:bg-white/10"
                        style={{
                          background: isCatSelected ? `${cat.color}20` : 'transparent',
                        }}
                      >
                        <Icon size={14} style={{ color: cat.color }} />
                        <span style={{ color: isCatSelected || hasSelectedFormat ? cat.color : '#ccc' }}>
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-auto">
                          {cat.formats.length}
                        </span>
                        {isCatSelected && (
                          <FiCheck size={12} style={{ color: cat.color }} />
                        )}
                      </button>
                    </div>
                    
                    {/* 展开的子格式 */}
                    {isExpanded && (
                      <div className="ml-6 space-y-0.5 border-l border-white/10 pl-2">
                        {cat.formats.map(format => {
                          const isSelected = selectedFormat === format.ext;
                          return (
                            <button
                              key={format.ext}
                              onClick={() => {
                                onFilterByFormat?.(isSelected ? null : format.ext);
                                closeDropdown();
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all hover:bg-white/10"
                              style={{
                                background: isSelected ? `${cat.color}20` : 'transparent',
                              }}
                            >
                              <span style={{ color: isSelected ? cat.color : '#888' }}>
                                {format.name}
                              </span>
                              <span className="text-[10px] text-gray-600 truncate flex-1">
                                {format.desc}
                              </span>
                              {isSelected && (
                                <FiCheck size={10} style={{ color: cat.color }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Dropdown>

          {/* 颜色筛选 - 支持多选 */}
          <Dropdown
            isOpen={activeDropdown === 'color'}
            onClose={() => {
              // 关闭时应用颜色筛选
              if (selectedColors.length > 0) {
                onFilterByColor(selectedColors);
              }
              closeDropdown();
            }}
            trigger={
              <button
                onClick={() => toggleDropdown('color')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm"
                style={{
                  background: selectedColors.length > 0 ? `${primaryColor}20` : 'transparent',
                  color: selectedColors.length > 0 ? primaryColor : '#999',
                }}
                title="按缩略图主题色筛选 (可多选)"
              >
                {selectedColors.length > 0 ? (
                  <div className="flex -space-x-1">
                    {selectedColors.slice(0, 3).map((c, i) => (
                      <div 
                        key={c}
                        className="w-4 h-4 rounded-full border border-white/30"
                        style={{ backgroundColor: c, zIndex: 3 - i }}
                      />
                    ))}
                    {selectedColors.length > 3 && (
                      <span className="text-xs ml-1">+{selectedColors.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <FiDroplet size={15} />
                )}
                <span>主题色{selectedColors.length > 0 ? ` (${selectedColors.length})` : ''}</span>
              </button>
            }
          >
            <div className="w-52">
              <div className="px-3 py-2 text-xs text-cyber-muted border-b border-white/10">
                按主题色筛选 (可多选)
              </div>
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                {COLOR_CATEGORIES.map(cat => {
                  const isSelected = selectedColors.includes(cat.color);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => {
                        // 切换颜色选择
                        const newColors = isSelected
                          ? selectedColors.filter(c => c !== cat.color)
                          : [...selectedColors, cat.color];
                        setSelectedColors(newColors);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all hover:bg-white/10"
                      style={{
                        background: isSelected ? `${cat.color}30` : 'transparent',
                        color: isSelected ? '#fff' : '#bbb',
                      }}
                    >
                      <div 
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        style={{ 
                          backgroundColor: cat.color,
                          borderColor: isSelected ? '#fff' : 'transparent',
                        }}
                      >
                        {isSelected && <FiCheck size={12} className="text-white" />}
                      </div>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-white/10 p-2 flex gap-2">
                <button
                  onClick={() => {
                    onFilterByColor(selectedColors.length > 0 ? selectedColors : null);
                    closeDropdown();
                  }}
                  className="flex-1 px-3 py-2 text-sm rounded-lg transition-all flex items-center gap-2 justify-center"
                  style={{ background: `${primaryColor}30`, color: primaryColor }}
                >
                  <FiCheck size={14} />
                  应用筛选
                </button>
                {selectedColors.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedColors([]);
                      onFilterByColor(null);
                      closeDropdown();
                    }}
                    className="px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
            </div>
          </Dropdown>

          {/* 排序 */}
          <Dropdown
            isOpen={activeDropdown === 'sort'}
            onClose={closeDropdown}
            trigger={
              <button
                onClick={() => toggleDropdown('sort')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm hover:bg-white/5"
                style={{ color: '#999' }}
              >
                <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.icon}</span>
                <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>
                <span style={{ color: primaryColor }}>{sortOrder === 'desc' ? '↓' : '↑'}</span>
              </button>
            }
          >
            <div className="space-y-1">
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value as FileFilters['sortBy'])}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all"
                  style={{
                    background: sortBy === option.value ? `${primaryColor}20` : 'transparent',
                    color: sortBy === option.value ? primaryColor : '#ddd',
                  }}
                >
                  <span>{option.icon}</span>
                  <span className="flex-1">{option.label}</span>
                  {sortBy === option.value && (
                    <span style={{ color: primaryColor }}>{sortOrder === 'desc' ? '↓ 降序' : '↑ 升序'}</span>
                  )}
                </button>
              ))}
            </div>
          </Dropdown>

          {/* 清除所有筛选 */}
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                onFilterByColor(null);
                onFilterByFormat?.(null);
                setSelectedColors([]);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all hover:bg-red-500/20"
              style={{ color: '#f87171' }}
            >
              <FiX size={12} />
              清除筛选 ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* 分隔线 */}
        <div className="h-6 w-px bg-white/10" />

        {/* 视图切换 */}
        <div 
          className="flex items-center rounded-lg p-0.5"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          {[
            { mode: 'grid' as ViewMode, icon: FiGrid, title: '网格视图' },
            { mode: 'masonry' as ViewMode, icon: BsGrid3X3Gap, title: '瀑布流' },
            { mode: 'list' as ViewMode, icon: FiList, title: '列表视图' },
          ].map(({ mode, icon: Icon, title }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className="p-2 rounded-md transition-all"
              title={title}
              style={{
                background: viewMode === mode ? `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` : 'transparent',
                color: viewMode === mode ? '#000' : '#666',
              }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        {/* 缩略图大小滑块 */}
        {viewMode !== 'list' && onThumbnailSizeChange && (
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg group relative"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            title={`缩略图: ${thumbnailSize}px`}
          >
            <FiGrid size={12} className="text-gray-500" />
            <input
              type="range"
              min="100"
              max="400"
              step="20"
              value={thumbnailSize}
              onChange={(e) => onThumbnailSizeChange(parseInt(e.target.value))}
              className="w-24 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${((thumbnailSize - 100) / 300) * 100}%, rgba(255,255,255,0.2) ${((thumbnailSize - 100) / 300) * 100}%, rgba(255,255,255,0.2) 100%)`,
              }}
            />
            <FiGrid size={16} style={{ color: primaryColor }} />
            {/* 大小提示 */}
            <div 
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] whitespace-nowrap px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,0,0,0.8)', color: primaryColor }}
            >
              {thumbnailSize}px
            </div>
          </div>
        )}

        {/* 全选/清除选择 */}
        {totalCount > 0 && (
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/10"
            style={{ 
              color: selectedCount === totalCount ? primaryColor : '#888',
              background: selectedCount === totalCount ? `${primaryColor}20` : 'transparent',
            }}
            title={selectedCount === totalCount ? '取消全选' : '全选当前页'}
          >
            <FiCheck size={14} />
            {selectedCount === totalCount ? '取消全选' : '全选'}
          </button>
        )}

        {/* 选择操作 */}
        {selectedCount > 0 && (
          <>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span 
                className="text-sm px-2 py-1 rounded"
                style={{ background: `${primaryColor}20`, color: primaryColor }}
              >
                已选 {selectedCount} 项
              </span>

              {/* 移动到 */}
              <Dropdown
                isOpen={activeDropdown === 'move'}
                onClose={closeDropdown}
                trigger={
                  <button
                    onClick={() => toggleDropdown('move')}
                    className="p-2 rounded-lg hover:bg-white/10 transition-all"
                    title="移动到文件夹"
                  >
                    <FiMove size={16} style={{ color: '#999' }} />
                  </button>
                }
              >
                <div className="max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { onMoveFiles(null); closeDropdown(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-white/10 transition-all text-cyber-text"
                  >
                    📁 根目录
                  </button>
                  {flattenFolders(folders).map(({ folder, depth }) => (
                    <button
                      key={folder.id}
                      onClick={() => { onMoveFiles(folder.id); closeDropdown(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-white/10 transition-all text-cyber-text"
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                    >
                      📁 {folder.name}
                    </button>
                  ))}
                </div>
              </Dropdown>

              {/* 添加标签 */}
              <Dropdown
                isOpen={activeDropdown === 'tag'}
                onClose={closeDropdown}
                trigger={
                  <button
                    onClick={() => toggleDropdown('tag')}
                    className="p-2 rounded-lg hover:bg-white/10 transition-all"
                    title="添加标签"
                  >
                    <FiTag size={16} style={{ color: '#999' }} />
                  </button>
                }
              >
                <div className="max-h-64 overflow-y-auto">
                  {tags.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-cyber-muted text-center">
                      暂无标签
                    </div>
                  ) : (
                    tags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => { onTagFiles(tag.id); closeDropdown(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-white/10 transition-all text-cyber-text"
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || '#888' }}
                        />
                        {tag.name}
                      </button>
                    ))
                  )}
                </div>
              </Dropdown>

              {/* 删除 */}
              <button
                onClick={onDeleteSelected}
                className="p-2 rounded-lg hover:bg-red-500/20 transition-all"
                title="删除选中"
              >
                <FiTrash2 size={16} className="text-red-400" />
              </button>
            </div>
          </>
        )}

        {/* 右侧用户区 */}
        <div className="ml-auto">
          {username && (
            <Dropdown
              isOpen={activeDropdown === 'user'}
              onClose={closeDropdown}
              align="right"
              trigger={
                <button
                  onClick={() => toggleDropdown('user')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      background: userSettings?.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    }}
                  >
                    {userSettings?.avatarUrl ? (
                      <img src={userSettings.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FiUser size={14} className="text-black" />
                    )}
                  </div>
                  <span className="text-sm text-cyber-text">{username}</span>
                  <FiChevronDown size={12} className="text-cyber-muted" />
                </button>
              }
            >
              <div className="w-56">
                {/* 用户信息 */}
                <div className="px-3 py-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                      style={{
                        background: userSettings?.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      }}
                    >
                      {userSettings?.avatarUrl ? (
                        <img src={userSettings.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FiUser size={18} className="text-black" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-cyber-text font-medium">{username}</div>
                      <div className="text-xs" style={{ color: primaryColor }}>在线</div>
                    </div>
                  </div>
                </div>

                {/* 服务器 */}
                {servers && servers.length > 0 && (
                  <div className="px-2 py-2 border-b border-white/10">
                    <div className="px-2 py-1 text-xs text-cyber-muted">连接的服务器</div>
                    {servers.map(server => (
                      <div
                        key={server.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
                      >
                        <FiServer size={12} style={{ color: server.isDefault ? primaryColor : '#666' }} />
                        <span className="text-cyber-text flex-1 truncate text-xs">{server.name}</span>
                        {server.isDefault && (
                          <span className="text-xs" style={{ color: primaryColor }}>默认</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 操作 */}
                <div className="p-2 space-y-1">
                  {onOpenSettings && (
                    <button
                      onClick={() => { closeDropdown(); onOpenSettings(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-all text-cyber-text"
                    >
                      <FiSettings size={16} />
                      个人设置
                    </button>
                  )}
                  <button
                    onClick={() => { closeDropdown(); onLogout?.(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-red-500/10 transition-all text-red-400"
                  >
                    <FiLogOut size={16} />
                    退出登录
                  </button>
                </div>
              </div>
            </Dropdown>
          )}
        </div>
      </div>
      
      {/* 高级搜索面板 */}
      <AdvancedSearchPanel
        isOpen={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onSearch={(filters) => {
          // 将高级搜索转换为标准搜索
          if (filters.search) {
            setSearchQuery(filters.search);
            onSearch(filters.search);
            // 保存搜索历史
            const newHistory = [filters.search, ...searchHistory.filter(h => h !== filters.search)].slice(0, 10);
            setSearchHistory(newHistory);
            localStorage.setItem('bk-search-history', JSON.stringify(newHistory));
          }
          // TODO: 应用其他过滤条件（文件大小、日期等）
        }}
      />
    </div>
  );
}
