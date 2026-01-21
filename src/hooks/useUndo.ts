import { useState, useCallback, useRef } from 'react';

export interface UndoAction {
  id: string;
  type: 'delete' | 'move' | 'rename' | 'tag' | 'upload';
  description: string;
  undo: () => Promise<void>;
  timestamp: number;
}

const MAX_HISTORY = 10;

export function useUndo() {
  const [history, setHistory] = useState<UndoAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const historyRef = useRef<UndoAction[]>([]);

  const addAction = useCallback((action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    const newAction: UndoAction = {
      ...action,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    setHistory(prev => {
      const newHistory = [newAction, ...prev].slice(0, MAX_HISTORY);
      historyRef.current = newHistory;
      setCanUndo(newHistory.length > 0);
      return newHistory;
    });
  }, []);

  const undo = useCallback(async () => {
    if (historyRef.current.length === 0) return;

    const action = historyRef.current[0];
    try {
      await action.undo();
      setHistory(prev => {
        const newHistory = prev.slice(1);
        historyRef.current = newHistory;
        setCanUndo(newHistory.length > 0);
        return newHistory;
      });
    } catch (err) {
      console.error('Undo failed:', err);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    historyRef.current = [];
    setCanUndo(false);
  }, []);

  return {
    history,
    canUndo,
    addAction,
    undo,
    clearHistory,
  };
}
