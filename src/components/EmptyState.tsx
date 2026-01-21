import { FiUpload, FiFolder, FiSearch, FiFile } from 'react-icons/fi';

interface EmptyStateProps {
  type: 'files' | 'folder' | 'search' | 'trash';
  onUpload?: () => void;
  onCreateFolder?: () => void;
  searchQuery?: string;
}

export function EmptyState({ type, onUpload, onCreateFolder, searchQuery }: EmptyStateProps) {
  const getContent = () => {
    switch (type) {
      case 'files':
        return {
          icon: <FiFile size={64} className="text-gray-500" />,
          title: '还没有文件',
          description: '上传您的第一个文件，开始管理您的数字资产',
          action: onUpload ? (
            <button
              onClick={onUpload}
              className="mt-6 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FiUpload size={20} />
              <span>立即上传</span>
            </button>
          ) : null,
        };
      
      case 'folder':
        return {
          icon: <FiFolder size={64} className="text-gray-500" />,
          title: '文件夹为空',
          description: '这个文件夹还没有文件，上传一些文件开始使用吧',
          action: onUpload ? (
            <button
              onClick={onUpload}
              className="mt-6 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FiUpload size={20} />
              <span>上传文件</span>
            </button>
          ) : null,
        };
      
      case 'search':
        return {
          icon: <FiSearch size={64} className="text-gray-500" />,
          title: '未找到结果',
          description: searchQuery 
            ? `没有找到与"${searchQuery}"相关的文件`
            : '尝试使用不同的关键词搜索',
          action: null,
        };
      
      case 'trash':
        return {
          icon: <FiFile size={64} className="text-gray-500" />,
          title: '回收站为空',
          description: '已删除的文件会显示在这里，您可以恢复或永久删除它们',
          action: null,
        };
      
      default:
        return {
          icon: <FiFile size={64} className="text-gray-500" />,
          title: '暂无内容',
          description: '',
          action: null,
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-6 flex justify-center">
          {content.icon}
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {content.title}
        </h3>
        <p className="text-gray-400 mb-6">
          {content.description}
        </p>
        {content.action}
        
        {/* 提示信息 */}
        {type === 'files' && (
          <div className="mt-8 text-sm text-gray-500">
            <p className="mb-2">💡 提示：</p>
            <ul className="text-left space-y-1 max-w-xs mx-auto">
              <li>• 支持拖拽文件到页面直接上传</li>
              <li>• 支持批量上传多个文件</li>
              <li>• 支持图片、视频、3D模型等多种格式</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
