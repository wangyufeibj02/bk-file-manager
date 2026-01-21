import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiRepeat, FiX } from 'react-icons/fi';
import { SequenceGroup, formatSequenceRange } from '../utils/sequenceDetector';
import { getFileUrl } from '../utils/filePath';

interface SequencePlayerProps {
  sequence: SequenceGroup;
  onClose: () => void;
}

export function SequencePlayer({ sequence, onClose }: SequencePlayerProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(25); // 默认25帧/秒
  const [loop, setLoop] = useState(true);
  const [preloadedImages, setPreloadedImages] = useState<HTMLImageElement[]>([]);
  const [loadProgress, setLoadProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Preload all images - 使用缩略图以加快加载速度
  useEffect(() => {
    const images: HTMLImageElement[] = [];
    let loadedCount = 0;
    const totalFiles = sequence.files.length;

    // 并行加载，但限制并发数避免阻塞
    const loadBatch = (startIndex: number, batchSize: number) => {
      const endIndex = Math.min(startIndex + batchSize, totalFiles);
      for (let i = startIndex; i < endIndex; i++) {
        const file = sequence.files[i];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          loadedCount++;
          setLoadProgress(Math.round((loadedCount / totalFiles) * 100));
          // 加载下一批
          if (loadedCount === endIndex && endIndex < totalFiles) {
            loadBatch(endIndex, batchSize);
          }
        };
        img.onerror = () => {
          loadedCount++;
          setLoadProgress(Math.round((loadedCount / totalFiles) * 100));
          if (loadedCount === endIndex && endIndex < totalFiles) {
            loadBatch(endIndex, batchSize);
          }
        };
        // 优先使用缩略图，加载更快
        img.src = getFileUrl(file.thumbnailPath || file.path);
        images[i] = img;
      }
    };

    // 初始化图片数组
    for (let i = 0; i < totalFiles; i++) {
      images[i] = new Image();
    }
    setPreloadedImages(images);

    // 开始批量加载，每批 10 张
    loadBatch(0, 10);

    return () => {
      images.forEach(img => {
        img.src = '';
      });
    };
  }, [sequence]);

  // Draw current frame to canvas
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const img = preloadedImages[frameIndex];
    
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }, [preloadedImages]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || preloadedImages.length === 0) return;

    const frameDuration = 1000 / fps;

    const animate = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= frameDuration) {
        setCurrentFrame(prev => {
          const next = prev + 1;
          if (next >= sequence.frameCount) {
            if (loop) {
              return 0;
            } else {
              setIsPlaying(false);
              return prev;
            }
          }
          return next;
        });
        lastTimeRef.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, fps, loop, sequence.frameCount, preloadedImages.length]);

  // Draw frame when currentFrame changes
  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const goToStart = () => {
    setCurrentFrame(0);
    if (!isPlaying) drawFrame(0);
  };
  
  const goToEnd = () => {
    const lastFrame = sequence.frameCount - 1;
    setCurrentFrame(lastFrame);
    if (!isPlaying) drawFrame(lastFrame);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    setCurrentFrame(frame);
    if (!isPlaying) drawFrame(frame);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === 'ArrowLeft') {
      setCurrentFrame(prev => Math.max(0, prev - 1));
    }
    if (e.key === 'ArrowRight') {
      setCurrentFrame(prev => Math.min(sequence.frameCount - 1, prev + 1));
    }
  }, [onClose, sequence.frameCount]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const currentFile = sequence.files[currentFrame];
  const isLoading = loadProgress < 100;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="glass border-b border-apple-glassBorder px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-apple-text">
            {formatSequenceRange(sequence)}
          </h2>
          <p className="text-sm text-apple-textSecondary">
            {sequence.frameCount} 帧 · {fps} FPS
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-apple-glass hover:bg-apple-glassHover text-apple-text transition-colors"
        >
          <FiX size={24} />
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-apple-accent/30 border-t-apple-accent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-apple-text">加载帧 {loadProgress}%</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Controls */}
      <div className="glass border-t border-apple-glassBorder p-4 space-y-4">
        {/* Timeline */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-apple-textSecondary min-w-[60px]">
            {(currentFrame + 1).toString().padStart(sequence.padding, '0')}
          </span>
          <input
            type="range"
            min={0}
            max={sequence.frameCount - 1}
            value={currentFrame}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-apple-glass rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none 
              [&::-webkit-slider-thumb]:w-4 
              [&::-webkit-slider-thumb]:h-4 
              [&::-webkit-slider-thumb]:bg-apple-accent 
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:shadow-lg"
          />
          <span className="text-sm text-apple-textSecondary min-w-[60px] text-right">
            {sequence.frameCount.toString().padStart(sequence.padding, '0')}
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Go to start */}
          <button
            onClick={goToStart}
            className="p-3 rounded-xl bg-apple-glass hover:bg-apple-glassHover text-apple-text transition-colors"
          >
            <FiSkipBack size={20} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-4 rounded-2xl bg-apple-accent hover:bg-apple-accentHover text-white transition-colors"
          >
            {isPlaying ? <FiPause size={28} /> : <FiPlay size={28} className="ml-1" />}
          </button>

          {/* Go to end */}
          <button
            onClick={goToEnd}
            className="p-3 rounded-xl bg-apple-glass hover:bg-apple-glassHover text-apple-text transition-colors"
          >
            <FiSkipForward size={20} />
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-apple-glassBorder mx-4" />

          {/* Loop toggle */}
          <button
            onClick={() => setLoop(!loop)}
            className={`p-3 rounded-xl transition-colors ${
              loop 
                ? 'bg-apple-accent/20 text-apple-accent' 
                : 'bg-apple-glass text-apple-textSecondary hover:bg-apple-glassHover'
            }`}
          >
            <FiRepeat size={20} />
          </button>

          {/* FPS slider with editable input */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-apple-textSecondary">FPS:</span>
            <input
              type="range"
              min={1}
              max={120}
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value, 10))}
              className="w-24 h-2 bg-apple-glass rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none 
                [&::-webkit-slider-thumb]:w-4 
                [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:bg-apple-accent 
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:shadow-lg"
            />
            <input
              type="number"
              min={1}
              max={120}
              value={fps}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 120) {
                  setFps(val);
                }
              }}
              className="w-14 text-sm font-mono text-center px-2 py-1 rounded bg-apple-glass border border-apple-glassBorder focus:outline-none focus:ring-2 focus:ring-apple-accent/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ color: '#00ffff' }}
            />
          </div>
        </div>

        {/* Current frame info */}
        <div className="text-center text-sm text-apple-textSecondary">
          {currentFile?.originalName}
        </div>
      </div>
    </div>
  );
}
