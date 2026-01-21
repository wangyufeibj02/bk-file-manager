import { useState, useRef, useEffect } from 'react';
import { FiPlay, FiVolume2, FiVolumeX } from 'react-icons/fi';
import { getFileUrl } from '../utils/filePath';

interface VideoThumbnailProps {
  videoPath: string;
  thumbnailPath: string | null;
  className?: string;
}

export function VideoThumbnail({ videoPath, thumbnailPath, className = '' }: VideoThumbnailProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const videoUrl = getFileUrl(videoPath);
  const thumbUrl = thumbnailPath ? getFileUrl(thumbnailPath) : null;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
    // 延迟 500ms 后才开始加载视频，避免快速滑过时的无效加载
    timeoutRef.current = setTimeout(() => {
      setShouldLoadVideo(true);
      // 再等视频加载后播放
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }, 500);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 静态缩略图 - 始终显示直到视频加载完成 */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${
        isHovering && isLoaded ? 'opacity-0' : 'opacity-100'
      }`}>
        {thumbUrl ? (
          <>
            {/* 占位背景 */}
            {!thumbLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse" />
            )}
            <img
              src={thumbUrl}
              alt=""
              loading="lazy"
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                thumbLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setThumbLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <FiPlay className="text-white ml-1" size={24} />
            </div>
          </div>
        )}
      </div>

      {/* 视频元素 - 只在悬停时才加载，不预加载 */}
      {shouldLoadVideo && (
        <video
          ref={videoRef}
          src={videoUrl}
          muted={isMuted}
          loop
          playsInline
          preload="none"
          onLoadedData={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isHovering && isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 播放图标 (不悬停时显示) */}
      {!isHovering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
            <FiPlay className="text-white ml-1" size={24} />
          </div>
        </div>
      )}

      {/* 静音按钮 (悬停时显示) */}
      {isHovering && isLoaded && (
        <button
          onClick={toggleMute}
          className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors z-10"
        >
          {isMuted ? (
            <FiVolumeX size={14} className="text-white" />
          ) : (
            <FiVolume2 size={14} className="text-white" />
          )}
        </button>
      )}

      {/* 加载指示器 */}
      {isHovering && shouldLoadVideo && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 视频标识 */}
      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs flex items-center gap-1">
        <FiPlay size={10} />
        <span>视频</span>
      </div>
    </div>
  );
}
