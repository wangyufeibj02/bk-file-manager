import { Toaster, toast } from 'react-hot-toast';
import { FiCheck, FiX, FiInfo, FiAlertTriangle } from 'react-icons/fi';

// Toast 通知类型
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// 自定义 Toast 样式
const toastStyles = {
  success: {
    icon: <FiCheck className="text-green-400" size={18} />,
    style: {
      background: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid rgba(34, 197, 94, 0.5)',
      color: '#fff',
      boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
    },
  },
  error: {
    icon: <FiX className="text-red-400" size={18} />,
    style: {
      background: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid rgba(239, 68, 68, 0.5)',
      color: '#fff',
      boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
    },
  },
  info: {
    icon: <FiInfo className="text-cyan-400" size={18} />,
    style: {
      background: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid rgba(0, 255, 255, 0.5)',
      color: '#fff',
      boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
    },
  },
  warning: {
    icon: <FiAlertTriangle className="text-yellow-400" size={18} />,
    style: {
      background: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid rgba(234, 179, 8, 0.5)',
      color: '#fff',
      boxShadow: '0 0 20px rgba(234, 179, 8, 0.3)',
    },
  },
};

// 显示 Toast 通知
export function showToast(message: string, type: ToastType = 'info') {
  const config = toastStyles[type];
  toast(message, {
    icon: config.icon,
    style: config.style,
    duration: type === 'error' ? 5000 : 3000,
  });
}

// 成功通知
export function showSuccess(message: string) {
  showToast(message, 'success');
}

// 错误通知
export function showError(message: string) {
  showToast(message, 'error');
}

// 信息通知
export function showInfo(message: string) {
  showToast(message, 'info');
}

// 警告通知
export function showWarning(message: string) {
  showToast(message, 'warning');
}

// 加载中通知
export function showLoading(message: string) {
  return toast.loading(message, {
    style: {
      background: 'rgba(20, 20, 30, 0.95)',
      border: '1px solid rgba(0, 255, 255, 0.3)',
      color: '#fff',
    },
  });
}

// 关闭加载通知
export function dismissLoading(toastId: string) {
  toast.dismiss(toastId);
}

// 更新通知
export function updateToast(toastId: string, message: string, type: ToastType) {
  const config = toastStyles[type];
  toast(message, {
    id: toastId,
    icon: config.icon,
    style: config.style,
  });
}

// Toast 容器组件
export function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'cyber-toast',
        duration: 3000,
      }}
      containerStyle={{
        top: 80,
        right: 20,
      }}
      gutter={8}
    />
  );
}

// 别名导出，兼容不同的导入方式
export const ToastProvider = ToastContainer;
