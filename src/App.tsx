import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { FileGrid } from './components/FileGrid';
import { TrashGrid } from './components/TrashGrid';
import { HistoryGrid } from './components/HistoryGrid';
import { FilePreview } from './components/FilePreview';
import { UploadZone } from './components/UploadZone';
import { EnhancedUploadZone } from './components/EnhancedUploadZone';
import { BatchActionToolbar } from './components/BatchActionToolbar';
import { OnboardingGuide } from './components/OnboardingGuide';
import { ShareDialog } from './components/ShareDialog';
import { UndoToast } from './components/UndoToast';
import { ScanDialog } from './components/ScanDialog';
import { LoginPage } from './components/LoginPage';
import { DynamicBackground } from './components/DynamicBackground';
import { UserSettingsPanel } from './components/UserSettingsPanel';
import { AdminUserPanel } from './components/AdminUserPanel';
import { ToastProvider, showSuccess, showInfo } from './components/Toast';
import { ConfirmDialog, useConfirm } from './components/ConfirmDialog';
import { useApi, setToken, clearToken } from './hooks/useApi';
import { useHotkeys } from './hooks/useHotkeys';
import { useResponsiveScale } from './hooks/useResponsiveScale';
import { useUndo } from './hooks/useUndo';
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
  const { history: undoHistory, canUndo, addAction, undo, clearHistory } = useUndo();
  const [undoToast, setUndoToast] = useState<{ action: string; onUndo: () => void } | null>(null);
  
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  
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
    // Ctrl+Z 撤销
    {
      key: 'z',
      ctrl: true,
      handler: async () => {
        if (canUndo) {
          await undo();
        }
      },
      enabled: canUndo,
      description: '撤销操作',
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
    // 重置初始加载状态，确保 useEffect 会重新加载数据
    setInitialLoaded(false);
    // 设置登录状态
    setAuth({ isLoggedIn: true, user, servers });
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
      showInfo('已退出登录');
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
  const handleLoadMore = useCallback(async () => {
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
      setAllFiles(prev => {
        // 检查是否已经有这些文件，避免重复添加
        const existingIds = new Set(prev.map(f => f.id));
        const newFiles = data.files.filter(f => !existingIds.has(f.id));
        return [...prev, ...newFiles];
      });
      setCurrentPage(nextPage);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load more files:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pagination, currentPage, filters, selectedFolder, searchQuery, selectedFormat, pageSize, api]);

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
      // 显示欢迎消息（仅登录时，不是页面刷新）
      if (auth.user) {
        showSuccess(`欢迎回来，${auth.user.displayName || auth.user.username}！`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoggedIn, initialLoaded]);

  // 使用 ref 跟踪上一次的过滤条件，避免不必要的页码重置
  const prevFiltersRef = useRef<string>('');
  const isLoadingRef = useRef<boolean>(false); // 防止重复加载
  
  // Reload files when filters or pageSize change (reset to page 1) - 仅在初始加载后
  useEffect(() => {
    if (auth.isLoggedIn && initialLoaded && !isLoadingRef.current) {
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
        isLoadingRef.current = true;
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
            // FileGrid组件会自动检查并加载更多内容以填满屏幕
          } catch (err) {
            console.error('Failed to load files:', err);
          } finally {
            // 延迟重置加载标志，避免快速连续触发
            setTimeout(() => {
              isLoadingRef.current = false;
            }, 500);
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
    if (page < 1 || (pagination && page > pagination.totalPages)) return;
    
    setLoadingMore(true);
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
      setAllFiles(data.files); // 分页模式下只显示当前页
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoadingMore(false);
    }
    // 滚动到顶部
    document.querySelector('.content-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleUpload = async (uploadedFiles: File[], folderId?: string) => {
    setIsUploading(true);
    try {
      await api.uploadFiles(uploadedFiles, folderId || selectedFolder || undefined);
      await loadFiles();
      // 如果上传到指定文件夹，自动切换到该文件夹
      if (folderId && folderId !== selectedFolder) {
        setSelectedFolder(folderId);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      throw err; // 重新抛出错误，让EnhancedUploadZone处理
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
    // 获取文件夹名称用于显示
    const folder = folders.find(f => f.id === folderId);
    const folderName = folder?.name || '此文件夹';
    
    const confirmed = await confirm({
      title: '删除文件夹',
      message: `确定要删除 "${folderName}" 吗？`,
      type: 'danger',
      confirmText: '删除',
    });
    
    if (confirmed) {
      try {
        // 先尝试删除（不强制）
        const result = await api.deleteFolder(folderId, false);
        
        // 如果需要确认（文件夹不为空）
        if (result?.needConfirm) {
          const forceConfirmed = await confirm({
            title: '⚠️ 文件夹不为空',
            message: `"${folderName}" 包含 ${result.stats?.totalFiles || 0} 个文件和 ${result.stats?.totalFolders || 0} 个子文件夹。\n\n删除后将无法恢复，确定要全部删除吗？`,
            type: 'danger',
            confirmText: '全部删除',
          });
          
          if (forceConfirmed) {
            // 强制删除
            await api.deleteFolder(folderId, true);
            if (selectedFolder === folderId) {
              setSelectedFolder(null);
            }
            await loadFolders();
            await loadFiles();
          }
        } else {
          // 空文件夹直接删除成功
          if (selectedFolder === folderId) {
            setSelectedFolder(null);
          }
          await loadFolders();
        }
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

  const handleMoveFolder = async (folderId: string, targetParentId: string | null, sortOrder?: number) => {
    try {
      const response = await fetch(`${api.baseUrl}/folders/${folderId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...api.authHeaders,
        },
        body: JSON.stringify({ parentId: targetParentId, sortOrder }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '移动失败');
      }
      
      await loadFolders();
      showSuccess('文件夹已移动');
    } catch (err) {
      console.error('Failed to move folder:', err);
    }
  };

  const handleReorderFolders = async (orders: { id: string; sortOrder: number }[]) => {
    try {
      const response = await fetch(`${api.baseUrl}/folders/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...api.authHeaders,
        },
        body: JSON.stringify({ orders }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '排序失败');
      }
      
      await loadFolders();
    } catch (err) {
      console.error('Failed to reorder folders:', err);
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
    
    // 保存删除的文件信息用于撤销
    const deletedFiles = allFiles.filter(f => selectedFiles.includes(f.id));
    
    try {
      await api.bulkDeleteFiles(selectedFiles);
      
      // 添加到撤销历史
      addAction({
        type: 'delete',
        description: `删除 ${selectedFiles.length} 个文件`,
        undo: async () => {
          // 恢复文件（需要后端支持）
          // 这里简化处理，实际应该调用恢复API
          await loadFiles();
          await loadTrash();
        },
      });
      
      // 显示撤销提示
      setUndoToast({
        action: `已删除 ${selectedFiles.length} 个文件`,
        onUndo: async () => {
          await undo();
        },
      });
      
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
    
    // 保存原始文件夹ID用于撤销
    const originalFolderIds = selectedFiles.map(id => {
      const file = allFiles.find(f => f.id === id);
      return { id, folderId: file?.folderId || null };
    });
    
    try {
      await api.bulkMoveFiles(selectedFiles, folderId);
      
      // 添加到撤销历史
      addAction({
        type: 'move',
        description: `移动 ${selectedFiles.length} 个文件`,
        undo: async () => {
          // 恢复文件到原始文件夹
          for (const { id, folderId: originalFolderId } of originalFolderIds) {
            await api.bulkMoveFiles([id], originalFolderId);
          }
          await loadFiles();
        },
      });
      
      // 显示撤销提示
      const targetFolder = folderId ? folders.find(f => f.id === folderId) : null;
      setUndoToast({
        action: `已移动 ${selectedFiles.length} 个文件到 ${targetFolder?.name || '全部文件'}`,
        onUndo: async () => {
          await undo();
        },
      });
      
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

  const handleTagFilesMultiple = async (tagIds: string[]) => {
    if (selectedFiles.length === 0 || tagIds.length === 0) return;
    try {
      // 为每个文件添加每个标签
      for (const tagId of tagIds) {
        await api.bulkTagFiles(selectedFiles, tagId);
      }
      await loadFiles();
      showSuccess(`已为 ${selectedFiles.length} 个文件添加 ${tagIds.length} 个标签`);
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
          onMoveFolder={handleMoveFolder}
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
          onFilterByFormat={handleFilterByFormat}
          selectedFormat={selectedFormat}
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
          <EnhancedUploadZone 
            onUpload={handleUpload} 
            folders={folders}
            selectedFolder={selectedFolder}
          >
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
              onPageChange={handlePageChange}
              searchQuery={searchQuery}
              thumbnailSize={thumbnailSize}
              onUpload={() => {
                // 触发文件选择
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) {
                    handleUpload(Array.from(files));
                  }
                };
                input.click();
              }}
              selectedFolder={selectedFolder}
            />
          </EnhancedUploadZone>
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
          onShare={(fileId) => setShareFileId(fileId)}
        />
      )}

      {/* Share Dialog */}
      {shareFileId && (
        <ShareDialog
          isOpen={!!shareFileId}
          onClose={() => setShareFileId(null)}
          fileId={shareFileId}
          fileName={allFiles.find(f => f.id === shareFileId)?.originalName || '文件'}
          onCreateShare={async (options) => {
            const result = await api.createShareLink(shareFileId, options);
            return result;
          }}
          onGetShares={async () => {
            const links = await api.getShareLinks(shareFileId);
            return links;
          }}
          onDeleteShare={async (shareId) => {
            await api.deleteShareLink(shareId);
          }}
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

      {/* Batch Action Toolbar */}
      {currentView === 'files' && (
        <BatchActionToolbar
          selectedCount={selectedFiles.length}
          folders={folders}
          tags={tags}
          onDelete={async () => {
            const confirmed = await confirm({
              title: '删除文件',
              message: `确定要删除选中的 ${selectedFiles.length} 个文件吗？`,
              type: 'danger',
              confirmText: '删除',
            });
            if (confirmed) {
              await handleDeleteFiles();
            }
          }}
          onMove={handleMoveFiles}
          onAddTag={handleTagFilesMultiple}
          onCancel={() => setSelectedFiles([])}
        />
      )}

      {/* Onboarding Guide */}
      {auth.isLoggedIn && (
        <OnboardingGuide onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Undo Toast */}
      {undoToast && (
        <UndoToast
          action={undoToast.action}
          onUndo={undoToast.onUndo}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
}

export default App;
