import { useState, useCallback, ReactNode } from 'react';
import { FiUploadCloud } from 'react-icons/fi';

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  children: ReactNode;
}

export function UploadZone({ onUpload, isUploading, children }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  void dragCounter; // suppress unused warning

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
      onUpload(files);
    }
  }, [onUpload]);

  return (
    <div
      className="flex-1 relative flex flex-col min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-eagle-accent/10 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-eagle-accent/20 flex items-center justify-center drop-zone-active border-4 border-dashed border-eagle-accent">
              <FiUploadCloud size={48} className="text-eagle-accent" />
            </div>
            <h3 className="text-xl font-medium text-eagle-text mb-2">
              释放以上传文件
            </h3>
            <p className="text-eagle-textSecondary">
              支持图片、视频、音频和文档
            </p>
          </div>
        </div>
      )}

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-eagle-accent border-t-transparent rounded-full animate-spin" />
            <h3 className="text-lg font-medium text-white">
              上传中...
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}
