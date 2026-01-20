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
    // Delay video play to avoid loading on quick mouse moves
    timeoutRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }, 300);
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
      {/* Static thumbnail or gradient background */}
      {!isHovering && (
        <div className="absolute inset-0">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                <FiPlay className="text-white ml-1" size={24} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video element (preloaded but hidden until hover) */}
      <video
        ref={videoRef}
        src={videoUrl}
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        onLoadedData={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isHovering && isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Play icon overlay (when not hovering) */}
      {!isHovering && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
            <FiPlay className="text-white ml-1" size={24} />
          </div>
        </div>
      )}

      {/* Mute button (when hovering) */}
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

      {/* Loading indicator */}
      {isHovering && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Video indicator */}
      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs flex items-center gap-1">
        <FiPlay size={10} />
        <span>视频</span>
      </div>
    </div>
  );
}
