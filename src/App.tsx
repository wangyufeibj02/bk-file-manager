import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { FileGrid } from './components/FileGrid';
import { TrashGrid } from './components/TrashGrid';
import { HistoryGrid } from './components/HistoryGrid';
import { FilePreview } from './components/FilePreview';
import { UploadZone } from './components/UploadZone';
import { ScanDialog } from './components/ScanDialog';
import { LoginPage } from './components/LoginPage';
import { DynamicBackground } from './components/DynamicBackground';
import { UserSettingsPanel } from './components/UserSettingsPanel';
import { AdminUserPanel } from './components/AdminUserPanel';
import { ToastProvider, showToast } from './components/Toast';
import { ConfirmDialog, useConfirm } from './components/ConfirmDialog';
import { useApi, setToken, clearToken } from './hooks/useApi';
import { useHotkeys } from './hooks/useHotkeys';
import { useResponsiveScale } from './hooks/useResponsiveScale';
import { FileItem, Folder, Tag, FileFilters, ViewMode, User, UserSettings, Pagination, HistoryRecord, TrashItem } from './types';

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  servers: ServerConfig[];
}

const DEFAULT_SETTINGS: UserSettings = {
  backgroundEffect: 'particles',
  primaryColor: '#00ffff',
  secondaryColor: '#ff00ff',
  avatarUrl: '',
};

function App() {
  const api = useApi();
  const { confirm, dialogProps } = useConfirm();
  
  // 响应式缩放 - 根据窗口大小自动调整
  useResponsiveScale(1920, 0.75, 1.15);
  
  // Auth State - token is read from localStorage by useApi's getToken()
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('bkAuth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token && parsed.user) {
          return { 
            isLoggedIn: true, 
            user: parsed.user,
            servers: parsed.servers || []
          };
        }
      } catch {
        // ignore
      }
    }
    return { isLoggedIn: false, user: null, servers: [] };
  });

  // User Settings
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('bkUserSettings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // UI Panels
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [filters, setFilters] = useState<FileFilters>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [thumbnailSize, setThumbnailSize] = useState<number>(() => {
    const saved = localStorage.getItem('bkThumbnailSize');
    return saved ? parseInt(saved) : 200;
  });
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadingMore, setLoadingMore] = useState(false); // 是否正在加载更多
  const [allFiles, setAllFiles] = useState<FileItem[]>([]); // 所有已加载的文件（无限滚动模式）
  
  // 根据缩略图大小动态计算每页数量
  // 假设屏幕宽度约 1600px 可用，高度约 800px 可用
  // 列数 = floor(1600 / thumbnailSize)
  // 行数 = floor(800 / (thumbnailSize * 1.3)) // 1.3 是卡片高度比例
  // 每页数量 = 列数 * 行数 * 1.5 (多加载一些以确保填满)
  const calculatePageSize = (size: number) => {
    const cols = Math.floor(1600 / size);
    const rows = Math.floor(800 / (size * 1.3));
    const calculated = Math.max(12, Math.floor(cols * rows * 1.5));
    // 限制在合理范围内
    return Math.min(Math.max(calculated, 12), 200);
  };
  
  const pageSize = calculatePageSize(thumbnailSize);
  
  // History & Trash
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  
  // 当前视图 ('files' | 'trash' | 'history')
  const [currentView, setCurrentView] = useState<'files' | 'trash' | 'history'>('files');
  
  // 悬浮文件引用（用于快捷键）
  const hoveredFileRef = useRef<FileItem | null>(null);
  
  const handleHoverFile = useCallback((file: FileItem | null) => {
    hoveredFileRef.current = file;
  }, []);

  // 快捷键处理
  useHotkeys([
    // 空格键预览
    {
      key: 'Space',
      handler: () => {
        if (previewFile) {
          setPreviewFile(null);
        } else {
          // 优先预览悬浮的文件
          if (hoveredFileRef.current) {
            setPreviewFile(hoveredFileRef.current);
            setSelectedFiles([hoveredFileRef.current.id]);
          } else if (selectedFiles.length > 0) {
            const fileToPreview = allFiles.find(f => f.id === selectedFiles[0]);
            if (fileToPreview) {
              setPreviewFile(fileToPreview);
            }
          }
        }
      },
      description: '预览文件',
    },
    // ESC 关闭预览
    {
      key: 'Escape',
      handler: () => {
        if (previewFile) {
          setPreviewFile(null);
        }
      },
      description: '关闭预览',
    },
    // 左箭头 - 上一个文件
    {
      key: 'ArrowLeft',
      handler: () => {
        if (previewFile) {
          const currentIndex = allFiles.findIndex(f => f.id === previewFile.id);
          if (currentIndex > 0) {
            setPreviewFile(allFiles[currentIndex - 1]);
            setSelectedFiles([allFiles[currentIndex - 1].id]);
          }
        }
      },
      enabled: !!previewFile,
      description: '上一个文件',
    },
    // 右箭头 - 下一个文件
    {
      key: 'ArrowRight',
      handler: () => {
        if (previewFile) {
          const currentIndex = allFiles.findIndex(f => f.id === previewFile.id);
          if (currentIndex < allFiles.length - 1) {
            setPreviewFile(allFiles[currentIndex + 1]);
            setSelectedFiles([allFiles[currentIndex + 1].id]);
          }
        }
      },
      enabled: !!previewFile,
      description: '下一个文件',
    },
    // Delete 删除选中文件
    {
      key: 'Delete',
      handler: async () => {
        if (selectedFiles.length > 0 && !previewFile) {
          const confirmed = await confirm({
            title: '删除文件',
            message: `确定要删除选中的 ${selectedFiles.length} 个文件吗？`,
            type: 'danger',
            confirmText: '删除',
          });
          if (confirmed) {
            handleDeleteFiles();
          }
        }
      },
      enabled: selectedFiles.length > 0 && !previewFile,
      description: '删除选中文件',
    },
  ], [previewFile, allFiles, selectedFiles, hoveredFileRef]);

  // Apply CSS variables for theme colors
  useEffect(() => {
    document.documentElement.style.setProperty('--cyber-primary', userSettings.primaryColor);
    document.documentElement.style.setProperty('--cyber-secondary', userSettings.secondaryColor);
  }, [userSettings.primaryColor, userSettings.secondaryColor]);

  // Save user settings
  useEffect(() => {
    localStorage.setItem('bkUserSettings', JSON.stringify(userSettings));
  }, [userSettings]);
  
  // Handle login
  const handleLogin = (user: User, servers: ServerConfig[]) => {
    setAuth({ isLoggedIn: true, user, servers });
    showToast.success(`欢迎回来，${user.displayName || user.username}！`);
  };
  
  // Handle logout
  const handleLogout = async () => {
    const confirmed = await confirm({
      title: '退出登录',
      message: '确定要退出登录吗？',
      type: 'warning',
      confirmText: '退出',
    });
    
    if (confirmed) {
      clearToken();
      setAuth({ isLoggedIn: false, user: null, servers: [] });
      showToast.info('已退出登录');
    }
  };

  // Handle settings change
  const handleSettingsChange = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
  };

  // Handle avatar change
  const handleAvatarChange = (avatarUrl: string) => {
    setUserSettings(prev => ({ ...prev, avatarUrl }));
  };
  
  // Data loading functions
  const loadFolders = async () => {
    try {
      const data = await api.getFolderTree();
      setFolders(data);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadTags = async () => {
    try {
      const data = await api.getTagTree();
      setTags(data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.getHistory(50, 0);
      setHistoryRecords(data.records);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadTrash = async () => {
    try {
      const data = await api.getTrash();
      setTrashItems(data);
    } catch (err) {
      console.error('Failed to load trash:', err);
    }
  };

  const loadFiles = async (page: number = 1, resetAll: boolean = true) => {
    try {
      const currentFilters: FileFilters = {
        ...filters,
        folderId: selectedFolder || undefined,
        search: searchQuery || undefined,
        format: selectedFormat || undefined,
      };
      const data = await api.getFiles(currentFilters, page, pageSize);
      
      if (resetAll) {
        // 重置时，只设置第一页的数据
        setAllFiles(data.files);
        setFiles(data.files);
        setCurrentPage(1);
      } else {
        // 追加模式
        setFiles(data.files);
      }
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };
  
  // 加载更多（无限滚动）
  const handleLoadMore = async () => {
    if (loadingMore || !pagination || currentPage >= pagination.totalPages) {
      return;
    }
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const currentFilters: FileFilters = {
        ...filters,
        folderId: selectedFolder || undefined,
        search: searchQuery || undefined,
        format: selectedFormat || undefined,
      };
      const data = await api.getFiles(currentFilters, nextPage, pageSize);
      
      // 追加新数据到已有数据
      setAllFiles(prev => [...prev, ...data.files]);
      setCurrentPage(nextPage);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load more files:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // 是否已完成初始加载
  const [initialLoaded, setInitialLoaded] = useState(false);

  // 监听 API 错误，处理登出
  useEffect(() => {
    if (api.error && api.error.includes('登录已过期')) {
      setAuth({ isLoggedIn: false, user: null, servers: [] });
      setInitialLoaded(false);
    }
  }, [api.error]);

  // Load initial data (only when logged in)
  useEffect(() => {
    if (auth.isLoggedIn && !initialLoaded) {
      loadFolders();
      loadTags();
      loadFiles(1);
      loadHistory();
      loadTrash();
      setInitialLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoggedIn]);

  // 使用 ref 跟踪上一次的过滤条件，避免不必要的页码重置
  const prevFiltersRef = useRef<string>('');
  
  // Reload files when filters or pageSize change (reset to page 1) - 仅在初始加载后
  useEffect(() => {
    if (auth.isLoggedIn && initialLoaded) {
      // 序列化当前过滤条件
      const currentFiltersStr = JSON.stringify({
        ...filters,
        folderId: selectedFolder,
        format: selectedFormat,
        pageSize, // 将 pageSize 也加入比较
      });
      
      // 检查条件是否变化
      const conditionsChanged = currentFiltersStr !== prevFiltersRef.current;
      prevFiltersRef.current = currentFiltersStr;
      
      // 条件变化时重置并加载第一页
      if (conditionsChanged) {
        const doLoadFiles = async () => {
          try {
            const currentFilters: FileFilters = {
              ...filters,
              folderId: selectedFolder || undefined,
              search: searchQuery || undefined,
              format: selectedFormat || undefined,
            };
            const data = await api.getFiles(currentFilters, 1, pageSize);
            setAllFiles(data.files);
            setCurrentPage(1);
            setPagination(data.pagination);
          } catch (err) {
            console.error('Failed to load files:', err);
          }
        };
        doLoadFiles();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedFolder, selectedFormat, pageSize]);

  // Show login page if not authenticated
  if (!auth.isLoggedIn) {
    return (
      <>
        <ToastProvider />
        <DynamicBackground 
          effect={userSettings.backgroundEffect}
          primaryColor={userSettings.primaryColor}
          secondaryColor={userSettings.secondaryColor}
          performanceLevel="low"
        />
        <LoginPage onLogin={handleLogin} settings={userSettings} />
      </>
    );
  }

  const handleClearHistory = async () => {
    const confirmed = await confirm({
      title: '清空历史记录',
      message: '确定要清空所有历史记录吗？此操作不可恢复。',
      type: 'warning',
      confirmText: '清空',
    });
    
    if (confirmed) {
      try {
        await api.clearHistory();
        setHistoryRecords([]);
      } catch (err) {
        console.error('Failed to clear history:', err);
      }
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
    try {
      await api.restoreFromTrash(id);
      loadTrash();
      loadFiles();
    } catch (err) {
      console.error('Failed to restore from trash:', err);
    }
  };

  const handleDeleteFromTrash = async (id: string) => {
    const confirmed = await confirm({
      title: '永久删除',
      message: '确定要永久删除这个文件吗？此操作不可恢复！',
      type: 'danger',
      confirmText: '永久删除',
    });
    
    if (confirmed) {
      try {
        await api.deleteFromTrash(id);
        loadTrash();
      } catch (err) {
        console.error('Failed to delete from trash:', err);
      }
    }
  };

  const handleEmptyTrash = async () => {
    const confirmed = await confirm({
      title: '清空回收站',
      message: `确定要清空回收站中的 ${trashItems.length} 个文件吗？此操作不可恢复！`,
      type: 'danger',
      confirmText: '清空回收站',
    });
    
    if (confirmed) {
      try {
        await api.emptyTrash();
        setTrashItems([]);
      } catch (err) {
        console.error('Failed to empty trash:', err);
      }
    }
  };

  const handlePageChange = async (page: number) => {
    // 直接加载指定页面的数据，不依赖 useEffect
    setCurrentPage(page);
    try {
      const currentFilters: FileFilters = {
        ...filters,
        folderId: selectedFolder || undefined,
        search: searchQuery || undefined,
        format: selectedFormat || undefined,
      };
      const data = await api.getFiles(currentFilters, page, pageSize);
      setFiles(data.files);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolder(folderId);
    setSelectedFiles([]);
    setCurrentView('files'); // 切换回文件视图
  };

  const handleFileSelect = (fileId: string, multi: boolean) => {
    if (multi) {
      // Ctrl/Cmd + 点击 - 切换选择
      setSelectedFiles(prev => 
        prev.includes(fileId)
          ? prev.filter(id => id !== fileId)
          : [...prev, fileId]
      );
    } else {
      // 单击 - 如果已选中则取消，否则单选
      setSelectedFiles(prev => 
        prev.length === 1 && prev[0] === fileId
          ? [] // 取消选中
          : [fileId] // 单选
      );
    }
  };

  // 全选当前已加载的文件
  const handleSelectAll = () => {
    if (selectedFiles.length === allFiles.length) {
      setSelectedFiles([]); // 如果已全选则取消全选
    } else {
      setSelectedFiles(allFiles.map(f => f.id));
    }
  };

  // 批量选择（框选）
  const handleBatchSelect = (fileIds: string[]) => {
    setSelectedFiles(prev => {
      // 合并已选和新选的，去重
      const newSet = new Set([...prev, ...fileIds]);
      return Array.from(newSet);
    });
  };

  // Project file extensions
  const projectExtensions = [
    'psd', 'ai', 'sketch', 'fig', 'xd', 'aep', 'aet', 'prproj', 'drp',
    'blend', 'c4d', 'max', 'ma', 'mb', 'hip', 'nk', 'usd', 'usda', 'usdc', 'usdz'
  ];

  const handleFileDoubleClick = async (file: FileItem) => {
    const ext = file.originalName.split('.').pop()?.toLowerCase() || '';
    
    if (projectExtensions.includes(ext)) {
      try {
        await api.openFile(file.path);
      } catch (err) {
        console.error('Failed to open file:', err);
        setPreviewFile(file);
      }
    } else {
      setPreviewFile(file);
    }
  };

  const handleUpload = async (uploadedFiles: File[]) => {
    setIsUploading(true);
    try {
      await api.uploadFiles(uploadedFiles, selectedFolder || undefined);
      await loadFiles();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async (name: string, parentId?: string) => {
    try {
      await api.createFolder({ name, parentId });
      await loadFolders();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const confirmed = await confirm({
      title: '删除文件夹',
      message: '确定要删除这个文件夹吗？',
      type: 'danger',
      confirmText: '删除',
    });
    
    if (confirmed) {
      try {
        await api.deleteFolder(folderId);
        if (selectedFolder === folderId) {
          setSelectedFolder(null);
        }
        await loadFolders();
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await api.updateFolder(folderId, { name: newName });
      await loadFolders();
    } catch (err) {
      console.error('Failed to rename folder:', err);
    }
  };

  const handleCreateTag = async (name: string, color?: string) => {
    try {
      await api.createTag({ name, color });
      await loadTags();
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    const confirmed = await confirm({
      title: '删除标签',
      message: `确定要删除标签 "${tag?.name}" 吗？`,
      type: 'warning',
      confirmText: '删除',
    });
    
    if (confirmed) {
      try {
        await api.deleteTag(tagId);
        await loadTags();
        await loadFiles();
      } catch (err) {
        console.error('Failed to delete tag:', err);
      }
    }
  };

  const handleDeleteFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      await api.bulkDeleteFiles(selectedFiles);
      setSelectedFiles([]);
      await loadFiles();
      loadTrash();
      loadHistory();
    } catch (err) {
      console.error('Failed to delete files:', err);
    }
  };

  const handleMoveFiles = async (folderId: string | null) => {
    if (selectedFiles.length === 0) return;
    try {
      await api.bulkMoveFiles(selectedFiles, folderId);
      setSelectedFiles([]);
      await loadFiles();
    } catch (err) {
      console.error('Failed to move files:', err);
    }
  };

  const handleTagFiles = async (tagId: string) => {
    if (selectedFiles.length === 0) return;
    try {
      await api.bulkTagFiles(selectedFiles, tagId);
      await loadFiles();
    } catch (err) {
      console.error('Failed to tag files:', err);
    }
  };

  const handleRateFile = async (fileId: string, rating: number) => {
    try {
      await api.updateFile(fileId, { rating });
      await loadFiles();
    } catch (err) {
      console.error('Failed to rate file:', err);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      await api.updateFile(fileId, { name: newName } as any);
      await loadFiles();
      loadHistory();
    } catch (err) {
      console.error('Failed to rename file:', err);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, search: query }));
  }, []);

  const handleFilterByColor = (colors: string[] | null) => {
    setFilters(prev => ({ 
      ...prev, 
      color: colors && colors.length > 0 ? colors : undefined 
    }));
  };

  const handleFilterByType = (mimeType: string | null) => {
    setFilters(prev => ({ ...prev, mimeType: mimeType || undefined }));
  };

  const handleFilterByTag = (tagIds: string[]) => {
    setFilters(prev => ({ ...prev, tagIds: tagIds.length > 0 ? tagIds : undefined }));
  };

  const handleFilterByRating = (rating: number | null) => {
    setFilters(prev => ({ ...prev, rating: rating || undefined }));
  };

  const handleSortChange = (sortBy: FileFilters['sortBy'], sortOrder: FileFilters['sortOrder']) => {
    setFilters(prev => ({ ...prev, sortBy, sortOrder }));
  };

  const handleFilterByFormat = (format: string | null) => {
    setSelectedFormat(format);
  };

  const handleScanComplete = async () => {
    await loadFolders();
    await loadTags();
    await loadFiles();
  };

  return (
    <div className="flex h-screen cyber-bg hex-pattern relative overflow-hidden">
      {/* Toast Provider */}
      <ToastProvider />
      
      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />

      {/* Dynamic Background - 使用低性能模式避免卡顿 */}
      <DynamicBackground 
        effect={userSettings.backgroundEffect}
        primaryColor={userSettings.primaryColor}
        secondaryColor={userSettings.secondaryColor}
        performanceLevel="low"
      />

      {/* Sidebar */}
      <div className="relative z-10">
        <Sidebar
          folders={folders}
          tags={tags}
          selectedFolder={selectedFolder}
          onFolderSelect={handleFolderSelect}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          onCreateTag={handleCreateTag}
          onDeleteTag={handleDeleteTag}
          onFilterByTag={handleFilterByTag}
          onScanClick={() => setShowScanDialog(true)}
          onFilterByFormat={handleFilterByFormat}
          selectedFormat={selectedFormat}
          currentUser={auth.user}
          userSettings={userSettings}
          onOpenSettings={() => setShowUserSettings(true)}
          onOpenAdminPanel={() => setShowAdminPanel(true)}
          historyRecords={historyRecords}
          trashItems={trashItems}
          onLoadHistory={loadHistory}
          onLoadTrash={loadTrash}
          onRestoreFromTrash={handleRestoreFromTrash}
          onDeleteFromTrash={handleDeleteFromTrash}
          onEmptyTrash={handleEmptyTrash}
          onClearHistory={handleClearHistory}
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            if (view === 'trash') {
              loadTrash();
            } else if (view === 'history') {
              loadHistory();
            }
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        {/* Toolbar */}
        <Toolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSearch={handleSearch}
          onFilterByColor={handleFilterByColor}
          onFilterByType={handleFilterByType}
          onSortChange={handleSortChange}
          selectedCount={selectedFiles.length}
          totalCount={pagination?.total || allFiles.length}
          onSelectAll={handleSelectAll}
          onDeleteSelected={async () => {
            const confirmed = await confirm({
              title: '删除文件',
              message: `确定要删除选中的 ${selectedFiles.length} 个文件吗？`,
              type: 'danger',
              confirmText: '删除',
            });
            if (confirmed) {
              handleDeleteFiles();
            }
          }}
          filters={filters}
          folders={folders}
          tags={tags}
          onMoveFiles={handleMoveFiles}
          onTagFiles={handleTagFiles}
          username={auth.user?.username || ''}
          servers={auth.servers}
          onLogout={handleLogout}
          userSettings={userSettings}
          onOpenSettings={() => setShowUserSettings(true)}
          thumbnailSize={thumbnailSize}
          onThumbnailSizeChange={(size) => {
            setThumbnailSize(size);
            localStorage.setItem('bkThumbnailSize', size.toString());
          }}
        />

        {/* 主内容区 - 根据视图显示不同内容 */}
        {currentView === 'files' && (
          <UploadZone onUpload={handleUpload} isUploading={isUploading}>
            <FileGrid
              files={allFiles}
              viewMode={viewMode}
              selectedFiles={selectedFiles}
              onFileSelect={handleFileSelect}
              onBatchSelect={handleBatchSelect}
              onFileDoubleClick={handleFileDoubleClick}
              onRateFile={handleRateFile}
              onHoverFile={handleHoverFile}
              loading={api.loading}
              loadingMore={loadingMore}
              userSettings={userSettings}
              pagination={pagination}
              currentPage={currentPage}
              onLoadMore={handleLoadMore}
              searchQuery={searchQuery}
              thumbnailSize={thumbnailSize}
            />
          </UploadZone>
        )}
        
        {currentView === 'trash' && (
          <TrashGrid
            items={trashItems}
            userSettings={userSettings}
            onRestoreItem={handleRestoreFromTrash}
            onDeleteItem={handleDeleteFromTrash}
            onRestoreAll={async () => {
              for (const item of trashItems) {
                if (item.canRestore) {
                  await handleRestoreFromTrash(item.id);
                }
              }
            }}
            onEmptyTrash={handleEmptyTrash}
            loading={api.loading}
          />
        )}
        
        {currentView === 'history' && (
          <HistoryGrid
            records={historyRecords}
            userSettings={userSettings}
            onClearHistory={handleClearHistory}
            loading={api.loading}
          />
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          files={allFiles}
          onClose={() => setPreviewFile(null)}
          onNavigate={(file) => setPreviewFile(file)}
          onRateFile={handleRateFile}
          onRenameFile={handleRenameFile}
          tags={tags}
          onAddTag={(tagId) => api.addTagToFile(previewFile.id, tagId).then(() => loadFiles(1, true))}
          onRemoveTag={(tagId) => api.removeTagFromFile(previewFile.id, tagId).then(() => loadFiles(1, true))}
        />
      )}

      {/* Scan Dialog */}
      <ScanDialog
        isOpen={showScanDialog}
        onClose={() => setShowScanDialog(false)}
        onScanPreview={api.scanPreview}
        onScanDirectory={api.scanDirectory}
        onScanComplete={handleScanComplete}
      />

      {/* User Settings Panel */}
      <UserSettingsPanel
        isOpen={showUserSettings}
        onClose={() => setShowUserSettings(false)}
        currentUser={auth.user}
        settings={userSettings}
        onSettingsChange={handleSettingsChange}
        onAvatarChange={handleAvatarChange}
      />

      {/* Admin User Panel */}
      {auth.user?.role === 'admin' && (
        <AdminUserPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          apiBaseUrl={api.baseUrl}
        />
      )}
    </div>
  );
}

export default App;
