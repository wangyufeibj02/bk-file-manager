import { useState, useRef, useEffect } from 'react';
import { FiFilm, FiPlay } from 'react-icons/fi';
import { SequenceGroup, formatSequenceRange } from '../utils/sequenceDetector';
import { getFileUrl } from '../utils/filePath';

interface SequenceCardProps {
  sequence: SequenceGroup;
  onClick: () => void;
}

export function SequenceCard({ sequence, onClick }: SequenceCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout>();
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

  // Animate through frames on hover
  useEffect(() => {
    if (isHovering && sequence.files.length > 1) {
      const frameDelay = Math.max(50, 1000 / 24); // ~24fps preview
      intervalRef.current = setInterval(() => {
        setPreviewFrame(prev => (prev + 1) % Math.min(sequence.files.length, 30)); // Limit preview to 30 frames
      }, frameDelay);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setPreviewFrame(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isHovering, sequence.files.length]);

  const displayFile = sequence.files[previewFrame] || sequence.thumbnailFile;
  const thumbnailUrl = getFileUrl(displayFile.thumbnailPath || displayFile.path);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer card-apple"
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-apple-bgSecondary relative">
        {!thumbnailLoaded && (
          <div className="absolute inset-0 skeleton" />
        )}
        <img
          src={thumbnailUrl}
          alt={formatSequenceRange(sequence)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            thumbnailLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setThumbnailLoaded(true)}
        />

        {/* Sequence Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm">
          <FiFilm size={14} className="text-apple-accent" />
          <span className="text-xs text-white font-medium">{sequence.frameCount} 帧</span>
        </div>

        {/* Play Overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
          isHovering ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transform transition-transform group-hover:scale-110">
            <FiPlay size={28} className="text-white ml-1" />
          </div>
        </div>

        {/* Frame Counter (during hover) */}
        {isHovering && (
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
            <span className="text-xs text-white font-mono">
              {(previewFrame + 1).toString().padStart(sequence.padding, '0')} / {sequence.frameCount}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 bg-apple-bgSecondary/50">
        <div className="text-sm text-apple-text font-medium truncate">
          {formatSequenceRange(sequence)}
        </div>
        <div className="text-xs text-apple-textTertiary mt-1">
          {sequence.startFrame} → {sequence.endFrame}
        </div>
      </div>
    </div>
  );
}
