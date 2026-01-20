import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { useEffect, useRef, useState, useCallback } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const typeStyles = {
  danger: {
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    buttonBg: 'bg-red-500 hover:bg-red-600',
    borderColor: 'border-red-500/30',
  },
  warning: {
    iconBg: 'bg-yellow-500/20',
    iconColor: 'text-yellow-400',
    buttonBg: 'bg-yellow-500 hover:bg-yellow-600',
    borderColor: 'border-yellow-500/30',
  },
  info: {
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    buttonBg: 'bg-cyan-500 hover:bg-cyan-600',
    borderColor: 'border-cyan-500/30',
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  
  const styles = typeStyles[type];

  // 键盘事件处理
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    confirmButtonRef.current?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div
        ref={dialogRef}
        className={`relative w-full max-w-md bg-cyber-surface border ${styles.borderColor} rounded-xl shadow-2xl animate-scale-in`}
        style={{
          background: 'rgba(15, 15, 25, 0.98)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <FiX size={18} />
        </button>

        <div className="p-6">
          {/* 图标 */}
          <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4 mx-auto`}>
            <FiAlertTriangle size={24} className={styles.iconColor} />
          </div>

          {/* 标题 */}
          <h3 className="text-lg font-semibold text-white text-center mb-2">
            {title}
          </h3>

          {/* 消息 */}
          <p className="text-gray-400 text-center text-sm mb-6">
            {message}
          </p>

          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              {cancelText}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-lg ${styles.buttonBg} text-white font-medium transition-colors`}
            >
              {confirmText}
            </button>
          </div>
        </div>

        {/* 键盘提示 */}
        <div className="px-6 pb-4 flex justify-center gap-4 text-xs text-gray-500">
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Enter</kbd> 确认</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> 取消</span>
        </div>
      </div>
    </div>
  );
}

// useConfirm Hook - 用于简化确认对话框的使用
interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface UseConfirmReturn {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialogProps: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
  };
}

export function useConfirm(): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return {
    confirm,
    dialogProps: {
      isOpen,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      type: options.type,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
