import { useState, useRef, useEffect } from 'react';
import { 
  FiPlay, 
  FiPause, 
  FiVolume2, 
  FiVolumeX,
  FiMaximize,
  FiSkipBack,
  FiSkipForward,
  FiDownload,
  FiExternalLink,
  FiAlertCircle
} from 'react-icons/fi';

interface VideoPreviewProps {
  url: string;
  mimeType: string;
  fileName?: string;
  thumbnailUrl?: string;
  // 视频元数据
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  fps?: number | null;
  fileSize?: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化比特率
function formatBitrate(bps: number): string {
  if (bps >= 1000000) {
    return (bps / 1000000).toFixed(1) + ' Mbps';
  }
  return (bps / 1000).toFixed(0) + ' Kbps';
}

export function VideoPreview({ 
  url, 
  mimeType, 
  fileName, 
  thumbnailUrl,
  width: metaWidth,
  height: metaHeight,
  duration: metaDuration,
  codec,
  bitrate,
  fps,
  fileSize,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codecError, setCodecError] = useState(false);
  
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const isProResLikely = ext === 'mov' || mimeType === 'video/quicktime';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      // Check if it's a codec issue (common with ProRes/Animation)
      if (isProResLikely) {
        setCodecError(true);
        setError('此视频使用 ProRes/Animation 编码，浏览器无法直接播放');
      } else {
        setError('无法播放此视频');
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [isProResLikely]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          {/* Show thumbnail if available */}
          {thumbnailUrl && (
            <div className="relative mb-6">
              <img 
                src={thumbnailUrl} 
                alt="Video thumbnail"
                className="max-w-full max-h-64 mx-auto rounded-lg shadow-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <FiAlertCircle size={32} className="text-white" />
                </div>
              </div>
            </div>
          )}
          
          {!thumbnailUrl && (
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FiPlay size={48} className="text-blue-400 ml-1" />
            </div>
          )}
          
          {fileName && (
            <p className="text-xl text-white mb-2">{fileName}</p>
          )}
          
          {codecError ? (
            <>
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-yellow-400 text-sm">
                  此视频使用 ProRes/Animation 编码格式，浏览器无法直接解码播放。
                  请下载后使用专业视频播放器（如 VLC、QuickTime）打开。
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <a
                  href={url}
                  download={fileName}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-eagle-accent hover:bg-eagle-accentHover text-white rounded-lg transition-colors"
                >
                  <FiDownload size={18} />
                  下载视频
                </a>
                <button
                  onClick={() => {
                    // Try to open with system player via API
                    fetch('/api/files/open', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ filePath: decodeURIComponent(url.replace('/local-file?path=', '')) })
                    });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  <FiExternalLink size={18} />
                  用本地播放器打开
                </button>
              </div>
            </>
          ) : (
            <p className="text-red-400">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative flex items-center justify-center w-full h-full bg-black"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Video element - 限制最大尺寸避免竖屏视频过大 */}
      <video
        ref={videoRef}
        className="max-w-full max-h-full object-contain"
        style={{ maxHeight: 'calc(100vh - 200px)', maxWidth: 'calc(100vw - 400px)' }}
        onClick={togglePlay}
        autoPlay
        playsInline
        controls={false}
      >
        <source src={url} type="video/mp4" />
        <source src={url} type="video/quicktime" />
        <source src={url} type="video/webm" />
        <source src={url} type={mimeType} />
        您的浏览器不支持视频播放
      </video>

      {/* Video info overlay - 左上角显示视频信息 */}
      <div 
        className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-wrap gap-3 text-xs text-white/80">
          {/* 分辨率 */}
          {(metaWidth && metaHeight) && (
            <span className="px-2 py-1 bg-white/10 rounded">
              {metaWidth} × {metaHeight}
            </span>
          )}
          {/* 帧率 */}
          {fps && (
            <span className="px-2 py-1 bg-white/10 rounded">
              {fps} fps
            </span>
          )}
          {/* 编码 */}
          {codec && (
            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded uppercase">
              {codec}
            </span>
          )}
          {/* 比特率 */}
          {bitrate && (
            <span className="px-2 py-1 bg-white/10 rounded">
              {formatBitrate(bitrate)}
            </span>
          )}
          {/* 时长 */}
          {metaDuration && (
            <span className="px-2 py-1 bg-white/10 rounded">
              {formatTime(metaDuration)}
            </span>
          )}
          {/* 文件大小 */}
          {fileSize && (
            <span className="px-2 py-1 bg-white/10 rounded">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
      </div>

      {/* Play button overlay - 大按钮居中 */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
        >
          <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 hover:scale-110 transition-all shadow-2xl">
            <FiPlay size={48} className="text-white ml-2" />
          </div>
        </button>
      )}

      {/* Controls - 底部控制条 */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-6 pt-16 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress bar - 更粗更明显 */}
        <div className="mb-4 group">
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer">
            {/* 已播放进度 */}
            <div 
              className="absolute left-0 top-0 h-full bg-cyan-400 rounded-full transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
            {/* 拖动滑块 */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {/* 悬浮指示器 */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-cyan-400 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 8px)` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause - 更大的按钮 */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); togglePlay(); }}
              className="w-12 h-12 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white cursor-pointer select-none"
            >
              {isPlaying ? <FiPause size={28} /> : <FiPlay size={28} className="ml-1" />}
            </button>

            {/* Skip buttons - 使用 onMouseDown 确保立即响应 */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); skip(-10); }}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white cursor-pointer select-none"
              title="后退10秒"
            >
              <FiSkipBack size={22} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); skip(10); }}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white cursor-pointer select-none"
              title="前进10秒"
            >
              <FiSkipForward size={22} />
            </button>

            {/* Time - 更大的字体 */}
            <span className="text-white text-base font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Volume - 更大的控件 */}
            <div className="flex items-center gap-3 group/volume">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); toggleMute(); }}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white cursor-pointer select-none"
              >
                {isMuted || volume === 0 ? <FiVolumeX size={22} /> : <FiVolume2 size={22} />}
              </button>
              <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-2 bg-white/30 rounded-full appearance-none cursor-pointer 
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-4 
                    [&::-webkit-slider-thumb]:h-4 
                    [&::-webkit-slider-thumb]:bg-white 
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
            </div>

            {/* Fullscreen - 更大的按钮 */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); toggleFullscreen(); }}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/20 active:bg-white/30 rounded-full transition-colors text-white cursor-pointer select-none"
              title="全屏"
            >
              <FiMaximize size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
