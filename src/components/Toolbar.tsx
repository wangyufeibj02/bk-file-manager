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
  FiUser,
  FiLogOut,
  FiServer,
  FiSettings,
  FiX,
  FiCheck
} from 'react-icons/fi';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { ViewMode, FileFilters, Folder, Tag, UserSettings } from '../types';

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
    filters.mimeType,
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件名..."
            className="w-full pl-10 pr-10 py-2.5 bg-black/40 border rounded-lg text-sm text-cyber-text placeholder-cyber-muted focus:outline-none transition-all"
            style={{
              borderColor: searchQuery ? primaryColor : 'rgba(255,255,255,0.1)',
              boxShadow: searchQuery ? `0 0 10px ${primaryColor}30` : 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
            >
              <FiX size={14} className="text-cyber-muted" />
            </button>
          )}
        </div>

        {/* 分隔线 */}
        <div className="h-6 w-px bg-white/10" />

        {/* 筛选按钮组 */}
        <div className="flex items-center gap-1">
          {/* 类型筛选 */}
          <Dropdown
            isOpen={activeDropdown === 'type'}
            onClose={closeDropdown}
            trigger={
              <button
                onClick={() => toggleDropdown('type')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm"
                style={{
                  background: filters.mimeType ? `${primaryColor}20` : 'transparent',
                  color: filters.mimeType ? primaryColor : '#999',
                }}
              >
                <FiFilter size={15} />
                <span>{filters.mimeType ? FILE_TYPES.find(t => t.value === filters.mimeType)?.label : '类型'}</span>
              </button>
            }
          >
            <div className="space-y-1">
              {FILE_TYPES.map(type => (
                <button
                  key={type.value || 'all'}
                  onClick={() => {
                    onFilterByType(type.value);
                    closeDropdown();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all"
                  style={{
                    background: filters.mimeType === type.value ? `${primaryColor}20` : 'transparent',
                    color: filters.mimeType === type.value ? primaryColor : '#ddd',
                  }}
                >
                  <span className="text-base">{type.icon}</span>
                  <span>{type.label}</span>
                  {filters.mimeType === type.value && (
                    <FiCheck size={14} className="ml-auto" style={{ color: primaryColor }} />
                  )}
                </button>
              ))}
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
                onFilterByType(null);
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
    </div>
  );
}
