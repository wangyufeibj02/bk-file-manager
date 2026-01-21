import { useState, useEffect } from 'react';
import { FiX, FiCopy, FiCheck, FiLink, FiClock, FiLock } from 'react-icons/fi';

interface ShareLink {
  id: string;
  fileId: string;
  shareUrl: string;
  expiresAt?: string;
  createdAt: string;
  password?: string;
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  onCreateShare: (options?: { expiresIn?: number; password?: string }) => Promise<{ shareId: string; shareUrl: string }>;
  onGetShares: () => Promise<ShareLink[]>;
  onDeleteShare: (shareId: string) => Promise<void>;
}

export function ShareDialog({
  isOpen,
  onClose,
  fileId,
  fileName,
  onCreateShare,
  onGetShares,
  onDeleteShare,
}: ShareDialogProps) {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(7); // 默认7天
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadShareLinks();
    }
  }, [isOpen, fileId]);

  const loadShareLinks = async () => {
    try {
      const links = await onGetShares();
      setShareLinks(links.filter(link => link.fileId === fileId));
    } catch (err) {
      console.error('Failed to load share links:', err);
    }
  };

  const handleCreateShare = async () => {
    setLoading(true);
    try {
      const result = await onCreateShare({
        expiresIn: expiresIn * 24 * 60 * 60 * 1000, // 转换为毫秒
        password: password.trim() || undefined,
      });
      await loadShareLinks();
      setPassword('');
    } catch (err) {
      console.error('Failed to create share link:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (shareUrl: string, shareId: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      await onDeleteShare(shareId);
      await loadShareLinks();
    } catch (err) {
      console.error('Failed to delete share link:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg mx-4">
        <div className="bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FiLink size={24} className="text-cyan-400" />
              分享文件
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <FiX className="text-gray-400" size={20} />
            </button>
          </div>

          {/* 文件信息 */}
          <div className="mb-6 p-3 bg-gray-900/50 rounded-lg">
            <p className="text-sm text-gray-400 mb-1">文件</p>
            <p className="text-white font-medium truncate">{fileName}</p>
          </div>

          {/* 创建分享链接 */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                有效期（天）
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value={1}>1天</option>
                <option value={7}>7天</option>
                <option value={30}>30天</option>
                <option value={365}>1年</option>
                <option value={0}>永久</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiLock size={16} />
                访问密码（可选）
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="留空表示无密码"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <button
              onClick={handleCreateShare}
              disabled={loading}
              className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? '创建中...' : '创建分享链接'}
            </button>
          </div>

          {/* 已有分享链接 */}
          {shareLinks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">已有分享链接</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shareLinks.map(link => (
                  <div
                    key={link.id}
                    className="p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FiLink size={14} className="text-gray-400" />
                          <span className="text-xs text-gray-400 truncate">{link.shareUrl}</span>
                        </div>
                        {link.expiresAt && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <FiClock size={12} />
                            <span>过期时间: {new Date(link.expiresAt).toLocaleString('zh-CN')}</span>
                          </div>
                        )}
                        {link.password && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <FiLock size={12} />
                            <span>已设置密码</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyLink(link.shareUrl, link.id)}
                          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                          title="复制链接"
                        >
                          {copiedId === link.id ? (
                            <FiCheck className="text-green-400" size={18} />
                          ) : (
                            <FiCopy className="text-gray-400" size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteShare(link.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="删除"
                        >
                          <FiX className="text-red-400" size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
