import React, { useEffect, useCallback, useRef } from 'react';

// 快捷键定义
export interface HotkeyConfig {
  key: string;           // 键名（如 'Space', 'Escape', 'Delete'）
  ctrl?: boolean;        // 是否需要 Ctrl
  shift?: boolean;       // 是否需要 Shift
  alt?: boolean;         // 是否需要 Alt
  meta?: boolean;        // 是否需要 Meta (Cmd on Mac)
  handler: (e: KeyboardEvent) => void;
  description?: string;  // 描述
  enabled?: boolean;     // 是否启用
}

// 检查是否在输入框中
function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

// 获取键名标准化
function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'Escape': 'Escape',
    'Esc': 'Escape',
    'Enter': 'Enter',
    'Return': 'Enter',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Del': 'Delete',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft',
    'ArrowRight': 'ArrowRight',
    'Tab': 'Tab',
  };
  return keyMap[key] || key;
}

// 检查快捷键是否匹配
function matchHotkey(e: KeyboardEvent, config: HotkeyConfig): boolean {
  const key = normalizeKey(e.key);
  const code = e.code;
  
  // 检查键是否匹配（支持 key 或 code）
  if (key !== config.key && code !== config.key) {
    return false;
  }
  
  // 检查修饰键
  if (config.ctrl && !e.ctrlKey) return false;
  if (config.shift && !e.shiftKey) return false;
  if (config.alt && !e.altKey) return false;
  if (config.meta && !e.metaKey) return false;
  
  // 如果配置没有要求修饰键，检查是否误按了
  if (!config.ctrl && e.ctrlKey) return false;
  if (!config.shift && e.shiftKey) return false;
  if (!config.alt && e.altKey) return false;
  if (!config.meta && e.metaKey) return false;
  
  return true;
}

// 快捷键 Hook
export function useHotkeys(
  hotkeys: HotkeyConfig[],
  deps: React.DependencyList = []
) {
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 在输入框中不处理（除非是 Escape）
      if (isInputElement(e.target) && e.key !== 'Escape') {
        return;
      }

      for (const config of hotkeysRef.current) {
        // 检查是否启用
        if (config.enabled === false) continue;
        
        if (matchHotkey(e, config)) {
          e.preventDefault();
          e.stopPropagation();
          config.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, deps);
}

// 预定义常用快捷键
export const HOTKEY_PRESETS = {
  // 预览
  SPACE_PREVIEW: { key: 'Space', description: '空格预览' },
  ESCAPE: { key: 'Escape', description: 'ESC 关闭' },
  
  // 导航
  ARROW_LEFT: { key: 'ArrowLeft', description: '上一个' },
  ARROW_RIGHT: { key: 'ArrowRight', description: '下一个' },
  ARROW_UP: { key: 'ArrowUp', description: '向上' },
  ARROW_DOWN: { key: 'ArrowDown', description: '向下' },
  
  // 编辑
  DELETE: { key: 'Delete', description: '删除' },
  BACKSPACE: { key: 'Backspace', description: '删除' },
  ENTER: { key: 'Enter', description: '确认' },
  
  // 组合键
  CTRL_A: { key: 'a', ctrl: true, description: '全选' },
  CTRL_C: { key: 'c', ctrl: true, description: '复制' },
  CTRL_V: { key: 'v', ctrl: true, description: '粘贴' },
  CTRL_Z: { key: 'z', ctrl: true, description: '撤销' },
  CTRL_S: { key: 's', ctrl: true, description: '保存' },
  CTRL_F: { key: 'f', ctrl: true, description: '搜索' },
  
  // 缩放
  ZOOM_IN: { key: '=', description: '放大' },
  ZOOM_OUT: { key: '-', description: '缩小' },
  ZOOM_RESET: { key: '0', description: '重置' },
  
  // 信息
  INFO: { key: 'i', description: '信息面板' },
};

// 快捷键提示组件（使用 createElement 以支持 .ts 文件）
export function HotkeyHint({ 
  hotkey, 
  className = '' 
}: { 
  hotkey: string; 
  className?: string;
}) {
  return React.createElement(
    'kbd',
    { className: `px-1.5 py-0.5 text-xs bg-white/10 rounded border border-white/20 ${className}` },
    hotkey
  );
}

// 全局快捷键管理器（用于动态注册/注销）
class HotkeyManager {
  private handlers: Map<string, HotkeyConfig> = new Map();
  private listener: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    this.listener = (e: KeyboardEvent) => {
      if (isInputElement(e.target) && e.key !== 'Escape') {
        return;
      }

      for (const [, config] of this.handlers) {
        if (config.enabled === false) continue;
        if (matchHotkey(e, config)) {
          e.preventDefault();
          e.stopPropagation();
          config.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', this.listener);
  }

  register(id: string, config: HotkeyConfig) {
    this.handlers.set(id, config);
  }

  unregister(id: string) {
    this.handlers.delete(id);
  }

  setEnabled(id: string, enabled: boolean) {
    const config = this.handlers.get(id);
    if (config) {
      config.enabled = enabled;
    }
  }

  destroy() {
    if (this.listener) {
      window.removeEventListener('keydown', this.listener);
    }
    this.handlers.clear();
  }
}

export const hotkeyManager = new HotkeyManager();
