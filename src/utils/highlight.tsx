import React from 'react';

/**
 * 高亮文本中的匹配部分
 * @param text 原始文本
 * @param query 搜索关键词
 * @param highlightClass 高亮样式类名
 */
export function highlightText(
  text: string, 
  query: string,
  highlightClass = 'text-cyber-primary bg-cyber-primary/20 px-0.5 rounded'
): React.ReactNode {
  if (!query || !text) return text;

  // 转义正则特殊字符
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // 创建不区分大小写的正则
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  // 分割文本
  const parts = text.split(regex);
  
  if (parts.length === 1) return text;
  
  return (
    <>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <span key={index} className={highlightClass}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * 高亮文件名中的匹配部分（带扩展名保护）
 * @param filename 文件名
 * @param query 搜索关键词
 */
export function highlightFilename(
  filename: string, 
  query: string
): React.ReactNode {
  if (!query || !filename) return filename;
  
  // 分离文件名和扩展名
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const ext = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
  
  const highlightedName = highlightText(name, query);
  
  return (
    <>
      {highlightedName}
      <span className="text-gray-500">{ext}</span>
    </>
  );
}
