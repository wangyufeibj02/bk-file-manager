import { useState, useCallback } from 'react';
import { Folder, FileItem, Tag, FileFilters, Pagination, HistoryRecord, TrashItem } from '../types';
import { showError, showSuccess, showLoading, updateToast, dismissLoading } from '../components/Toast';

const API_BASE = '/api';

// 获取存储的 Token
function getToken(): string | null {
  try {
    const auth = localStorage.getItem('bkAuth');
    if (auth) {
      const parsed = JSON.parse(auth);
      return parsed.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

// 设置 Token
export function setToken(token: string, user: any) {
  localStorage.setItem('bkAuth', JSON.stringify({
    token,
    user,
    loginTime: Date.now(),
  }));
}

// 清除 Token
export function clearToken() {
  localStorage.removeItem('bkAuth');
}

// API 错误类型
export class ApiError extends Error {
  code: string;
  status: number;
  
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithError = useCallback(async <T>(
    url: string,
    options?: RequestInit,
    showErrorToast = true
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers as Record<string, string>,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
      });
      
      // 处理 401 未授权
      if (response.status === 401) {
        clearToken();
        // 不要自动刷新，让 App 组件处理登出状态
        throw new ApiError('登录已过期，请重新登录', 'UNAUTHORIZED', 401);
      }
      
      // 处理 204 无内容
      if (response.status === 204) {
        return null as T;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error || `请求失败 (${response.status})`;
        const errorCode = data.code || 'UNKNOWN_ERROR';
        throw new ApiError(errorMessage, errorCode, response.status);
      }
      
      return data;
    } catch (err) {
      let message = '网络错误，请检查连接';
      
      if (err instanceof ApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError(message);
      
      if (showErrorToast && !(err instanceof ApiError && err.status === 401)) {
        showError(message);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== 认证相关 =====
  const login = useCallback(async (username: string, password: string) => {
    const data = await fetchWithError<{
      success: boolean;
      token: string;
      user: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, false);
    
    if (data.token) {
      setToken(data.token, data.user);
    }
    
    return data;
  }, [fetchWithError]);

  const verifyToken = useCallback(() => 
    fetchWithError<{ valid: boolean; user: any }>('/auth/verify', {}, false), 
    [fetchWithError]);

  const refreshToken = useCallback(() => 
    fetchWithError<{ token: string }>('/auth/refresh', { method: 'POST' }), 
    [fetchWithError]);

  // ===== 文件夹 =====
  const getFolders = useCallback(() => 
    fetchWithError<Folder[]>('/folders'), [fetchWithError]);

  const getFolderTree = useCallback(() => 
    fetchWithError<Folder[]>('/folders/tree'), [fetchWithError]);

  const getFolder = useCallback((id: string) => 
    fetchWithError<Folder>(`/folders/${id}`), [fetchWithError]);

  const createFolder = useCallback(async (data: Partial<Folder>) => {
    const result = await fetchWithError<Folder>('/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    showSuccess(`文件夹 "${data.name}" 创建成功`);
    return result;
  }, [fetchWithError]);

  const updateFolder = useCallback((id: string, data: Partial<Folder>) => 
    fetchWithError<Folder>(`/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }), [fetchWithError]);

  const deleteFolder = useCallback(async (id: string) => {
    await fetchWithError<void>(`/folders/${id}`, { method: 'DELETE' });
    showSuccess('文件夹已删除');
  }, [fetchWithError]);

  // ===== 文件 =====
  const getFiles = useCallback((filters: FileFilters = {}, page = 1, limit = 50) => {
    const params = new URLSearchParams();
    if (filters.folderId) params.set('folderId', filters.folderId);
    if (filters.search) params.set('search', filters.search);
    if (filters.mimeType) params.set('mimeType', filters.mimeType);
    // 支持单色或多色
    if (filters.color) {
      const colors = Array.isArray(filters.color) ? filters.color : [filters.color];
      if (colors.length > 0) {
        params.set('color', colors.join(','));
      }
    }
    if (filters.rating) params.set('rating', String(filters.rating));
    if (filters.tagIds?.length) params.set('tagIds', filters.tagIds.join(','));
    if (filters.format) params.set('format', filters.format);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    params.set('page', String(page));
    params.set('limit', String(limit));
    
    return fetchWithError<{ files: FileItem[]; pagination: Pagination }>(
      `/files?${params.toString()}`
    );
  }, [fetchWithError]);

  const getFile = useCallback((id: string) => 
    fetchWithError<FileItem>(`/files/${id}`), [fetchWithError]);

  const uploadFiles = useCallback(async (files: File[], folderId?: string) => {
    setLoading(true);
    setError(null);
    
    const toastId = showLoading(`正在上传 ${files.length} 个文件...`);
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (folderId) formData.append('folderId', folderId);

      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }
      
      const result = await response.json() as FileItem[];
      dismissLoading(toastId);
      showSuccess(`成功上传 ${result.length} 个文件`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传失败';
      setError(message);
      dismissLoading(toastId);
      showError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFile = useCallback(async (id: string, data: Partial<FileItem>) => {
    const result = await fetchWithError<FileItem>(`/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    showSuccess('文件已更新');
    return result;
  }, [fetchWithError]);

  const deleteFile = useCallback(async (id: string) => {
    await fetchWithError<void>(`/files/${id}`, { method: 'DELETE' });
    showSuccess('文件已移至回收站');
  }, [fetchWithError]);

  const addTagToFile = useCallback((fileId: string, tagId: string) => 
    fetchWithError<FileItem>(`/files/${fileId}/tags/${tagId}`, {
      method: 'POST',
    }), [fetchWithError]);

  const removeTagFromFile = useCallback((fileId: string, tagId: string) => 
    fetchWithError<void>(`/files/${fileId}/tags/${tagId}`, {
      method: 'DELETE',
    }), [fetchWithError]);

  const bulkMoveFiles = useCallback(async (fileIds: string[], folderId: string | null) => {
    const result = await fetchWithError<{ success: boolean; count: number }>('/files/bulk/move', {
      method: 'POST',
      body: JSON.stringify({ fileIds, folderId }),
    });
    showSuccess(`已移动 ${result.count} 个文件`);
    return result;
  }, [fetchWithError]);

  const bulkDeleteFiles = useCallback(async (fileIds: string[]) => {
    const result = await fetchWithError<{ success: boolean; count: number }>('/files/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
    showSuccess(`已删除 ${result.count} 个文件`);
    return result;
  }, [fetchWithError]);

  const bulkTagFiles = useCallback(async (fileIds: string[], tagId: string) => {
    const result = await fetchWithError<{ success: boolean; count: number }>('/files/bulk/tag', {
      method: 'POST',
      body: JSON.stringify({ fileIds, tagId }),
    });
    showSuccess(`已为 ${result.count} 个文件添加标签`);
    return result;
  }, [fetchWithError]);

  // ===== 标签 =====
  const getTags = useCallback(() => 
    fetchWithError<Tag[]>('/tags'), [fetchWithError]);

  const getTagTree = useCallback(() => 
    fetchWithError<Tag[]>('/tags/tree'), [fetchWithError]);

  const createTag = useCallback(async (data: Partial<Tag>) => {
    const result = await fetchWithError<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    showSuccess(`标签 "${data.name}" 创建成功`);
    return result;
  }, [fetchWithError]);

  const updateTag = useCallback((id: string, data: Partial<Tag>) => 
    fetchWithError<Tag>(`/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }), [fetchWithError]);

  const deleteTag = useCallback(async (id: string) => {
    const result = await fetchWithError<{ success: boolean; message: string }>(`/tags/${id}`, { 
      method: 'DELETE' 
    });
    showSuccess(result.message || '标签已删除');
    return result;
  }, [fetchWithError]);

  // ===== 打开文件 =====
  const openFile = useCallback((filePath: string) => 
    fetchWithError<{ success: boolean }>('/files/open', {
      method: 'POST',
      body: JSON.stringify({ filePath }),
    }), [fetchWithError]);

  const checkFileExists = useCallback((id: string) => 
    fetchWithError<{ exists: boolean; path: string }>(`/files/${id}/exists`), 
    [fetchWithError]);

  // ===== 扫描 =====
  const scanPreview = useCallback((directoryPath: string) => 
    fetchWithError<{
      path: string;
      name: string;
      totalFiles: number;
      totalFolders: number;
      fileTypes: Record<string, number>;
      sampleFiles: { name: string; type: string; size: number; folder: string }[];
    }>('/scan/preview', {
      method: 'POST',
      body: JSON.stringify({ directoryPath }),
    }), [fetchWithError]);

  const scanDirectory = useCallback(async (directoryPath: string, createRootFolder: boolean) => {
    const toastId = showLoading('正在扫描目录...');
    try {
      const result = await fetchWithError<{
        success: boolean;
        message: string;
        result: {
          totalFiles: number;
          folders: number;
          fileTypes: Record<string, number>;
          errors: string[];
        };
      }>('/scan/directory', {
        method: 'POST',
        body: JSON.stringify({ directoryPath, createRootFolder }),
      });
      
      dismissLoading(toastId);
      showSuccess(`扫描完成：${result.result.totalFiles} 个文件`);
      return result;
    } catch (err) {
      dismissLoading(toastId);
      throw err;
    }
  }, [fetchWithError]);

  // ===== 历史记录 =====
  const getHistory = useCallback((limit = 50, offset = 0, action?: string) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (action) params.set('action', action);
    return fetchWithError<{ records: HistoryRecord[]; total: number; hasMore: boolean }>(
      `/history?${params.toString()}`
    );
  }, [fetchWithError]);

  const clearHistory = useCallback(async () => {
    await fetchWithError<{ success: boolean }>('/history', { method: 'DELETE' });
    showSuccess('历史记录已清空');
  }, [fetchWithError]);

  // ===== 回收站 =====
  const getTrash = useCallback(() => 
    fetchWithError<TrashItem[]>('/history/trash'), [fetchWithError]);

  const restoreFromTrash = useCallback(async (id: string) => {
    const result = await fetchWithError<FileItem>(`/history/trash/${id}/restore`, { 
      method: 'POST' 
    });
    showSuccess('文件已恢复');
    return result;
  }, [fetchWithError]);

  const deleteFromTrash = useCallback(async (id: string) => {
    await fetchWithError<{ success: boolean }>(`/history/trash/${id}`, { 
      method: 'DELETE' 
    });
    showSuccess('文件已永久删除');
  }, [fetchWithError]);

  const emptyTrash = useCallback(async () => {
    await fetchWithError<{ success: boolean }>('/history/trash', { 
      method: 'DELETE' 
    });
    showSuccess('回收站已清空');
  }, [fetchWithError]);

  return {
    loading,
    error,
    baseUrl: API_BASE,
    // 认证
    login,
    verifyToken,
    refreshToken,
    // 文件夹
    getFolders,
    getFolderTree,
    getFolder,
    createFolder,
    updateFolder,
    deleteFolder,
    // 文件
    getFiles,
    getFile,
    uploadFiles,
    updateFile,
    deleteFile,
    addTagToFile,
    removeTagFromFile,
    bulkMoveFiles,
    bulkDeleteFiles,
    bulkTagFiles,
    openFile,
    checkFileExists,
    // 标签
    getTags,
    getTagTree,
    createTag,
    updateTag,
    deleteTag,
    // 扫描
    scanPreview,
    scanDirectory,
    // 历史
    getHistory,
    clearHistory,
    // 回收站
    getTrash,
    restoreFromTrash,
    deleteFromTrash,
    emptyTrash,
  };
}
