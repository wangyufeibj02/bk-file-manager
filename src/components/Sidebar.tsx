import { useState, useEffect, memo, useCallback } from 'react';
import { 
  FiFolder, 
  FiChevronRight, 
  FiChevronDown, 
  FiPlus, 
  FiTrash2,
  FiTag,
  FiImage,
  FiVideo,
  FiMusic,
  FiFile,
  FiHome,
  FiClock,
  FiHardDrive,
  FiBox,
  FiTool,
  FiUser,
  FiSettings,
  FiUsers,
  FiZap,
  FiX,
  FiFilter,
  FiRotateCcw,
  FiEdit3,
  FiMove,
  FiEye,
  FiStar,
  FiRefreshCw
} from 'react-icons/fi';
import { Folder, Tag, User, UserSettings, HistoryRecord, TrashItem, HistoryAction } from '../types';

// 历史操作信息
const getActionInfo = (action: HistoryAction | string) => {
  const actionMap: Record<string, { icon: any; label: string; color: string }> = {
    view: { icon: FiEye, label: '浏览', color: '#3b82f6' },
    edit: { icon: FiEdit3, label: '编辑', color: '#f97316' },
    rename: { icon: FiEdit3, label: '重命名', color: '#eab308' },
    move: { icon: FiMove, label: '移动', color: '#8b5cf6' },
    tag: { icon: FiTag, label: '标签', color: '#22c55e' },
    rate: { icon: FiStar, label: '评分', color: '#f59e0b' },
    delete: { icon: FiTrash2, label: '删除', color: '#ef4444' },
    restore: { icon: FiRefreshCw, label: '恢复', color: '#10b981' },
  };
  return actionMap[action] || { icon: FiFile, label: action, color: '#666' };
};

// 格式化历史详情
const formatHistoryDetails = (action: string, details: Record<string, any>) => {
  switch (action) {
    case 'rename':
      return `→ ${details.to}`;
    case 'move':
      return `→ ${details.toFolder}`;
    case 'tag':
      return `+ ${details.tag}`;
    case 'rate':
      return `→ ${details.to}★`;
    default:
      return '';
  }
};

// 格式化时间
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 格式化文件大小
const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

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
      { ext: 'dwg,dxf', name: 'CAD', desc: 'AutoCAD文件' },
    ]
  }
};

interface SidebarProps {
  folders: Folder[];
  tags: Tag[];
  selectedFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateTag: (name: string, color?: string) => void;
  onDeleteTag?: (tagId: string) => void;
  onFilterByTag: (tagIds: string[]) => void;
  onScanClick: () => void;
  onFilterByFormat?: (format: string | null) => void;
  selectedFormat?: string | null;
  currentUser?: User | null;
  userSettings?: UserSettings;
  onOpenSettings?: () => void;
  onOpenAdminPanel?: () => void;
  // History & Trash
  historyRecords?: HistoryRecord[];
  trashItems?: TrashItem[];
  onLoadHistory?: () => void;
  onLoadTrash?: () => void;
  onRestoreFromTrash?: (id: string) => void;
  onDeleteFromTrash?: (id: string) => void;
  onEmptyTrash?: () => void;
  onClearHistory?: () => void;
}

export const Sidebar = memo(function Sidebar({
  folders,
  tags,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  onDeleteFolder,
  onCreateTag,
  onDeleteTag,
  onFilterByTag,
  onScanClick,
  onFilterByFormat,
  selectedFormat,
  currentUser,
  userSettings,
  onOpenSettings,
  onOpenAdminPanel,
  historyRecords = [],
  trashItems = [],
  onLoadHistory,
  onLoadTrash,
  onRestoreFromTrash,
  onDeleteFromTrash,
  onEmptyTrash,
  onClearHistory,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['folders', 'types']));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showNewTag, setShowNewTag] = useState(false);

  // 切换类型分类展开
  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 获取类型的所有格式扩展名
  const getCategoryExts = (cat: typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES]) => {
    return cat.formats.map(f => f.ext).join(',');
  };

  // 检查某个格式是否被选中
  const isFormatSelected = (ext: string) => {
    if (!selectedFormat) return false;
    const selectedExts = selectedFormat.split(',').map(e => e.toLowerCase().trim());
    const formatExts = ext.split(',').map(e => e.toLowerCase().trim());
    return formatExts.some(e => selectedExts.includes(e));
  };

  // 检查某个分类是否被选中（全部或部分）
  const isCategorySelected = (cat: typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES]) => {
    if (!selectedFormat) return false;
    const allExts = getCategoryExts(cat);
    return selectedFormat === allExts;
  };

  const primaryColor = userSettings?.primaryColor || '#00ffff';
  const secondaryColor = userSettings?.secondaryColor || '#ff00ff';

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleTagClick = (tagId: string) => {
    const newSelected = selectedTags.includes(tagId)
      ? selectedTags.filter(id => id !== tagId)
      : [...selectedTags, tagId];
    setSelectedTags(newSelected);
    onFilterByTag(newSelected);
  };

  const handleCategoryClick = (exts: string) => {
    if (onFilterByFormat) {
      onFilterByFormat(selectedFormat === exts ? null : exts);
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      const colors = ['#4a9eff', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'];
      onCreateTag(newTagName.trim(), colors[Math.floor(Math.random() * colors.length)]);
      setNewTagName('');
      setShowNewTag(false);
    }
  };

  const renderFolder = (folder: Folder, depth = 0) => {
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolder === folder.id;

    return (
      <div key={folder.id}>
        <div
          className="group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all rounded-md mx-1"
          style={{ 
            marginLeft: `${4 + depth * 12}px`,
            background: isSelected ? `${primaryColor}15` : 'transparent',
          }}
          onClick={() => onFolderSelect(folder.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }}
              className="p-0.5 rounded hover:bg-white/10"
            >
              {isExpanded ? 
                <FiChevronDown size={12} style={{ color: primaryColor }} /> : 
                <FiChevronRight size={12} className="text-gray-500" />
              }
            </button>
          ) : (
            <span className="w-4" />
          )}
          <FiFolder size={14} style={{ color: isSelected ? primaryColor : (folder.color || '#666') }} />
          <span 
            className="flex-1 truncate text-sm"
            style={{ color: isSelected ? primaryColor : '#ccc' }}
          >
            {folder.name}
          </span>
          {folder._count && folder._count.files > 0 && (
            <span className="text-xs text-gray-500">{folder._count.files}</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`删除 "${folder.name}"？`)) onDeleteFolder(folder.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
          >
            <FiTrash2 size={11} className="text-red-400" />
          </button>
        </div>
        {hasChildren && isExpanded && folder.children!.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  // 侧边栏区块组件
  const Section = ({ 
    id, 
    title, 
    icon: Icon, 
    children, 
    action 
  }: { 
    id: string; 
    title: string; 
    icon: any; 
    children: React.ReactNode;
    action?: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className="border-b border-white/5">
        <div className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-all">
          <div 
            onClick={() => toggleSection(id)}
            className="flex items-center gap-2 flex-1 cursor-pointer"
          >
            {isExpanded ? 
              <FiChevronDown size={12} style={{ color: primaryColor }} /> : 
              <FiChevronRight size={12} className="text-gray-500" />
            }
            <Icon size={14} style={{ color: primaryColor }} />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider flex-1 text-left">
              {title}
            </span>
          </div>
          {action}
        </div>
        {isExpanded && <div className="pb-2">{children}</div>}
      </div>
    );
  };

  return (
    <aside 
      className="w-60 flex flex-col h-full overflow-hidden"
      style={{ 
        background: 'rgba(8, 8, 12, 0.95)',
        borderRight: `1px solid ${primaryColor}20`,
      }}
    >
      {/* Logo */}
      <div 
        className="p-4 border-b flex items-center gap-3"
        style={{ borderColor: `${primaryColor}20` }}
      >
        <div 
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}40, ${secondaryColor}40)` }}
        >
          <FiZap size={18} style={{ color: primaryColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: primaryColor }}>百科交互</div>
          <div className="text-[10px] text-gray-500 tracking-wider">FILE SYSTEM</div>
        </div>
      </div>

      {/* 用户 */}
      {currentUser && (
        <div 
          className="px-3 py-2 border-b flex items-center gap-2"
          style={{ borderColor: `${primaryColor}10` }}
        >
          <div 
            className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{
              background: userSettings?.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            }}
          >
            {userSettings?.avatarUrl ? (
              <img src={userSettings.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <FiUser size={12} className="text-black" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-300 truncate">{currentUser.username}</div>
            <div 
              className="text-[10px]"
              style={{ color: currentUser.role === 'admin' ? primaryColor : '#666' }}
            >
              {currentUser.role === 'admin' ? '管理员' : '用户'}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {currentUser.role === 'admin' && onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="p-1.5 rounded hover:bg-white/10 transition-all"
                title="用户管理"
              >
                <FiUsers size={13} style={{ color: secondaryColor }} />
              </button>
            )}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 rounded hover:bg-white/10 transition-all"
                title="设置"
              >
                <FiSettings size={13} style={{ color: primaryColor }} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 快捷导航 */}
      <div className="px-2 py-2 border-b border-white/5">
        <button
          onClick={() => { onFolderSelect(null); onFilterByFormat?.(null); }}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all"
          style={{
            background: !selectedFolder && !selectedFormat ? `${primaryColor}15` : 'transparent',
          }}
        >
          <FiHome size={14} style={{ color: !selectedFolder && !selectedFormat ? primaryColor : '#666' }} />
          <span 
            className="text-sm"
            style={{ color: !selectedFolder && !selectedFormat ? primaryColor : '#aaa' }}
          >
            全部文件
          </span>
        </button>
        <button
          onClick={onScanClick}
          className="w-full flex items-center gap-2 px-2 py-2 mt-1 rounded-lg transition-all"
          style={{ 
            background: `${primaryColor}10`,
            border: `1px solid ${primaryColor}30`,
          }}
        >
          <FiHardDrive size={14} style={{ color: primaryColor }} />
          <span className="text-sm" style={{ color: primaryColor }}>扫描文件夹</span>
        </button>
      </div>

      {/* 滚动区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* 文件类型 */}
        <Section id="types" title="类型" icon={FiFilter}>
          <div className="px-1 space-y-0.5">
            {Object.entries(FILE_CATEGORIES).map(([key, cat]) => {
              const Icon = cat.icon;
              const allExts = getCategoryExts(cat);
              const isExpanded = expandedCategories.has(key);
              const isCatSelected = isCategorySelected(cat);
              const hasSelectedFormat = cat.formats.some(f => isFormatSelected(f.ext));
              
              return (
                <div key={key}>
                  {/* 主分类 */}
                  <div className="flex items-center gap-1">
                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={() => toggleCategory(key)}
                      className="p-1.5 rounded hover:bg-white/10 active:bg-white/20 cursor-pointer select-none"
                    >
                      {isExpanded ? 
                        <FiChevronDown size={12} style={{ color: cat.color }} /> : 
                        <FiChevronRight size={12} className="text-gray-500" />
                      }
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={() => handleCategoryClick(allExts)}
                      className="flex-1 flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left cursor-pointer hover:bg-white/10 active:bg-white/20 select-none"
                      style={{
                        background: isCatSelected ? `${cat.color}20` : 'transparent',
                      }}
                    >
                      <Icon size={13} style={{ color: cat.color }} />
                      <span 
                        className="text-sm flex-1"
                        style={{ color: isCatSelected || hasSelectedFormat ? cat.color : '#999' }}
                      >
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {cat.formats.length}
                      </span>
                    </div>
                    {(isCatSelected || hasSelectedFormat) && (
                      <div
                        role="button"
                        tabIndex={0}
                        onMouseDown={() => onFilterByFormat?.(null)}
                        className="p-1.5 rounded hover:bg-white/10 active:bg-white/20 cursor-pointer select-none"
                      >
                        <FiX size={12} style={{ color: cat.color }} />
                      </div>
                    )}
                  </div>
                  
                  {/* 格式分支 */}
                  {isExpanded && (
                    <div className="ml-5 mt-1 space-y-1 border-l border-white/5 pl-2">
                      {cat.formats.map(format => {
                        const isSelected = isFormatSelected(format.ext);
                        return (
                          <div
                            key={format.ext}
                            role="button"
                            tabIndex={0}
                            onMouseDown={() => onFilterByFormat?.(isSelected ? null : format.ext)}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors cursor-pointer hover:bg-white/10 active:bg-white/20 select-none"
                            style={{
                              background: isSelected ? `${cat.color}20` : 'transparent',
                            }}
                          >
                            <span 
                              className="text-xs font-medium min-w-[40px]"
                              style={{ color: isSelected ? cat.color : '#888' }}
                            >
                              {format.name}
                            </span>
                            <span className="text-[10px] text-gray-600 truncate flex-1">
                              {format.desc}
                            </span>
                            {isSelected && (
                              <FiX size={10} style={{ color: cat.color }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* 文件夹 */}
        <Section 
          id="folders" 
          title="文件夹" 
          icon={FiFolder}
          action={
            <button
              onClick={(e) => { e.stopPropagation(); setShowNewFolder(!showNewFolder); }}
              className="p-1 rounded hover:bg-white/10"
            >
              <FiPlus size={12} style={{ color: primaryColor }} />
            </button>
          }
        >
          {showNewFolder && (
            <div className="mx-2 mb-2 flex gap-1">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="文件夹名称"
                className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="px-2 rounded"
                style={{ background: primaryColor, color: '#000' }}
              >
                <FiPlus size={14} />
              </button>
            </div>
          )}
          {folders.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              暂无文件夹
            </div>
          ) : (
            folders.map(folder => renderFolder(folder))
          )}
        </Section>

        {/* 标签 */}
        <Section 
          id="tags" 
          title="标签" 
          icon={FiTag}
          action={
            <button
              onClick={(e) => { e.stopPropagation(); setShowNewTag(!showNewTag); }}
              className="p-1 rounded hover:bg-white/10"
            >
              <FiPlus size={12} style={{ color: primaryColor }} />
            </button>
          }
        >
          {showNewTag && (
            <div className="mx-2 mb-2 flex gap-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                placeholder="标签名称"
                className="flex-1 px-2 py-1.5 bg-black/40 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <button
                onClick={handleCreateTag}
                className="px-2 rounded"
                style={{ background: primaryColor, color: '#000' }}
              >
                <FiPlus size={14} />
              </button>
            </div>
          )}
          {tags.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              暂无标签
            </div>
          ) : (
            <div className="px-2 flex flex-wrap gap-1.5">
              {tags.map(tag => {
                const isActive = selectedTags.includes(tag.id);
                return (
                  <div
                    key={tag.id}
                    className="group relative flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all cursor-pointer"
                    style={{
                      background: isActive ? `${tag.color}30` : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isActive ? tag.color : 'transparent'}`,
                      color: isActive ? tag.color : '#999',
                    }}
                    onClick={() => handleTagClick(tag.id)}
                  >
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ background: tag.color || '#888' }}
                    />
                    {tag.name}
                    {tag._count && tag._count.files > 0 && (
                      <span className="text-gray-500">{tag._count.files}</span>
                    )}
                    {/* 删除按钮 */}
                    {onDeleteTag && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTag(tag.id);
                        }}
                        className="ml-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 
                          hover:bg-red-500/30 transition-all"
                        title="删除标签"
                      >
                        <FiX size={10} className="text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 分隔线 */}
        <div className="my-2 mx-3 border-t border-white/10" />

        {/* 历史记录 */}
        <Section 
          id="history" 
          title="历史记录" 
          icon={FiClock}
          action={
            historyRecords.length > 0 && onClearHistory ? (
              <button
                onClick={(e) => { e.stopPropagation(); onClearHistory(); }}
                className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400"
                title="清空历史"
              >
                <FiTrash2 size={12} />
              </button>
            ) : undefined
          }
        >
          {historyRecords.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              <FiClock size={24} className="mx-auto mb-2 opacity-50" />
              <div>浏览和编辑记录将显示在这里</div>
            </div>
          ) : (
            <div className="px-2 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {historyRecords.slice(0, 20).map(record => {
                const actionInfo = getActionInfo(record.action);
                const ActionIcon = actionInfo.icon;
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-all group"
                  >
                    <ActionIcon 
                      size={12} 
                      style={{ color: actionInfo.color, flexShrink: 0 }} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-300 truncate">
                        {record.fileName}
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span>{actionInfo.label}</span>
                        {record.details && (
                          <span className="truncate">
                            {formatHistoryDetails(record.action, record.details)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-600 whitespace-nowrap">
                      {formatTime(record.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 回收站 */}
        <Section 
          id="trash" 
          title={`回收站 ${trashItems.length > 0 ? `(${trashItems.length})` : ''}`}
          icon={FiRotateCcw}
          action={
            trashItems.length > 0 && onEmptyTrash ? (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (confirm('确定要清空回收站吗？此操作不可恢复！')) {
                    onEmptyTrash();
                  }
                }}
                className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400"
                title="清空回收站"
              >
                <FiTrash2 size={12} />
              </button>
            ) : undefined
          }
        >
          {trashItems.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              <FiTrash2 size={24} className="mx-auto mb-2 opacity-50" />
              <div>已删除的文件将保留在这里</div>
            </div>
          ) : (
            <div className="px-2 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {trashItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-all group"
                >
                  <FiFile size={12} className="text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate">
                      {item.originalName}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {item.folderName || '根目录'} · {formatSize(item.size)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onRestoreFromTrash && (
                      <button
                        onClick={() => onRestoreFromTrash(item.id)}
                        className="p-1 rounded hover:bg-green-500/20"
                        title="恢复"
                      >
                        <FiRefreshCw size={11} className="text-green-400" />
                      </button>
                    )}
                    {onDeleteFromTrash && (
                      <button
                        onClick={() => {
                          if (confirm('确定要永久删除吗？')) {
                            onDeleteFromTrash(item.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-red-500/20"
                        title="永久删除"
                      >
                        <FiTrash2 size={11} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* 底部 */}
      <div 
        className="px-3 py-2 text-[10px] text-gray-600 text-center border-t"
        style={{ borderColor: `${primaryColor}10` }}
      >
        百科交互 v2.0
      </div>
    </aside>
  );
});
