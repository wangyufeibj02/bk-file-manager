import { useEffect, useState } from 'react';
import { FiRotateCcw, FiX } from 'react-icons/fi';

interface UndoToastProps {
  action: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function UndoToast({ action, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // 等待动画完成
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div className="bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-2xl px-4 py-3 flex items-center gap-4 min-w-[300px]">
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{action}</p>
          <p className="text-gray-400 text-xs mt-0.5">按 Ctrl+Z 撤销</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onUndo();
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <FiRotateCcw size={14} />
            <span>撤销</span>
          </button>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <FiX className="text-gray-400" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
