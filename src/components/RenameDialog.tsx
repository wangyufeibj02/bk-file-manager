import { useState, useEffect, useRef } from 'react';
import { FiEdit3, FiX, FiCheck } from 'react-icons/fi';
import { UserSettings } from '../types';

interface RenameDialogProps {
  isOpen: boolean;
  currentName: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
  userSettings?: UserSettings;
}

export function RenameDialog({
  isOpen,
  currentName,
  onRename,
  onCancel,
  userSettings,
}: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const primaryColor = userSettings?.primaryColor || '#00ffff';

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      // 聚焦并选中文件名（不含扩展名）
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIndex = currentName.lastIndexOf('.');
          if (dotIndex > 0) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== currentName) {
      onRename(trimmedName);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl p-6 animate-scale-in"
        style={{
          background: 'rgba(15, 15, 25, 0.98)',
          border: `1px solid ${primaryColor}40`,
          boxShadow: `0 0 40px ${primaryColor}20`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <FiX size={18} className="text-gray-400" />
        </button>

        {/* 图标 */}
        <div 
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: `${primaryColor}20` }}
        >
          <FiEdit3 size={28} style={{ color: primaryColor }} />
        </div>

        {/* 标题 */}
        <h3 className="text-xl font-bold text-center text-white mb-6">
          重命名文件
        </h3>

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 rounded-xl bg-black/40 border text-white placeholder-gray-500 
              focus:outline-none transition-all font-mono"
            style={{
              borderColor: `${primaryColor}40`,
              boxShadow: `0 0 10px ${primaryColor}20`,
            }}
            placeholder="输入新文件名..."
          />

          {/* 按钮 */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl font-medium transition-all hover:bg-white/10 flex items-center justify-center gap-2"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#999',
              }}
            >
              <FiX size={16} />
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName}
              className="flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${userSettings?.secondaryColor || '#ff00ff'})`,
                color: '#000',
                boxShadow: `0 0 20px ${primaryColor}40`,
              }}
            >
              <FiCheck size={16} />
              确认
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
