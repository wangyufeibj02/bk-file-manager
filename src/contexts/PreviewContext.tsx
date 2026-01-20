import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FileItem } from '../types';

interface PreviewContextValue {
  // 当前预览的文件
  previewFile: FileItem | null;
  // 当前悬浮的文件
  hoveredFile: FileItem | null;
  // 当前选中的文件列表
  selectedFiles: string[];
  // 所有文件列表（用于导航）
  files: FileItem[];
  
  // 操作方法
  setPreviewFile: (file: FileItem | null) => void;
  setHoveredFile: (file: FileItem | null) => void;
  setSelectedFiles: (files: string[]) => void;
  setFiles: (files: FileItem[]) => void;
  
  // 快捷操作
  openPreview: (file: FileItem) => void;
  closePreview: () => void;
  togglePreview: () => void;
  navigatePreview: (direction: 'prev' | 'next') => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [hoveredFile, setHoveredFile] = useState<FileItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  const openPreview = useCallback((file: FileItem) => {
    setPreviewFile(file);
    setSelectedFiles([file.id]);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  const togglePreview = useCallback(() => {
    if (previewFile) {
      // 如果已经在预览，关闭
      setPreviewFile(null);
    } else {
      // 优先预览悬浮的文件
      if (hoveredFile) {
        setPreviewFile(hoveredFile);
        setSelectedFiles([hoveredFile.id]);
      } else if (selectedFiles.length > 0) {
        // 其次预览选中的第一个文件
        const fileToPreview = files.find(f => f.id === selectedFiles[0]);
        if (fileToPreview) {
          setPreviewFile(fileToPreview);
        }
      }
    }
  }, [previewFile, hoveredFile, selectedFiles, files]);

  const navigatePreview = useCallback((direction: 'prev' | 'next') => {
    if (!previewFile || files.length === 0) return;
    
    const currentIndex = files.findIndex(f => f.id === previewFile.id);
    if (currentIndex === -1) return;
    
    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : files.length - 1;
    } else {
      newIndex = currentIndex < files.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newFile = files[newIndex];
    setPreviewFile(newFile);
    setSelectedFiles([newFile.id]);
  }, [previewFile, files]);

  const value: PreviewContextValue = {
    previewFile,
    hoveredFile,
    selectedFiles,
    files,
    setPreviewFile,
    setHoveredFile,
    setSelectedFiles,
    setFiles,
    openPreview,
    closePreview,
    togglePreview,
    navigatePreview,
  };

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error('usePreview must be used within PreviewProvider');
  }
  return context;
}
