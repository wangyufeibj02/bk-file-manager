import { useEffect, useRef, useState, useMemo } from 'react';

export type BackgroundEffect = 'particles' | 'snow' | 'rain' | 'matrix' | 'none';

// 性能等级
export type PerformanceLevel = 'high' | 'medium' | 'low' | 'auto';

interface DynamicBackgroundProps {
  effect: BackgroundEffect;
  primaryColor: string;
  secondaryColor: string;
  performanceLevel?: PerformanceLevel; // 性能等级
  reducedMotion?: boolean; // 减少动画（无障碍）
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export function DynamicBackground({ 
  effect, 
  primaryColor, 
  secondaryColor,
  performanceLevel = 'auto',
  reducedMotion = false,
}: DynamicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  // 自动检测性能等级
  const actualPerformanceLevel = useMemo(() => {
    if (performanceLevel !== 'auto') return performanceLevel;
    
    // 检测设备性能
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as any).deviceMemory || 4;
    
    if (isMobile || cores <= 2 || memory <= 2) return 'low';
    if (cores <= 4 || memory <= 4) return 'medium';
    return 'high';
  }, [performanceLevel]);

  // 根据性能等级调整粒子数量
  const particleMultiplier = useMemo(() => {
    switch (actualPerformanceLevel) {
      case 'low': return 0.3;
      case 'medium': return 0.6;
      case 'high': return 1;
      default: return 1;
    }
  }, [actualPerformanceLevel]);

  // 检测用户是否偏好减少动画
  const prefersReducedMotion = useMemo(() => {
    if (reducedMotion) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, [reducedMotion]);

  useEffect(() => {
    // 如果用户偏好减少动画，不渲染
    if (prefersReducedMotion || effect === 'none') {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles based on effect and performance level
    const initParticles = () => {
      const particles: Particle[] = [];
      const baseCount = effect === 'matrix' ? 100 : effect === 'rain' ? 200 : effect === 'snow' ? 150 : 80;
      const count = Math.round(baseCount * particleMultiplier);

      for (let i = 0; i < count; i++) {
        particles.push(createParticle(canvas.width, canvas.height, effect, primaryColor, secondaryColor, true));
      }
      particlesRef.current = particles;
    };

    initParticles();

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((p, i) => {
        updateParticle(p, canvas.width, canvas.height, effect);
        drawParticle(ctx, p, effect, primaryColor);

        // Reset particle if out of bounds
        if (p.y > canvas.height + 50 || p.x < -50 || p.x > canvas.width + 50) {
          particlesRef.current[i] = createParticle(canvas.width, canvas.height, effect, primaryColor, secondaryColor, false);
        }
      });

      // Draw connections for particles effect
      if (effect === 'particles') {
        drawConnections(ctx, particlesRef.current, primaryColor);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    if (effect !== 'none') {
      // Clear canvas first
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      animate();
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [effect, primaryColor, secondaryColor, particleMultiplier, prefersReducedMotion]);

  if (effect === 'none' || prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  );
}

function createParticle(
  width: number, 
  height: number, 
  effect: BackgroundEffect,
  primaryColor: string,
  secondaryColor: string,
  initial: boolean
): Particle {
  const colors = [primaryColor, secondaryColor, '#ff00ff', '#00ffff', '#ff0080'];
  
  switch (effect) {
    case 'snow':
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : -10,
        vx: Math.random() * 0.5 - 0.25,
        vy: Math.random() * 1 + 0.5,
        size: Math.random() * 4 + 1,
        alpha: Math.random() * 0.6 + 0.4,
        color: '#ffffff',
      };
    
    case 'rain':
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : -20,
        vx: Math.random() * 0.5 - 0.25,
        vy: Math.random() * 15 + 10,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.3,
        color: primaryColor,
      };
    
    case 'matrix':
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : -20,
        vx: 0,
        vy: Math.random() * 5 + 2,
        size: Math.random() * 14 + 10,
        alpha: Math.random() * 0.8 + 0.2,
        color: primaryColor,
      };
    
    case 'particles':
    default:
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.random() * 1 - 0.5,
        vy: Math.random() * 1 - 0.5,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
  }
}

function updateParticle(p: Particle, width: number, height: number, effect: BackgroundEffect) {
  p.x += p.vx;
  p.y += p.vy;

  if (effect === 'particles') {
    // Bounce off edges
    if (p.x < 0 || p.x > width) p.vx *= -1;
    if (p.y < 0 || p.y > height) p.vy *= -1;
  }

  if (effect === 'snow') {
    p.vx += Math.random() * 0.02 - 0.01; // Wind effect
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, effect: BackgroundEffect, primaryColor: string) {
  ctx.save();
  
  switch (effect) {
    case 'snow':
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.fill();
      break;
    
    case 'rain':
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 0.5);
      ctx.strokeStyle = `${primaryColor}${Math.floor(p.alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = p.size;
      ctx.stroke();
      break;
    
    case 'matrix':
      const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.font = `${p.size}px monospace`;
      ctx.fillStyle = `${primaryColor}${Math.floor(p.alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fillText(char, p.x, p.y);
      break;
    
    case 'particles':
    default:
      // Glow effect
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      gradient.addColorStop(0, `${p.color}${Math.floor(p.alpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      break;
  }
  
  ctx.restore();
}

function drawConnections(ctx: CanvasRenderingContext2D, particles: Particle[], color: string) {
  const maxDist = 120;
  
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.3;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}
