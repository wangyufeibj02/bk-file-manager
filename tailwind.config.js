/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired color palette
        apple: {
          bg: '#000000',
          bgSecondary: '#1d1d1f',
          card: 'rgba(29, 29, 31, 0.72)',
          glass: 'rgba(255, 255, 255, 0.08)',
          glassHover: 'rgba(255, 255, 255, 0.12)',
          glassBorder: 'rgba(255, 255, 255, 0.1)',
          accent: '#0071e3',
          accentHover: '#0077ED',
          accentLight: 'rgba(0, 113, 227, 0.12)',
          text: '#f5f5f7',
          textSecondary: '#86868b',
          textTertiary: '#6e6e73',
          success: '#30d158',
          warning: '#ff9f0a',
          danger: '#ff453a',
          purple: '#bf5af2',
          pink: '#ff375f',
          orange: '#ff9f0a',
          cyan: '#64d2ff',
        },
        // Legacy eagle colors for compatibility
        eagle: {
          bg: '#000000',
          sidebar: '#1d1d1f',
          card: '#2a2a2a',
          hover: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.1)',
          accent: '#0071e3',
          accentHover: '#0077ED',
          text: '#f5f5f7',
          textSecondary: '#86868b',
          success: '#30d158',
          warning: '#ff9f0a',
          danger: '#ff453a',
        },
        // Cyberpunk theme colors
        cyber: {
          primary: 'var(--cyber-primary)',
          secondary: 'var(--cyber-secondary)',
          bg: '#0a0a0f',
          surface: 'rgba(20, 20, 30, 0.8)',
          border: 'rgba(0, 255, 255, 0.2)',
          text: '#e0e0ff',
          muted: '#6a6a8a',
          hover: 'rgba(0, 255, 255, 0.1)',
          neon: '#00ffff',
          magenta: '#ff00ff',
          purple: '#8000ff',
          orange: '#ff8000',
          green: '#00ff00',
        }
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          'SF Pro Text', 
          '-apple-system', 
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif'
        ],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'apple-gradient': 'linear-gradient(180deg, #1d1d1f 0%, #000000 100%)',
      },
      boxShadow: {
        'apple': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'apple-lg': '0 8px 48px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 40px rgba(0, 113, 227, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        'apple': '20px',
      },
    },
  },
  plugins: [],
}
