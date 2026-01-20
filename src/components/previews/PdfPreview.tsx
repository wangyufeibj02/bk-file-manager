import { useState, useEffect, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut } from 'react-icons/fi';

interface PdfPreviewProps {
  url: string;
}

export function PdfPreview({ url }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        // Dynamic import of pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        
        await renderPage(pdf, 1, scale);
      } catch (err) {
        console.error('PDF load error:', err);
        if (!cancelled) {
          setError('无法加载 PDF 文件');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (pdfDocRef.current && currentPage > 0) {
      renderPage(pdfDocRef.current, currentPage, scale);
    }
  }, [currentPage, scale]);

  async function renderPage(pdf: any, pageNum: number, pageScale: number) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: pageScale });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Page render error:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-eagle-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">加载 PDF 中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-400">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center h-full">
      {/* PDF Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <canvas ref={canvasRef} className="shadow-2xl" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 p-4 bg-black/50 backdrop-blur rounded-lg">
        {/* Page navigation */}
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="p-2 hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed text-white"
        >
          <FiChevronLeft size={20} />
        </button>
        <span className="text-white text-sm min-w-[80px] text-center">
          {currentPage} / {numPages}
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="p-2 hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed text-white"
        >
          <FiChevronRight size={20} />
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Zoom controls */}
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
          className="p-2 hover:bg-white/10 rounded text-white"
        >
          <FiZoomOut size={18} />
        </button>
        <span className="text-white text-sm min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.25))}
          className="p-2 hover:bg-white/10 rounded text-white"
        >
          <FiZoomIn size={18} />
        </button>
      </div>
    </div>
  );
}
