import { useState } from 'react';
import { 
  FiClock, FiEye, FiEdit3, FiMove, FiTag, FiStar, FiTrash2, FiRefreshCw,
  FiFile, FiImage, FiVideo, FiMusic, FiFileText, FiUser, FiFilter, FiX, FiFolder
} from 'react-icons/fi';
import { HistoryRecord, HistoryAction, UserSettings } from '../types';

interface HistoryGridProps {
  records: HistoryRecord[];
  userSettings?: UserSettings;
  onClearHistory: () => void;
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

// 格式化完整时间
const formatFullTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 历史操作信息
const getActionInfo = (action: HistoryAction | string, details?: Record<string, any> | null) => {
  // 检查是否是文件夹操作
  const isFolder = details?.isFolder;
  const isCreate = details?.type === 'create';
  
  const actionMap: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
    view: { icon: FiEye, label: '浏览', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
    edit: { 
      icon: FiEdit3, 
      label: isCreate ? (isFolder ? '创建文件夹' : '创建') : '编辑', 
      color: isCreate ? '#22c55e' : '#f97316', 
      bgColor: isCreate ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)' 
    },
    rename: { icon: FiEdit3, label: isFolder ? '重命名文件夹' : '重命名', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
    move: { icon: FiMove, label: isFolder ? '移动文件夹' : '移动', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
    tag: { icon: FiTag, label: '标签', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
    rate: { icon: FiStar, label: '评分', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
    delete: { icon: FiTrash2, label: isFolder ? '删除文件夹' : '删除', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
    restore: { icon: FiRefreshCw, label: '恢复', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  };
  return actionMap[action] || { icon: FiFile, label: action, color: '#666', bgColor: 'rgba(102, 102, 102, 0.15)' };
};

// 格式化历史详情
const formatHistoryDetails = (action: string, details: Record<string, any> | null) => {
  if (!details) return null;
  
  switch (action) {
    case 'rename':
      return (
        <span className="flex items-center gap-1">
          <span className="opacity-60">{details.from}</span>
          <span>→</span>
          <span className="font-medium">{details.to}</span>
        </span>
      );
    case 'move':
      return (
        <span className="flex items-center gap-1">
          <span className="opacity-60">{details.fromFolder || '根目录'}</span>
          <span>→</span>
          <span className="font-medium">{details.toFolder || '根目录'}</span>
        </span>
      );
    case 'tag':
      return <span>添加标签: <span className="font-medium">{details.tag}</span></span>;
    case 'rate':
      return (
        <span className="flex items-center gap-1">
          <span>{details.from || 0}★</span>
          <span>→</span>
          <span className="font-medium">{details.to}★</span>
        </span>
      );
    default:
      return null;
  }
};

// 获取文件类型图标
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'psd', 'ai'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
  
  if (imageExts.includes(ext)) return FiImage;
  if (videoExts.includes(ext)) return FiVideo;
  if (audioExts.includes(ext)) return FiMusic;
  if (docExts.includes(ext)) return FiFileText;
  return FiFile;
};

// 按日期分组
const groupByDate = (records: HistoryRecord[]) => {
  const groups: { date: string; records: HistoryRecord[] }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeek = new Date(today.getTime() - 7 * 86400000);
  
  const todayRecords: HistoryRecord[] = [];
  const yesterdayRecords: HistoryRecord[] = [];
  const thisWeekRecords: HistoryRecord[] = [];
  const olderRecords: HistoryRecord[] = [];
  
  records.forEach(record => {
    const date = new Date(record.createdAt);
    if (date >= today) {
      todayRecords.push(record);
    } else if (date >= yesterday) {
      yesterdayRecords.push(record);
    } else if (date >= thisWeek) {
      thisWeekRecords.push(record);
    } else {
      olderRecords.push(record);
    }
  });
  
  if (todayRecords.length > 0) groups.push({ date: '今天', records: todayRecords });
  if (yesterdayRecords.length > 0) groups.push({ date: '昨天', records: yesterdayRecords });
  if (thisWeekRecords.length > 0) groups.push({ date: '本周', records: thisWeekRecords });
  if (olderRecords.length > 0) groups.push({ date: '更早', records: olderRecords });
  
  return groups;
};

const ACTION_FILTERS: { value: HistoryAction | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'view', label: '浏览' },
  { value: 'edit', label: '编辑' },
  { value: 'rename', label: '重命名' },
  { value: 'move', label: '移动' },
  { value: 'tag', label: '标签' },
  { value: 'rate', label: '评分' },
  { value: 'delete', label: '删除' },
  { value: 'restore', label: '恢复' },
];

export function HistoryGrid({
  records,
  userSettings,
  onClearHistory,
  loading = false,
}: HistoryGridProps) {
  const [actionFilter, setActionFilter] = useState<HistoryAction | 'all'>('all');
  
  const primaryColor = userSettings?.primaryColor || '#00ffff';
  const secondaryColor = userSettings?.secondaryColor || '#ff00ff';
  
  // 过滤记录
  const filteredRecords = actionFilter === 'all' 
    ? records 
    : records.filter(r => r.action === actionFilter);
  
  // 按日期分组
  const groupedRecords = groupByDate(filteredRecords);
  
  // 统计各类型数量
  const actionCounts = records.reduce((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
            <FiClock size={20} style={{ color: primaryColor }} />
            <h2 className="text-lg font-semibold text-white">历史记录</h2>
            <span 
              className="px-2 py-0.5 text-sm rounded-full"
              style={{ background: `${primaryColor}20`, color: primaryColor }}
            >
              {filteredRecords.length} 条记录
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 类型筛选 */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: `${primaryColor}10` }}>
            {ACTION_FILTERS.map(filter => {
              const isActive = actionFilter === filter.value;
              const count = filter.value === 'all' ? records.length : (actionCounts[filter.value] || 0);
              
              return (
                <button
                  key={filter.value}
                  onClick={() => setActionFilter(filter.value)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    isActive ? 'font-medium' : 'hover:opacity-80'
                  }`}
                  style={{
                    background: isActive ? primaryColor : 'transparent',
                    color: isActive ? '#000' : `${primaryColor}80`,
                  }}
                >
                  {filter.label}
                  {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
          
          {records.length > 0 && (
            <button
              onClick={() => {
                if (confirm('确定要清空所有历史记录吗？')) {
                  onClearHistory();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
              style={{ background: `${secondaryColor}15`, color: secondaryColor, border: `1px solid ${secondaryColor}30` }}
            >
              <FiTrash2 size={14} />
              清空记录
            </button>
          )}
        </div>
      </div>
      
      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{ background: `${primaryColor}10` }}
            >
              <FiClock size={40} style={{ color: `${primaryColor}60` }} />
            </div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              {actionFilter === 'all' ? '暂无历史记录' : `暂无${ACTION_FILTERS.find(f => f.value === actionFilter)?.label}记录`}
            </h3>
            <p className="text-gray-500">您的文件操作记录将显示在这里</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedRecords.map(group => (
              <div key={group.date}>
                {/* 日期标题 */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 
                    className="text-sm font-medium px-3 py-1 rounded-full"
                    style={{ background: `${primaryColor}15`, color: primaryColor }}
                  >
                    {group.date}
                  </h3>
                  <div className="flex-1 h-px" style={{ background: `${primaryColor}20` }} />
                  <span className="text-xs" style={{ color: `${primaryColor}60` }}>
                    {group.records.length} 条
                  </span>
                </div>
                
                {/* 记录列表 */}
                <div className="space-y-2">
                  {group.records.map(record => {
                    const actionInfo = getActionInfo(record.action, record.details);
                    const ActionIcon = actionInfo.icon;
                    const FileIcon = getFileIcon(record.fileName);
                    const isFolder = record.details?.isFolder;
                    
                    return (
                      <div
                        key={record.id}
                        className="flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.01]"
                        style={{ 
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${primaryColor}10`,
                        }}
                      >
                        {/* 操作图标 */}
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: actionInfo.bgColor }}
                        >
                          <ActionIcon size={18} style={{ color: actionInfo.color }} />
                        </div>
                        
                        {/* 主要信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {isFolder ? (
                              <FiFolder size={14} style={{ color: `${primaryColor}` }} />
                            ) : (
                              <FileIcon size={14} style={{ color: `${primaryColor}60` }} />
                            )}
                            <span className="text-sm text-white font-medium truncate">
                              {record.fileName}
                            </span>
                            <span 
                              className="px-2 py-0.5 text-xs rounded-full"
                              style={{ background: actionInfo.bgColor, color: actionInfo.color }}
                            >
                              {actionInfo.label}
                            </span>
                          </div>
                          
                          {/* 详情 */}
                          {record.details && (
                            <div className="text-xs mb-1" style={{ color: `${primaryColor}70` }}>
                              {formatHistoryDetails(record.action, record.details)}
                            </div>
                          )}
                          
                          {/* 元信息 */}
                          <div className="flex items-center gap-3 text-xs" style={{ color: `${primaryColor}50` }}>
                            <span className="flex items-center gap-1">
                              <FiClock size={10} />
                              {formatTime(record.createdAt)}
                            </span>
                            {record.userName && (
                              <span className="flex items-center gap-1">
                                <FiUser size={10} />
                                {record.userName}
                              </span>
                            )}
                            {record.filePath && (
                              <span className="truncate max-w-[200px]" title={record.filePath}>
                                📁 {record.filePath}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* 时间戳 */}
                        <div 
                          className="text-xs text-right flex-shrink-0"
                          style={{ color: `${primaryColor}40` }}
                          title={formatFullTime(record.createdAt)}
                        >
                          {new Date(record.createdAt).toLocaleTimeString('zh-CN', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
