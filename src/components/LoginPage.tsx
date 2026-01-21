import { useState } from 'react';
import { FiUser, FiLock, FiEye, FiEyeOff, FiServer, FiPlus, FiTrash2, FiZap } from 'react-icons/fi';
import { User, UserSettings } from '../types';

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

interface LoginPageProps {
  onLogin: (user: User, servers: ServerConfig[]) => void;
  settings: UserSettings;
}

export function LoginPage({ onLogin, settings }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [servers, setServers] = useState<ServerConfig[]>([
    { id: '1', name: '本地服务器', url: 'http://localhost:3001', isDefault: true }
  ]);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || '登录失败');
        setIsLoading(false);
        return;
      }
      
      // Store auth info with token
      localStorage.setItem('bkAuth', JSON.stringify({ 
        token: data.token,
        user: {
          id: data.user.id,
          username: data.user.username,
          displayName: data.user.displayName,
          role: data.user.role,
        },
        servers: data.user.servers || servers,
        loginTime: Date.now() 
      }));
      
      // 登录成功后刷新页面，避免 React Hooks 顺序问题
      window.location.reload();
    } catch (err) {
      setError('网络错误，请检查服务器连接');
      setIsLoading(false);
    }
  };

  const addServer = () => {
    if (newServerName && newServerUrl) {
      setServers([...servers, {
        id: Date.now().toString(),
        name: newServerName,
        url: newServerUrl,
        isDefault: false
      }]);
      setNewServerName('');
      setNewServerUrl('');
    }
  };

  const removeServer = (id: string) => {
    setServers(servers.filter(s => s.id !== id));
  };

  const setDefaultServer = (id: string) => {
    setServers(servers.map(s => ({ ...s, isDefault: s.id === id })));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Scanline Effect */}
      <div className="scanlines pointer-events-none fixed inset-0 z-50 opacity-30" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div 
            className="inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-6 cyber-glow neon-border"
            style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}40, ${settings.secondaryColor}40)`,
            }}
          >
            <FiZap size={48} style={{ color: settings.primaryColor }} />
          </div>
          <h1 
            className="text-4xl font-bold tracking-tight mb-2 glitch-text"
            data-text="百科交互"
            style={{ color: settings.primaryColor }}
          >
            百科交互
          </h1>
          <p className="text-cyber-muted text-lg tracking-widest uppercase">
            FILE.MANAGEMENT.SYSTEM
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="cyber-panel p-8 space-y-6">
          {/* Title */}
          <div className="text-center border-b border-cyber-border pb-4 mb-6">
            <span className="text-xs text-cyber-muted tracking-widest">SYSTEM.LOGIN.INTERFACE</span>
          </div>

          {error && (
            <div 
              className="border rounded-lg p-4 text-sm"
              style={{
                background: 'rgba(255, 0, 80, 0.1)',
                borderColor: 'rgba(255, 0, 80, 0.3)',
                color: '#ff0050',
              }}
            >
              <span className="font-mono">[ERROR]</span> {error}
            </div>
          )}

          {/* Username */}
          <div className="space-y-2">
            <label className="text-sm text-cyber-muted font-mono">USER.ID</label>
            <div className="relative">
              <FiUser 
                className="absolute left-4 top-1/2 -translate-y-1/2" 
                size={18}
                style={{ color: settings.primaryColor }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-cyber-surface border border-cyber-border 
                  text-cyber-text placeholder-cyber-muted font-mono
                  focus:outline-none transition-all duration-300"
                style={{
                  boxShadow: username ? `0 0 10px ${settings.primaryColor}40` : 'none',
                  borderColor: username ? settings.primaryColor : undefined,
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm text-cyber-muted font-mono">PASSWORD</label>
            <div className="relative">
              <FiLock 
                className="absolute left-4 top-1/2 -translate-y-1/2" 
                size={18}
                style={{ color: settings.primaryColor }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full pl-12 pr-12 py-3 rounded-lg bg-cyber-surface border border-cyber-border 
                  text-cyber-text placeholder-cyber-muted font-mono
                  focus:outline-none transition-all duration-300"
                style={{
                  boxShadow: password ? `0 0 10px ${settings.primaryColor}40` : 'none',
                  borderColor: password ? settings.primaryColor : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-text transition-colors"
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          {/* Server Config Toggle */}
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="flex items-center gap-2 text-sm text-cyber-muted hover:text-cyber-text transition-colors font-mono"
          >
            <FiServer size={16} style={{ color: settings.secondaryColor }} />
            SERVER.CONFIG ({servers.length})
          </button>

          {/* Server Config Panel */}
          {showServerConfig && (
            <div className="cyber-panel p-4 space-y-4 animate-fade-in">
              {/* Server List */}
              <div className="space-y-2 max-h-40 overflow-y-auto cyber-scrollbar">
                {servers.map(server => (
                  <div 
                    key={server.id}
                    className="flex items-center gap-3 p-3 rounded-lg transition-all"
                    style={{
                      background: server.isDefault ? `${settings.primaryColor}15` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${server.isDefault ? settings.primaryColor : 'transparent'}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setDefaultServer(server.id)}
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all"
                      style={{
                        background: server.isDefault ? settings.primaryColor : 'transparent',
                        borderColor: server.isDefault ? settings.primaryColor : '#6a6a8a',
                        boxShadow: server.isDefault ? `0 0 8px ${settings.primaryColor}` : 'none',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-cyber-text truncate font-mono">{server.name}</div>
                      <div className="text-xs text-cyber-muted truncate font-mono">{server.url}</div>
                    </div>
                    {servers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeServer(server.id)}
                        className="p-1 hover:bg-red-500/20 rounded text-cyber-muted hover:text-red-400 transition-colors"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Server */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="服务器名称"
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-cyber-surface border border-cyber-border 
                    text-cyber-text placeholder-cyber-muted font-mono
                    focus:outline-none focus:border-cyber-primary"
                />
                <input
                  type="text"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="http://..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-cyber-surface border border-cyber-border 
                    text-cyber-text placeholder-cyber-muted font-mono
                    focus:outline-none focus:border-cyber-primary"
                />
                <button
                  type="button"
                  onClick={addServer}
                  className="p-2 rounded-lg text-black font-medium transition-all cyber-button"
                  style={{
                    background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`,
                  }}
                >
                  <FiPlus size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 rounded-lg text-black font-bold text-lg tracking-wider
              transition-all duration-300 cyber-button disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`,
              boxShadow: `0 0 30px ${settings.primaryColor}60`,
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span 
                  className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" 
                />
                AUTHENTICATING...
              </span>
            ) : (
              'ACCESS.SYSTEM'
            )}
          </button>

          {/* Decorative Lines */}
          <div className="flex items-center gap-2 pt-4">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${settings.primaryColor}40, transparent)` }} />
            <span className="text-xs text-cyber-muted font-mono">v2.0.26</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${settings.secondaryColor}40, transparent)` }} />
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-cyber-muted text-sm mt-8 font-mono tracking-wider">
          <span style={{ color: settings.primaryColor }}>百科交互</span> FILE.MANAGEMENT © 2026
        </p>
      </div>

      {/* Corner Decorations */}
      <div 
        className="fixed top-0 left-0 w-32 h-32 pointer-events-none"
        style={{
          borderLeft: `2px solid ${settings.primaryColor}40`,
          borderTop: `2px solid ${settings.primaryColor}40`,
        }}
      />
      <div 
        className="fixed top-0 right-0 w-32 h-32 pointer-events-none"
        style={{
          borderRight: `2px solid ${settings.secondaryColor}40`,
          borderTop: `2px solid ${settings.secondaryColor}40`,
        }}
      />
      <div 
        className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none"
        style={{
          borderLeft: `2px solid ${settings.secondaryColor}40`,
          borderBottom: `2px solid ${settings.secondaryColor}40`,
        }}
      />
      <div 
        className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none"
        style={{
          borderRight: `2px solid ${settings.primaryColor}40`,
          borderBottom: `2px solid ${settings.primaryColor}40`,
        }}
      />
    </div>
  );
}
