import { useState } from 'react';
import { 
  FiFileText, 
  FiGrid, 
  FiMonitor, 
  FiDownload,
  FiExternalLink,
  FiFile
} from 'react-icons/fi';

interface OfficePreviewProps {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getOfficeInfo(mimeType: string, fileName: string): { 
  icon: React.ReactNode; 
  color: string; 
  type: string;
  extension: string;
} {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType.includes('word') || mimeType.includes('document') || ext === 'doc' || ext === 'docx') {
    return {
      icon: <FiFileText size={64} />,
      color: '#2563eb',
      type: 'Word 文档',
      extension: ext.toUpperCase(),
    };
  }
  
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx') {
    return {
      icon: <FiGrid size={64} />,
      color: '#16a34a',
      type: 'Excel 表格',
      extension: ext.toUpperCase(),
    };
  }
  
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || ext === 'ppt' || ext === 'pptx') {
    return {
      icon: <FiMonitor size={64} />,
      color: '#ea580c',
      type: 'PowerPoint 演示文稿',
      extension: ext.toUpperCase(),
    };
  }
  
  return {
    icon: <FiFile size={64} />,
    color: '#6b7280',
    type: 'Office 文档',
    extension: ext.toUpperCase(),
  };
}

export function OfficePreview({ url, fileName, mimeType, fileSize }: OfficePreviewProps) {
  const [useOnlineViewer, setUseOnlineViewer] = useState(false);
  const officeInfo = getOfficeInfo(mimeType, fileName);
  
  // Check if it's a local file (absolute path)
  const isLocalFile = url.includes('/local-file?path=');
  
  // Microsoft Office Online Viewer URL (only works for publicly accessible files)
  const onlineViewerUrl = isLocalFile 
    ? null 
    : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin + url)}`;

  if (useOnlineViewer && onlineViewerUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 bg-black/50">
          <span className="text-white text-sm">{fileName}</span>
          <button
            onClick={() => setUseOnlineViewer(false)}
            className="px-3 py-1 text-sm text-white hover:bg-white/10 rounded"
          >
            返回
          </button>
        </div>
        <iframe
          src={onlineViewerUrl}
          className="flex-1 w-full bg-white"
          title={fileName}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div 
          className="w-32 h-32 mx-auto mb-6 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${officeInfo.color}20` }}
        >
          <div style={{ color: officeInfo.color }}>
            {officeInfo.icon}
          </div>
        </div>

        {/* File Info */}
        <h2 className="text-xl font-semibold text-white mb-2 break-all">
          {fileName}
        </h2>
        <p className="text-eagle-textSecondary mb-1">{officeInfo.type}</p>
        <p className="text-eagle-textSecondary text-sm mb-6">
          {formatFileSize(fileSize)}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <a
            href={url}
            download={fileName}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
          >
            <FiDownload size={18} />
            下载文件
          </a>
          
          {!isLocalFile && onlineViewerUrl && (
            <button
              onClick={() => setUseOnlineViewer(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <FiExternalLink size={18} />
              在线预览
            </button>
          )}
          
          {isLocalFile && (
            <p className="text-eagle-textSecondary text-sm mt-2">
              💡 本地文件可直接使用系统默认程序打开
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
