import { useState } from 'react';
import { FiFile, FiImage, FiVideo, FiMusic, FiFileText, FiRefreshCw, FiTrash2, FiCheck, FiX, FiAlertTriangle, FiUser, FiClock, FiFolder } from 'react-icons/fi';
import { TrashItem, UserSettings } from '../types';

interface TrashGridProps {
  items: TrashItem[];
  userSettings?: UserSettings;
  onRestoreItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onRestoreAll: () => void;
  onEmptyTrash: () => void;
  loading?: boolean;
}

// 格式化时间
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  return date.toLocaleDateString('zh-CN', { 
    year: 'numeric',
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化文件大小
const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

// 获取文件图标
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FiImage;
  if (mimeType.startsWith('video/')) return FiVideo;
  if (mimeType.startsWith('audio/')) return FiMusic;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('pdf')) return FiFileText;
  return FiFile;
};

export function TrashGrid({
  items,
  userSettings,
  onRestoreItem,
  onDeleteItem,
  onRestoreAll,
  onEmptyTrash,
  loading = false,
}: TrashGridProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  
  const primaryColor = userSettings?.primaryColor || '#00ffff';
  const secondaryColor = userSettings?.secondaryColor || '#ff00ff';
  
  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const selectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };
  
  const handleBatchRestore = () => {
    selectedItems.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item?.canRestore) {
        onRestoreItem(id);
      }
    });
    setSelectedItems(new Set());
  };
  
  const handleBatchDelete = () => {
    if (confirm(`确定要永久删除选中的 ${selectedItems.size} 个文件吗？此操作不可恢复！`)) {
      selectedItems.forEach(id => onDeleteItem(id));
      setSelectedItems(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div 
            className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: `${primaryColor}30`, borderTopColor: primaryColor }}
          />
          <p style={{ color: `${primaryColor}80` }}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div 
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: `${primaryColor}20` }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FiTrash2 size={20} style={{ color: primaryColor }} />
            <h2 className="text-lg font-semibold text-white">回收站</h2>
            <span 
              className="px-2 py-0.5 text-sm rounded-full"
              style={{ background: `${primaryColor}20`, color: primaryColor }}
            >
              {items.length} 个文件
            </span>
          </div>
          
          {items.length > 0 && (
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors hover:opacity-80"
              style={{ 
                background: selectedItems.size === items.length ? `${primaryColor}30` : `${primaryColor}10`,
                color: selectedItems.size === items.length ? primaryColor : '#ccc',
                border: `1px solid ${primaryColor}30`
              }}
            >
              {selectedItems.size === items.length ? '取消全选' : '全选'}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <>
              <button
                onClick={handleBatchRestore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: `${primaryColor}20`, color: primaryColor, border: `1px solid ${primaryColor}40` }}
              >
                <FiRefreshCw size={14} />
                恢复选中 ({selectedItems.size})
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: `${secondaryColor}20`, color: secondaryColor, border: `1px solid ${secondaryColor}40` }}
              >
                <FiTrash2 size={14} />
                永久删除 ({selectedItems.size})
              </button>
            </>
          )}
          
          {items.length > 0 && selectedItems.size === 0 && (
            <>
              <button
                onClick={onRestoreAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}
              >
                <FiRefreshCw size={14} />
                全部恢复
              </button>
              <button
                onClick={() => {
                  if (confirm('确定要清空回收站吗？所有文件将被永久删除，此操作不可恢复！')) {
                    onEmptyTrash();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: `${secondaryColor}15`, color: secondaryColor, border: `1px solid ${secondaryColor}30` }}
              >
                <FiTrash2 size={14} />
                清空回收站
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{ background: `${primaryColor}10` }}
            >
              <FiTrash2 size={40} style={{ color: `${primaryColor}60` }} />
            </div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">回收站是空的</h3>
            <p className="text-gray-500">删除的文件会暂存在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {items.map(item => {
              const FileIcon = getFileIcon(item.mimeType);
              const isSelected = selectedItems.has(item.id);
              
              return (
                <div
                  key={item.id}
                  className={`relative group rounded-xl overflow-hidden transition-all duration-200 cursor-pointer`}
                  style={{
                    background: isSelected ? `${primaryColor}10` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? primaryColor : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: isSelected ? `0 0 20px ${primaryColor}20` : 'none',
                  }}
                  onClick={() => toggleSelect(item.id)}
                >
                  {/* 选择框 */}
                  <div 
                    className={`absolute top-3 left-3 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    style={{
                      borderColor: primaryColor,
                      background: isSelected ? primaryColor : 'rgba(0,0,0,0.7)',
                    }}
                  >
                    {isSelected && <FiCheck size={12} style={{ color: '#000' }} />}
                  </div>
                  
                  {/* 文件不存在警告 */}
                  {!item.canRestore && (
                    <div className="absolute top-3 right-3 z-10">
                      <div 
                        className="p-1.5 rounded-full"
                        style={{ background: `${secondaryColor}30` }}
                        title="原文件已不存在"
                      >
                        <FiAlertTriangle size={14} style={{ color: secondaryColor }} />
                      </div>
                    </div>
                  )}
                  
                  {/* 缩略图区域 */}
                  <div 
                    className="aspect-square flex items-center justify-center"
                    style={{ background: `${primaryColor}05` }}
                  >
                    {item.thumbnailPath ? (
                      <img
                        src={item.thumbnailPath}
                        alt={item.originalName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <FileIcon size={48} style={{ color: `${primaryColor}50` }} />
                    )}
                  </div>
                  
                  {/* 文件信息 */}
                  <div className="p-3 space-y-2">
                    <div 
                      className="text-sm font-medium truncate" 
                      title={item.originalName}
                      style={{ color: isSelected ? primaryColor : '#fff' }}
                    >
                      {item.originalName}
                    </div>
                    
                    <div className="text-xs space-y-1" style={{ color: `${primaryColor}60` }}>
                      <div className="flex items-center gap-1.5">
                        <FiFolder size={10} />
                        <span className="truncate">{item.folderName || '根目录'}</span>
                        <span>•</span>
                        <span>{formatSize(item.size)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FiClock size={10} />
                        <span>{formatTime(item.deletedAt)}</span>
                      </div>
                      {item.deletedByName && (
                        <div className="flex items-center gap-1.5">
                          <FiUser size={10} />
                          <span>{item.deletedByName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(to top, rgba(0,0,0,0.95), transparent)` }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-2">
                      {item.canRestore && (
                        <button
                          onClick={() => onRestoreItem(item.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                          style={{ background: `${primaryColor}25`, color: primaryColor, border: `1px solid ${primaryColor}40` }}
                        >
                          <FiRefreshCw size={14} />
                          恢复
                        </button>
                      )}
                      {confirmingDelete === item.id ? (
                        <div className="flex-1 flex gap-1">
                          <button
                            onClick={() => {
                              onDeleteItem(item.id);
                              setConfirmingDelete(null);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-sm font-medium hover:opacity-80"
                            style={{ background: `${secondaryColor}30`, color: secondaryColor, border: `1px solid ${secondaryColor}50` }}
                          >
                            <FiCheck size={14} />
                            确认
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(null)}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-sm font-medium hover:opacity-80"
                            style={{ background: 'rgba(255,255,255,0.1)', color: '#ccc', border: '1px solid rgba(255,255,255,0.2)' }}
                          >
                            <FiX size={14} />
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDelete(item.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                          style={{ background: `${secondaryColor}20`, color: secondaryColor, border: `1px solid ${secondaryColor}40` }}
                        >
                          <FiTrash2 size={14} />
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
