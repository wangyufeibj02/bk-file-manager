import { useState } from 'react';
import { FiX, FiSearch, FiCalendar, FiFile, FiStar } from 'react-icons/fi';

interface AdvancedSearchFilters {
  search?: string;
  fileSizeMin?: number; // MB
  fileSizeMax?: number; // MB
  dateFrom?: string;
  dateTo?: string;
  rating?: number;
  format?: string;
}

interface AdvancedSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: AdvancedSearchFilters) => void;
  currentFilters?: AdvancedSearchFilters;
}

export function AdvancedSearchPanel({
  isOpen,
  onClose,
  onSearch,
  currentFilters = {},
}: AdvancedSearchPanelProps) {
  const [filters, setFilters] = useState<AdvancedSearchFilters>(currentFilters);

  if (!isOpen) return null;

  const handleSearch = () => {
    onSearch(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
    onSearch({});
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* 面板 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4">
        <div className="bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FiSearch size={24} className="text-cyan-400" />
              高级搜索
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <FiX className="text-gray-400" size={20} />
            </button>
          </div>

          {/* 搜索表单 */}
          <div className="space-y-4">
            {/* 关键词搜索 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                关键词
              </label>
              <input
                type="text"
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="文件名、标签等"
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* 文件大小 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                文件大小 (MB)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={filters.fileSizeMin || ''}
                  onChange={(e) => setFilters({ ...filters, fileSizeMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="最小"
                  className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  value={filters.fileSizeMax || ''}
                  onChange={(e) => setFilters({ ...filters, fileSizeMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="最大"
                  className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* 日期范围 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiCalendar size={16} />
                日期范围
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                  className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <span className="text-gray-400">至</span>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                  className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* 评分 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiStar size={16} />
                最低评分
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => setFilters({ ...filters, rating: filters.rating === rating ? undefined : rating })}
                    className={`w-10 h-10 rounded-lg transition-colors ${
                      filters.rating && filters.rating <= rating
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
                {filters.rating && (
                  <button
                    onClick={() => setFilters({ ...filters, rating: undefined })}
                    className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>

            {/* 文件格式 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <FiFile size={16} />
                文件格式
              </label>
              <select
                value={filters.format || ''}
                onChange={(e) => setFilters({ ...filters, format: e.target.value || undefined })}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="">全部格式</option>
                <option value="image">图片</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
                <option value="document">文档</option>
                <option value="model">3D模型</option>
              </select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              重置
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
