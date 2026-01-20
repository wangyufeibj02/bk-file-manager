import { useState } from 'react';
import { FiFolder, FiX, FiSearch, FiCheck, FiAlertCircle } from 'react-icons/fi';

interface ScanPreview {
  path: string;
  name: string;
  totalFiles: number;
  totalFolders: number;
  fileTypes: Record<string, number>;
  sampleFiles: { name: string; type: string; size: number; folder: string }[];
}

interface ScanResult {
  success: boolean;
  message: string;
  result: {
    totalFiles: number;
    folders: number;
    fileTypes: Record<string, number>;
    errors: string[];
  };
}

interface ScanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanPreview: (path: string) => Promise<ScanPreview>;
  onScanDirectory: (path: string, createRootFolder: boolean) => Promise<ScanResult>;
  onScanComplete: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function ScanDialog({
  isOpen,
  onClose,
  onScanPreview,
  onScanDirectory,
  onScanComplete,
}: ScanDialogProps) {
  const [directoryPath, setDirectoryPath] = useState('');
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [createRootFolder, setCreateRootFolder] = useState(true);

  const handlePreview = async () => {
    if (!directoryPath.trim()) return;
    
    setLoading(true);
    setError(null);
    setPreview(null);
    
    try {
      const data = await onScanPreview(directoryPath.trim());
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!directoryPath.trim()) return;
    
    setScanning(true);
    setError(null);
    
    try {
      const data = await onScanDirectory(directoryPath.trim(), createRootFolder);
      setResult(data);
      onScanComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const handleClose = () => {
    setDirectoryPath('');
    setPreview(null);
    setError(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-eagle-sidebar border border-eagle-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-eagle-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-eagle-accent/20 flex items-center justify-center">
              <FiFolder className="text-eagle-accent" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-eagle-text">扫描文件夹</h2>
              <p className="text-sm text-eagle-textSecondary">自动按文件夹和类型分类</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-eagle-hover rounded-lg transition-colors"
          >
            <FiX size={20} className="text-eagle-textSecondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* Path Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-eagle-textSecondary mb-2">
              文件夹路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                placeholder="例如: D:\Projects\Images 或 C:\Users\Documents"
                className="flex-1 px-4 py-3 bg-eagle-bg border border-eagle-border rounded-lg text-eagle-text placeholder-eagle-textSecondary focus:outline-none focus:border-eagle-accent transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
              />
              <button
                onClick={handlePreview}
                disabled={loading || !directoryPath.trim()}
                className="px-4 py-3 bg-eagle-hover hover:bg-eagle-border text-eagle-text rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FiSearch size={18} />
                预览
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createRootFolder}
                onChange={(e) => setCreateRootFolder(e.target.checked)}
                className="w-5 h-5 rounded border-eagle-border bg-eagle-bg checked:bg-eagle-accent"
              />
              <span className="text-sm text-eagle-text">创建根文件夹（以扫描目录名命名）</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <FiAlertCircle className="text-red-400" size={20} />
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-eagle-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Preview */}
          {preview && !result && (
            <div className="space-y-4">
              <div className="p-4 bg-eagle-bg rounded-lg">
                <h3 className="text-sm font-medium text-eagle-textSecondary mb-3">文件夹信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-eagle-text">{preview.totalFiles}</div>
                    <div className="text-sm text-eagle-textSecondary">个文件</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-eagle-text">{preview.totalFolders}</div>
                    <div className="text-sm text-eagle-textSecondary">个子文件夹</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-eagle-bg rounded-lg">
                <h3 className="text-sm font-medium text-eagle-textSecondary mb-3">文件类型分布</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.fileTypes).map(([type, count]) => (
                    <div
                      key={type}
                      className="px-3 py-1.5 bg-eagle-hover rounded-full text-sm"
                    >
                      <span className="text-eagle-text">{type}</span>
                      <span className="text-eagle-textSecondary ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {preview.sampleFiles.length > 0 && (
                <div className="p-4 bg-eagle-bg rounded-lg">
                  <h3 className="text-sm font-medium text-eagle-textSecondary mb-3">
                    示例文件（前 {preview.sampleFiles.length} 个）
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {preview.sampleFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 border-b border-eagle-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-eagle-text truncate">{file.name}</div>
                          <div className="text-xs text-eagle-textSecondary">{file.folder}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-eagle-hover rounded text-xs text-eagle-textSecondary">
                            {file.type}
                          </span>
                          <span className="text-xs text-eagle-textSecondary">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <FiCheck className="text-green-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">扫描完成！</h3>
                <p className="text-eagle-textSecondary">{result.message}</p>
              </div>

              <div className="p-4 bg-eagle-bg rounded-lg">
                <h3 className="text-sm font-medium text-eagle-textSecondary mb-3">扫描结果</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-bold text-eagle-text">{result.result.totalFiles}</div>
                    <div className="text-sm text-eagle-textSecondary">个文件已导入</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-eagle-text">{result.result.folders}</div>
                    <div className="text-sm text-eagle-textSecondary">个文件夹已创建</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.result.fileTypes).map(([type, count]) => (
                    <div
                      key={type}
                      className="px-3 py-1.5 bg-eagle-hover rounded-full text-sm"
                    >
                      <span className="text-eagle-text">{type}</span>
                      <span className="text-eagle-textSecondary ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {result.result.errors.length > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <h3 className="text-sm font-medium text-yellow-400 mb-2">
                    {result.result.errors.length} 个文件处理失败
                  </h3>
                  <div className="text-xs text-eagle-textSecondary max-h-32 overflow-y-auto">
                    {result.result.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className="py-1">{err}</div>
                    ))}
                    {result.result.errors.length > 10 && (
                      <div className="py-1">...还有 {result.result.errors.length - 10} 个错误</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-eagle-border flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-eagle-textSecondary hover:text-eagle-text transition-colors"
          >
            {result ? '完成' : '取消'}
          </button>
          {preview && !result && (
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-6 py-2 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  扫描中...
                </>
              ) : (
                <>
                  <FiFolder size={18} />
                  开始扫描
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
