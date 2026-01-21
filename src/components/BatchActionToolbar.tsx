import { useState } from 'react';
import { 
  FiTrash2, 
  FiMove, 
  FiTag, 
  FiEdit3, 
  FiX,
  FiCopy,
  FiDownload
} from 'react-icons/fi';
import { Folder, Tag } from '../types';

interface BatchActionToolbarProps {
  selectedCount: number;
  folders: Folder[];
  tags: Tag[];
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
  onAddTag: (tagIds: string[]) => void;
  onRename?: () => void;
  onCopy?: () => void;
  onDownload?: () => void;
  onCancel: () => void;
}

export function BatchActionToolbar({
  selectedCount,
  folders,
  tags,
  onDelete,
  onMove,
  onAddTag,
  onRename,
  onCopy,
  onDownload,
  onCancel,
}: BatchActionToolbarProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl px-6 py-4">
        <div className="flex items-center gap-4">
          {/* 选中数量 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <span className="text-cyan-400 font-semibold">{selectedCount}</span>
            </div>
            <span className="text-white font-medium">
              已选中 {selectedCount} 个文件
            </span>
          </div>

          <div className="h-6 w-px bg-gray-700" />

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {/* 移动 */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowMoveMenu(!showMoveMenu);
                  setShowTagMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                <FiMove size={18} />
                <span>移动</span>
              </button>
              {showMoveMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoveMenu(false)}
                  />
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          onMove(null);
                          setShowMoveMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg text-white transition-colors"
                      >
                        全部文件
                      </button>
                      {folders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            onMove(folder.id);
                            setShowMoveMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg text-white transition-colors"
                        >
                          {folder.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 复制 */}
            {onCopy && (
              <button
                onClick={onCopy}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                <FiCopy size={18} />
                <span>复制</span>
              </button>
            )}

            {/* 添加标签 */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowTagMenu(!showTagMenu);
                  setShowMoveMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                <FiTag size={18} />
                <span>标签</span>
              </button>
              {showTagMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowTagMenu(false)}
                  />
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {tags.length === 0 ? (
                        <div className="px-3 py-2 text-gray-400 text-sm">
                          暂无标签
                        </div>
                      ) : (
                        tags.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => {
                              onAddTag([tag.id]);
                              setShowTagMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-800 rounded-lg text-white transition-colors flex items-center gap-2"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color || '#888' }}
                            />
                            <span>{tag.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 重命名 */}
            {onRename && (
              <button
                onClick={onRename}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                <FiEdit3 size={18} />
                <span>重命名</span>
              </button>
            )}

            {/* 下载 */}
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                <FiDownload size={18} />
                <span>下载</span>
              </button>
            )}

            {/* 删除 */}
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
            >
              <FiTrash2 size={18} />
              <span>删除</span>
            </button>

            {/* 取消 */}
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
