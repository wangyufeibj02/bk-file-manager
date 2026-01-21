import { useState, memo, useRef } from 'react';
import { 
  FiFolder, 
  FiChevronRight, 
  FiChevronDown, 
  FiPlus, 
  FiTrash2,
  FiTag,
  FiFile,
  FiHome,
  FiClock,
  FiHardDrive,
  FiUser,
  FiSettings,
  FiUsers,
  FiZap,
  FiX,
  FiEdit3,
  FiMove
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

interface SidebarProps {
  folders: Folder[];
  tags: Tag[];
  selectedFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onMoveFolder?: (folderId: string, targetParentId: string | null, sortOrder?: number) => void;
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
  // 视图切换
  currentView?: 'files' | 'trash' | 'history';
  onViewChange?: (view: 'files' | 'trash' | 'history') => void;
}

export const Sidebar = memo(function Sidebar({
  folders,
  tags,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onMoveFolder,
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
  currentView = 'files',
  onViewChange,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['folders']));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedAllFiles, setExpandedAllFiles] = useState<boolean>(true); // 默认展开"全部文件"的文件夹列表
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showNewTag, setShowNewTag] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  
  // 拖拽状态
  const [draggedFolder, setDraggedFolder] = useState<Folder | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'inside' | 'after' | null>(null);
  const dragCounterRef = useRef(0);

  const primaryColor = userSettings?.primaryColor || '#00ffff';
  const secondaryColor = userSettings?.secondaryColor || '#ff00ff';
  
  // 将hex颜色转换为rgba格式（用于滚动条）
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const scrollbarPrimary40 = hexToRgba(primaryColor, 0.4);
  const scrollbarSecondary40 = hexToRgba(secondaryColor, 0.4);
  const scrollbarPrimary60 = hexToRgba(primaryColor, 0.6);
  const scrollbarSecondary60 = hexToRgba(secondaryColor, 0.6);
  const scrollbarPrimary80 = hexToRgba(primaryColor, 0.8);
  const scrollbarSecondary80 = hexToRgba(secondaryColor, 0.8);

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

  const handleStartEditFolder = (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleSaveFolder = (folderId: string) => {
    const trimmedName = editingFolderName.trim();
    if (trimmedName && onRenameFolder) {
      onRenameFolder(folderId, trimmedName);
    }
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleCancelEditFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  // 拖拽处理函数
  const handleDragStart = (e: React.DragEvent, folder: Folder) => {
    e.stopPropagation();
    setDraggedFolder(folder);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', folder.id);
  };

  const handleDragEnd = () => {
    setDraggedFolder(null);
    setDragOverFolder(null);
    setDragOverPosition(null);
    dragCounterRef.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (draggedFolder && draggedFolder.id !== folderId) {
      setDragOverFolder(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragOverFolder(null);
      setDragOverPosition(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedFolder || draggedFolder.id === folder.id) return;
    
    // 检查是否拖到自己的子文件夹下
    const isDescendant = (parent: Folder, targetId: string): boolean => {
      if (!parent.children) return false;
      for (const child of parent.children) {
        if (child.id === targetId) return true;
        if (isDescendant(child, targetId)) return true;
      }
      return false;
    };
    
    if (isDescendant(draggedFolder, folder.id)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // 根据鼠标位置确定放置位置
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    if (y < height * 0.25) {
      setDragOverPosition('before');
    } else if (y > height * 0.75) {
      setDragOverPosition('after');
    } else {
      setDragOverPosition('inside');
    }
  };

  const handleDrop = (e: React.DragEvent, targetFolder: Folder, parentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedFolder || draggedFolder.id === targetFolder.id || !onMoveFolder) {
      handleDragEnd();
      return;
    }
    
    // 检查是否拖到自己的子文件夹下
    const isDescendant = (parent: Folder, targetId: string): boolean => {
      if (!parent.children) return false;
      for (const child of parent.children) {
        if (child.id === targetId) return true;
        if (isDescendant(child, targetId)) return true;
      }
      return false;
    };
    
    if (isDescendant(draggedFolder, targetFolder.id)) {
      handleDragEnd();
      return;
    }
    
    if (dragOverPosition === 'inside') {
      // 移动到目标文件夹内部
      onMoveFolder(draggedFolder.id, targetFolder.id);
    } else {
      // 移动到目标文件夹的同级
      const newSortOrder = dragOverPosition === 'before' 
        ? (targetFolder.sortOrder ?? 0) 
        : (targetFolder.sortOrder ?? 0) + 1;
      onMoveFolder(draggedFolder.id, parentId, newSortOrder);
    }
    
    handleDragEnd();
  };

  const renderFolder = (folder: Folder, depth = 0, parentId: string | null = null) => {
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolder === folder.id;
    const isEditing = editingFolderId === folder.id;
    const isDragging = draggedFolder?.id === folder.id;
    const isDragOver = dragOverFolder === folder.id;

    return (
      <div key={folder.id} className="relative">
        {/* 拖拽指示器 - 上方 */}
        {isDragOver && dragOverPosition === 'before' && (
          <div 
            className="absolute left-0 right-0 h-0.5 z-10"
            style={{ 
              top: 0,
              marginLeft: `${depth * 12}px`,
              background: primaryColor,
            }}
          />
        )}
        
        <div
          draggable={!isEditing && !!onMoveFolder}
          onDragStart={(e) => handleDragStart(e, folder)}
          onDragEnd={handleDragEnd}
          onDragEnter={(e) => handleDragEnter(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => handleDragOver(e, folder)}
          onDrop={(e) => handleDrop(e, folder, parentId)}
          className={`group flex items-center gap-1 px-2 py-1 cursor-pointer transition-all rounded-md ${
            isDragging ? 'opacity-40' : 'hover:bg-white/5'
          }`}
          style={{ 
            marginLeft: `${depth * 12}px`,
            background: isDragOver && dragOverPosition === 'inside' 
              ? `${primaryColor}25` 
              : isSelected 
                ? `${primaryColor}15` 
                : 'transparent',
            border: isDragOver && dragOverPosition === 'inside' 
              ? `1px dashed ${primaryColor}` 
              : '1px solid transparent',
          }}
          onClick={() => !isEditing && onFolderSelect(folder.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }}
              className="p-0.5 rounded hover:bg-white/10"
            >
              {isExpanded ? 
                <FiChevronDown size={10} style={{ color: primaryColor }} /> : 
                <FiChevronRight size={10} className="text-gray-500" />
              }
            </button>
          ) : (
            <span className="w-3" />
          )}
          <FiFolder size={12} style={{ color: isSelected ? primaryColor : (folder.color || '#666') }} />
          
          {isEditing ? (
            <input
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveFolder(folder.id);
                if (e.key === 'Escape') handleCancelEditFolder();
              }}
              onBlur={() => handleSaveFolder(folder.id)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-1 py-0.5 bg-black/40 border border-white/20 rounded text-xs text-white focus:outline-none focus:border-cyan-500"
              autoFocus
            />
          ) : (
            <span 
              className="flex-1 truncate text-xs"
              style={{ color: isSelected ? primaryColor : '#aaa' }}
              onDoubleClick={(e) => handleStartEditFolder(e, folder)}
            >
              {folder.name}
            </span>
          )}
          
          {!isEditing && folder._count && folder._count.files > 0 && (
            <span className="text-xs text-gray-500">{folder._count.files}</span>
          )}
          
          {!isEditing && (
            <>
              <button
                onClick={(e) => handleStartEditFolder(e, folder)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                title="重命名"
              >
                <FiEdit3 size={10} style={{ color: primaryColor }} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`删除 "${folder.name}"？`)) onDeleteFolder(folder.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
                title="删除"
              >
                <FiTrash2 size={10} className="text-red-400" />
              </button>
            </>
          )}
        </div>
        
        {/* 拖拽指示器 - 下方 */}
        {isDragOver && dragOverPosition === 'after' && (
          <div 
            className="absolute left-0 right-0 h-0.5 z-10"
            style={{ 
              bottom: 0,
              marginLeft: `${depth * 12}px`,
              background: primaryColor,
            }}
          />
        )}
        
        {hasChildren && isExpanded && folder.children!.map(child => renderFolder(child, depth + 1, folder.id))}
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

      {/* 快捷导航 - 固定区域 */}
      <div className="px-2 py-2 border-b border-white/5 flex-shrink-0">
        {/* 全部文件 + 展开/折叠 + 新建文件夹按钮 */}
        <div>
          <div className="flex items-center">
            <button
              onClick={() => setExpandedAllFiles(!expandedAllFiles)}
              className="p-0.5 rounded hover:bg-white/10 transition-all mr-1"
              title={expandedAllFiles ? '折叠文件夹' : '展开文件夹'}
            >
              {expandedAllFiles ? 
                <FiChevronDown size={12} style={{ color: primaryColor }} /> : 
                <FiChevronRight size={12} className="text-gray-500" />
              }
            </button>
            <button
              onClick={() => { onFolderSelect(null); onFilterByFormat?.(null); }}
              className="flex-1 flex items-center gap-2 px-2 py-2 rounded-lg transition-all"
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
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="p-1.5 rounded hover:bg-white/10 transition-all"
              title="新建文件夹"
            >
              <FiPlus size={14} style={{ color: primaryColor }} />
            </button>
          </div>
          
          {/* 文件夹子列表 - 显示在"全部文件"下面，只显示顶级文件夹 */}
          {expandedAllFiles && folders.length > 0 && (
            <div className="ml-6 mt-1 space-y-0.5">
              {folders
                .filter(folder => !folder.parentId) // 只显示顶级文件夹（没有parentId的）
                .map(folder => renderFolder(folder, 0))}
            </div>
          )}
          
          {/* 新建文件夹输入框 - 在文件夹列表下方 */}
          {expandedAllFiles && showNewFolder && (
            <div className="ml-6 mt-1 flex gap-1 px-2 py-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
                }}
                placeholder="文件夹名称"
                className="flex-1 px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="px-1.5 rounded"
                style={{ background: primaryColor, color: '#000' }}
              >
                <FiPlus size={12} />
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
                className="px-1.5 rounded bg-gray-600 text-white"
              >
                <FiX size={12} />
              </button>
            </div>
          )}
        </div>
        
        {/* 扫描导入 */}
        <button
          onClick={onScanClick}
          className="w-full flex items-center gap-2 px-2 py-2 mt-2 rounded-lg transition-all hover:bg-white/5"
        >
          <FiHardDrive size={14} className="text-gray-400" />
          <span className="text-sm text-gray-400">扫描导入</span>
        </button>
      </div>

      {/* 滚动区域 - 包含标签 */}
      <div 
        className="flex-1 overflow-y-auto sidebar-scroll min-h-0"
        style={{
          '--scrollbar-primary-40': scrollbarPrimary40,
          '--scrollbar-secondary-40': scrollbarSecondary40,
          '--scrollbar-primary-60': scrollbarPrimary60,
          '--scrollbar-secondary-60': scrollbarSecondary60,
          '--scrollbar-primary-80': scrollbarPrimary80,
          '--scrollbar-secondary-80': scrollbarSecondary80,
          '--scrollbar-primary': primaryColor,
        } as React.CSSProperties & Record<string, string>}
      >
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

        {/* 历史记录 - 点击在主内容区显示 */}
        <div className="border-b border-white/5">
          <button
            onClick={() => onViewChange?.('history')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 transition-all ${
              currentView === 'history' ? '' : 'hover:bg-white/5'
            }`}
            style={{
              background: currentView === 'history' ? `${primaryColor}15` : 'transparent',
            }}
          >
            <FiClock 
              size={14} 
              style={{ color: currentView === 'history' ? primaryColor : '#666' }} 
            />
            <span 
              className="flex-1 text-left text-sm"
              style={{ color: currentView === 'history' ? primaryColor : '#ccc' }}
            >
              历史记录
            </span>
            {historyRecords.length > 0 && (
              <span 
                className="px-1.5 py-0.5 text-xs rounded-full"
                style={{ 
                  background: currentView === 'history' ? `${primaryColor}30` : 'rgba(255,255,255,0.1)',
                  color: currentView === 'history' ? primaryColor : '#888'
                }}
              >
                {historyRecords.length}
              </span>
            )}
          </button>
        </div>

        {/* 回收站 - 点击在主内容区显示 */}
        <div className="border-b border-white/5">
          <button
            onClick={() => onViewChange?.('trash')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 transition-all ${
              currentView === 'trash' ? '' : 'hover:bg-white/5'
            }`}
            style={{
              background: currentView === 'trash' ? `${primaryColor}15` : 'transparent',
            }}
          >
            <FiTrash2 
              size={14} 
              style={{ color: currentView === 'trash' ? primaryColor : '#666' }} 
            />
            <span 
              className="flex-1 text-left text-sm"
              style={{ color: currentView === 'trash' ? primaryColor : '#ccc' }}
            >
              回收站
            </span>
            {trashItems.length > 0 && (
              <span 
                className="px-1.5 py-0.5 text-xs rounded-full"
                style={{ 
                  background: currentView === 'trash' ? `${primaryColor}30` : 'rgba(255,255,255,0.1)',
                  color: currentView === 'trash' ? primaryColor : '#888'
                }}
              >
                {trashItems.length}
              </span>
            )}
          </button>
        </div>
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
