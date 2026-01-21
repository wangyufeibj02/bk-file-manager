import { useState, useCallback, useRef, ReactNode } from 'react';
import { FiUploadCloud, FiX, FiRefreshCw, FiCheck, FiAlertCircle, FiFolder } from 'react-icons/fi';
import { Folder } from '../types';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  retryCount: number;
}

interface EnhancedUploadZoneProps {
  onUpload: (files: File[], folderId?: string, onProgress?: (progress: number) => void) => Promise<void>;
  folders: Folder[];
  selectedFolder: string | null;
  children: ReactNode;
}

const MAX_RETRY_COUNT = 3;

export function EnhancedUploadZone({ 
  onUpload, 
  folders, 
  selectedFolder,
  children 
}: EnhancedUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(selectedFolder);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef<UploadFile[]>([]);
  const isUploadingRef = useRef(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const next = prev - 1;
      if (next === 0) {
        setIsDragging(false);
      }
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFilesToQueue(files);
    }
  }, []);

  const addFilesToQueue = (files: File[]) => {
    const newFiles: UploadFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0,
      retryCount: 0,
    }));
    
    setUploadFiles(prev => [...prev, ...newFiles]);
    uploadQueueRef.current = [...uploadQueueRef.current, ...newFiles];
    
    // 如果当前没有在上传，开始上传
    if (!isUploadingRef.current) {
      startUpload();
    }
  };

  const startUpload = async () => {
    if (isUploadingRef.current || uploadQueueRef.current.length === 0) {
      return;
    }

    isUploadingRef.current = true;
    const pendingFiles = uploadQueueRef.current.filter(f => f.status === 'pending' || f.status === 'error');

    for (const uploadFile of pendingFiles) {
      if (uploadFile.status === 'error' && uploadFile.retryCount >= MAX_RETRY_COUNT) {
        continue; // 跳过超过重试次数的文件
      }

      // 更新状态为上传中
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      try {
        // 执行上传（带进度回调）
        await onUpload([uploadFile.file], targetFolderId || undefined, (progress) => {
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, progress } : f
          ));
        });
        
        // 更新为成功状态
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
        ));

        // 从队列中移除
        uploadQueueRef.current = uploadQueueRef.current.filter(f => f.id !== uploadFile.id);
      } catch (error) {
        clearInterval(progressInterval);
        
        const errorMessage = error instanceof Error ? error.message : '上传失败';
        const newRetryCount = uploadFile.retryCount + 1;
        
        // 更新为错误状态
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { 
            ...f, 
            status: 'error', 
            error: errorMessage,
            retryCount: newRetryCount 
          } : f
        ));

        // 如果未超过重试次数，自动重试
        if (newRetryCount < MAX_RETRY_COUNT) {
          setTimeout(() => {
            retryUpload(uploadFile.id);
          }, 2000); // 2秒后重试
        }
      }
    }

    isUploadingRef.current = false;
    
    // 检查是否还有待上传的文件
    const remainingPending = uploadQueueRef.current.filter(f => 
      f.status === 'pending' || (f.status === 'error' && f.retryCount < MAX_RETRY_COUNT)
    );
    
    if (remainingPending.length > 0) {
      setTimeout(() => startUpload(), 500);
    }
  };

  const retryUpload = (fileId: string) => {
    setUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'pending', error: undefined } : f
    ));
    
    uploadQueueRef.current = uploadQueueRef.current.map(f => 
      f.id === fileId ? { ...f, status: 'pending', error: undefined } : f
    );
    
    if (!isUploadingRef.current) {
      startUpload();
    }
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
    uploadQueueRef.current = uploadQueueRef.current.filter(f => f.id !== fileId);
  };

  const clearCompleted = () => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'success'));
    uploadQueueRef.current = uploadQueueRef.current.filter(f => f.status !== 'success');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFilesToQueue(Array.from(files));
    }
    // 重置input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return '全部文件';
    const folder = folders.find(f => f.id === folderId);
    return folder?.name || '未知文件夹';
  };

  const pendingCount = uploadFiles.filter(f => f.status === 'pending' || f.status === 'uploading').length;
  const successCount = uploadFiles.filter(f => f.status === 'success').length;
  const errorCount = uploadFiles.filter(f => f.status === 'error').length;
  const hasUploads = uploadFiles.length > 0;

  return (
    <div
      className="flex-1 relative flex flex-col min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 bg-cyan-500/10 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center border-4 border-dashed border-cyan-500">
              <FiUploadCloud size={48} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              释放以上传文件
            </h3>
            <p className="text-gray-400">
              将上传到: {getFolderName(targetFolderId)}
            </p>
          </div>
        </div>
      )}

      {/* 上传队列面板 */}
      {hasUploads && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-cyan-500/30 z-50 max-h-96 overflow-y-auto">
          <div className="p-4">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-white">上传队列</h3>
                {pendingCount > 0 && (
                  <span className="text-sm text-gray-400">
                    正在上传 {pendingCount} 个文件
                  </span>
                )}
                {successCount > 0 && (
                  <span className="text-sm text-green-400">
                    成功 {successCount}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-sm text-red-400">
                    失败 {errorCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* 文件夹选择器 */}
                <button
                  onClick={() => setShowFolderSelector(!showFolderSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-sm text-cyan-400 transition-colors"
                >
                  <FiFolder size={16} />
                  <span>{getFolderName(targetFolderId)}</span>
                </button>
                {successCount > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    清除已完成
                  </button>
                )}
              </div>
            </div>

            {/* 文件夹选择下拉菜单 */}
            {showFolderSelector && (
              <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setTargetFolderId(null);
                      setShowFolderSelector(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      targetFolderId === null
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    全部文件
                  </button>
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setTargetFolderId(folder.id);
                        setShowFolderSelector(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        targetFolderId === folder.id
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 文件列表 */}
            <div className="space-y-2">
              {uploadFiles.map(uploadFile => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  {/* 文件图标 */}
                  <div className="flex-shrink-0">
                    {uploadFile.status === 'success' ? (
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <FiCheck className="text-green-400" size={20} />
                      </div>
                    ) : uploadFile.status === 'error' ? (
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <FiAlertCircle className="text-red-400" size={20} />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <FiUploadCloud className="text-cyan-400" size={20} />
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {uploadFile.file.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {/* 进度条 */}
                      {uploadFile.status === 'uploading' && (
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 transition-all duration-300"
                            style={{ width: `${uploadFile.progress}%` }}
                          />
                        </div>
                      )}
                      {uploadFile.status === 'error' && (
                        <div className="text-xs text-red-400">
                          {uploadFile.error} {uploadFile.retryCount < MAX_RETRY_COUNT && `(重试 ${uploadFile.retryCount}/${MAX_RETRY_COUNT})`}
                        </div>
                      )}
                      {uploadFile.status === 'success' && (
                        <div className="text-xs text-green-400">
                          上传成功
                        </div>
                      )}
                      {uploadFile.status === 'pending' && (
                        <div className="text-xs text-gray-400">
                          等待上传...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    {uploadFile.status === 'error' && uploadFile.retryCount < MAX_RETRY_COUNT && (
                      <button
                        onClick={() => retryUpload(uploadFile.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="重试"
                      >
                        <FiRefreshCw className="text-cyan-400" size={18} />
                      </button>
                    )}
                    {(uploadFile.status === 'success' || uploadFile.status === 'error') && (
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="移除"
                      >
                        <FiX className="text-gray-400" size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}
