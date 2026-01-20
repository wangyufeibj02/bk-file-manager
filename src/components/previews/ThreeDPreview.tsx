import { useEffect, useRef, useState } from 'react';
import { FiRotateCw, FiZoomIn, FiZoomOut, FiMove, FiBox } from 'react-icons/fi';

interface ThreeDPreviewProps {
  url: string;
  fileName: string;
}

export function ThreeDPreview({ url, fileName }: ThreeDPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ vertices: number; faces: number } | null>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let animationId: number;
    let renderer: any;

    async function loadModel() {
      try {
        setLoading(true);
        setError(null);

        // Dynamic import of Three.js
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        
        const container = containerRef.current;
        if (!container || cancelled) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
          75,
          container.clientWidth / container.clientHeight,
          0.1,
          1000
        );
        camera.position.set(0, 1, 3);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Grid helper
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x333333);
        scene.add(gridHelper);

        // Load model based on file extension
        const ext = fileName.split('.').pop()?.toLowerCase();
        let loader: any;
        let geometry: any;

        if (ext === 'obj') {
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          loader = new OBJLoader();
        } else if (ext === 'fbx') {
          const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
          loader = new FBXLoader();
        } else if (ext === 'gltf' || ext === 'glb') {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          loader = new GLTFLoader();
        } else if (ext === 'stl') {
          const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
          loader = new STLLoader();
        } else if (ext === '3ds') {
          const { TDSLoader } = await import('three/examples/jsm/loaders/TDSLoader.js');
          loader = new TDSLoader();
        } else if (ext === 'dae') {
          const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
          loader = new ColladaLoader();
        } else if (ext === 'ply') {
          const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
          loader = new PLYLoader();
        }

        if (!loader) {
          throw new Error(`不支持的3D格式: ${ext}`);
        }

        // Load the model
        const result = await new Promise((resolve, reject) => {
          loader.load(
            url,
            (object: any) => resolve(object),
            undefined,
            (error: any) => reject(error)
          );
        });

        if (cancelled) return;

        // Handle different loader results
        let model: any;
        if (ext === 'stl' || ext === 'ply') {
          // STL/PLY loaders return geometry
          geometry = result;
          const material = new THREE.MeshStandardMaterial({ 
            color: 0x4a9eff,
            metalness: 0.3,
            roughness: 0.7,
          });
          model = new THREE.Mesh(geometry, material);
        } else if (ext === 'gltf' || ext === 'glb') {
          model = (result as any).scene;
        } else if (ext === 'dae') {
          model = (result as any).scene;
        } else {
          model = result;
        }

        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        
        model.position.sub(center);
        model.scale.setScalar(scale);
        scene.add(model);

        // Calculate model info
        let vertices = 0;
        let faces = 0;
        model.traverse((child: any) => {
          if (child.isMesh && child.geometry) {
            const geo = child.geometry;
            vertices += geo.attributes.position?.count || 0;
            faces += geo.index ? geo.index.count / 3 : (geo.attributes.position?.count || 0) / 3;
          }
        });
        setInfo({ vertices, faces: Math.floor(faces) });

        // Animation loop
        function animate() {
          animationId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        // Handle resize
        const handleResize = () => {
          if (!container) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        setLoading(false);

      } catch (err) {
        console.error('3D load error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '无法加载3D模型');
          setLoading(false);
        }
      }
    }

    loadModel();

    return () => {
      cancelled = true;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (renderer) {
        renderer.dispose();
      }
      const container = containerRef.current;
      if (container) {
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    };
  }, [url, fileName]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <FiBox size={40} className="text-cyan-400" />
          </div>
          <p className="text-xl text-white mb-2">{fileName}</p>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-eagle-bg z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">加载 3D 模型中...</p>
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-4 py-2 rounded-lg text-white text-sm flex items-center gap-4">
        <span className="flex items-center gap-1">
          <FiRotateCw size={14} /> 左键旋转
        </span>
        <span className="flex items-center gap-1">
          <FiZoomIn size={14} /> 滚轮缩放
        </span>
        <span className="flex items-center gap-1">
          <FiMove size={14} /> 右键平移
        </span>
      </div>

      {/* Model info */}
      {info && (
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-4 py-2 rounded-lg text-white text-sm">
          <div className="flex items-center gap-2">
            <FiBox size={16} className="text-cyan-400" />
            <span>{info.vertices.toLocaleString()} 顶点</span>
            <span className="text-gray-400">|</span>
            <span>{info.faces.toLocaleString()} 面</span>
          </div>
        </div>
      )}
    </div>
  );
}
