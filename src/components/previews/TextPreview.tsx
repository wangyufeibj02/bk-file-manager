import { useState, useEffect } from 'react';
import { FiDownload, FiCopy, FiCheck } from 'react-icons/fi';

interface TextPreviewProps {
  url: string;
  fileName: string;
}

export function TextPreview({ url, fileName }: TextPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load file');
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [url]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get language for syntax highlighting hint
  const getLanguageLabel = () => {
    const langMap: Record<string, string> = {
      json: 'JSON',
      xml: 'XML',
      md: 'Markdown',
      txt: '纯文本',
      csv: 'CSV',
      html: 'HTML',
      css: 'CSS',
      js: 'JavaScript',
      ts: 'TypeScript',
      py: 'Python',
      yml: 'YAML',
      yaml: 'YAML',
      ini: 'INI',
      log: '日志',
      rtf: 'RTF',
    };
    return langMap[ext] || '文本';
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-eagle-accent/30 border-t-eagle-accent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-white">
        <div className="text-6xl mb-4">📄</div>
        <p className="text-xl mb-2">{fileName}</p>
        <p className="text-red-400 mb-6">{error}</p>
        <a
          href={url}
          download={fileName}
          className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
        >
          <FiDownload size={18} />
          下载文件
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-eagle-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-eagle-sidebar border-b border-eagle-border">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs bg-eagle-accent/20 text-eagle-accent rounded">
            {getLanguageLabel()}
          </span>
          <span className="text-sm text-eagle-textSecondary truncate max-w-[300px]">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-eagle-hover hover:bg-eagle-border text-eagle-text rounded transition-colors"
          >
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
            {copied ? '已复制' : '复制'}
          </button>
          <a
            href={url}
            download={fileName}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-eagle-accent hover:bg-eagle-accentHover text-white rounded transition-colors"
          >
            <FiDownload size={14} />
            下载
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-sm text-eagle-text font-mono whitespace-pre-wrap break-words leading-relaxed">
          {content}
        </pre>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-eagle-sidebar border-t border-eagle-border text-xs text-eagle-textSecondary">
        {content.split('\n').length} 行 · {content.length.toLocaleString()} 字符
      </div>
    </div>
  );
}
