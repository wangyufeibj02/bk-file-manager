import { useState, useEffect, useRef } from 'react';
import { FiLayers, FiEye, FiEyeOff } from 'react-icons/fi';

interface PsdPreviewProps {
  url: string;
  fileName: string;
}

interface PsdLayer {
  name: string;
  visible: boolean;
  opacity: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function PsdPreview({ url, fileName }: PsdPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<PsdLayer[]>([]);
  const [showLayers, setShowLayers] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPsd() {
      try {
        setLoading(true);
        setError(null);

        // Fetch the PSD file
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        // Dynamic import of ag-psd
        const { readPsd } = await import('ag-psd');

        const psd = readPsd(arrayBuffer);

        if (cancelled) return;

        setDimensions({ width: psd.width, height: psd.height });

        // Extract layer info
        if (psd.children) {
          const layerInfo: PsdLayer[] = psd.children.map((layer: any) => ({
            name: layer.name || 'Unnamed Layer',
            visible: !layer.hidden,
            opacity: (layer.opacity ?? 255) / 255,
            left: layer.left || 0,
            top: layer.top || 0,
            width: (layer.right || 0) - (layer.left || 0),
            height: (layer.bottom || 0) - (layer.top || 0),
          }));
          setLayers(layerInfo);
        }

        // Render to canvas
        const canvas = canvasRef.current;
        if (canvas && psd.canvas) {
          canvas.width = psd.width;
          canvas.height = psd.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(psd.canvas, 0, 0);
          }
        }
      } catch (err) {
        console.error('PSD load error:', err);
        if (!cancelled) {
          setError('无法加载 PSD 文件');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPsd();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">解析 PSD 文件中...</p>
          <p className="text-gray-400 text-sm mt-2">这可能需要一些时间</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
            <span className="text-3xl">🎨</span>
          </div>
          <p className="text-xl text-white mb-2">{fileName}</p>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full shadow-2xl"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Layers Panel */}
      {showLayers && layers.length > 0 && (
        <div className="w-64 bg-eagle-sidebar border-l border-eagle-border overflow-y-auto">
          <div className="p-3 border-b border-eagle-border">
            <h3 className="text-sm font-medium text-eagle-text flex items-center gap-2">
              <FiLayers size={16} />
              图层 ({layers.length})
            </h3>
          </div>
          <div className="p-2">
            {layers.map((layer, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-eagle-hover rounded text-sm"
              >
                {layer.visible ? (
                  <FiEye size={14} className="text-eagle-textSecondary" />
                ) : (
                  <FiEyeOff size={14} className="text-eagle-textSecondary opacity-50" />
                )}
                <span
                  className={`flex-1 truncate ${layer.visible ? 'text-eagle-text' : 'text-eagle-textSecondary'}`}
                  style={{ opacity: layer.opacity }}
                >
                  {layer.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Layers Button */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className={`absolute bottom-4 right-4 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
          showLayers ? 'bg-purple-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        <FiLayers size={16} />
        图层 ({layers.length})
      </button>

      {/* Info */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-3 py-2 rounded-lg text-white text-sm">
        {dimensions.width} × {dimensions.height} px
      </div>
    </div>
  );
}
