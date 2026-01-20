import { useEffect, useState } from 'react';

/**
 * 响应式缩放 hook
 * 根据窗口大小自动调整页面缩放比例
 */
export function useResponsiveScale(
  baseWidth: number = 1920,  // 基准宽度
  minScale: number = 0.7,    // 最小缩放比例
  maxScale: number = 1.2     // 最大缩放比例
) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const windowWidth = window.innerWidth;
      let newScale = windowWidth / baseWidth;
      
      // 限制缩放范围
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      
      setScale(newScale);
      
      // 更新 CSS 变量供全局使用
      document.documentElement.style.setProperty('--app-scale', String(newScale));
      
      // 更新根字体大小实现整体缩放
      const baseFontSize = 16;
      document.documentElement.style.fontSize = `${baseFontSize * newScale}px`;
    }

    // 初始化
    updateScale();

    // 监听窗口大小变化
    window.addEventListener('resize', updateScale);
    
    return () => window.removeEventListener('resize', updateScale);
  }, [baseWidth, minScale, maxScale]);

  return scale;
}

/**
 * 简单的缩放值获取（不自动应用到 DOM）
 */
export function getScaleFactor(baseWidth: number = 1920): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(0.7, Math.min(1.2, window.innerWidth / baseWidth));
}
