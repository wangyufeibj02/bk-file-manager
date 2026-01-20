import { useState, useRef } from 'react';
import { FiX, FiUser, FiCamera, FiDroplet, FiZap, FiCloud, FiSun, FiMoon, FiGrid, FiCheck } from 'react-icons/fi';
import { BackgroundEffect } from './DynamicBackground';
import { User, UserSettings } from '../types';

interface UserSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  onAvatarChange: (avatarUrl: string) => void;
}

const PRESET_COLORS = [
  { name: '霓虹粉', primary: '#ff00ff', secondary: '#ff0080' },
  { name: '赛博蓝', primary: '#00ffff', secondary: '#0080ff' },
  { name: '电光绿', primary: '#00ff00', secondary: '#00ff80' },
  { name: '等离子紫', primary: '#8000ff', secondary: '#ff00ff' },
  { name: '烈焰橙', primary: '#ff8000', secondary: '#ff0040' },
  { name: '极光青', primary: '#00ffcc', secondary: '#0066ff' },
  { name: '太阳金', primary: '#ffcc00', secondary: '#ff6600' },
  { name: '深空蓝', primary: '#0044ff', secondary: '#00ccff' },
];

const BACKGROUND_EFFECTS: { id: BackgroundEffect; name: string; icon: any }[] = [
  { id: 'particles', name: '粒子网络', icon: FiGrid },
  { id: 'snow', name: '数字飘雪', icon: FiCloud },
  { id: 'rain', name: '霓虹雨滴', icon: FiDroplet },
  { id: 'matrix', name: '矩阵代码', icon: FiZap },
  { id: 'none', name: '无效果', icon: FiMoon },
];

export function UserSettingsPanel({
  isOpen,
  onClose,
  currentUser,
  settings,
  onSettingsChange,
  onAvatarChange,
}: UserSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'account'>('appearance');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleColorChange = (type: 'primary' | 'secondary', color: string) => {
    onSettingsChange({
      ...settings,
      [type === 'primary' ? 'primaryColor' : 'secondaryColor']: color,
    });
  };

  const handleEffectChange = (effect: BackgroundEffect) => {
    onSettingsChange({
      ...settings,
      backgroundEffect: effect,
    });
  };

  const handlePresetSelect = (preset: typeof PRESET_COLORS[0]) => {
    onSettingsChange({
      ...settings,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onAvatarChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="cyber-panel w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-primary to-cyber-secondary flex items-center justify-center">
              <FiUser size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cyber-text glitch-text">用户设置</h2>
              <p className="text-sm text-cyber-muted">USER.SETTINGS.PANEL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cyber-primary/20 rounded-lg transition-colors text-cyber-muted hover:text-cyber-primary"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cyber-border">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-3 text-center font-medium transition-all ${
              activeTab === 'appearance'
                ? 'text-cyber-primary border-b-2 border-cyber-primary bg-cyber-primary/10'
                : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-hover'
            }`}
          >
            外观设置
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-3 text-center font-medium transition-all ${
              activeTab === 'account'
                ? 'text-cyber-primary border-b-2 border-cyber-primary bg-cyber-primary/10'
                : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-hover'
            }`}
          >
            账户信息
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'appearance' ? (
            <>
              {/* Avatar Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text flex items-center gap-2">
                  <FiCamera className="text-cyber-primary" />
                  个人头像
                </h3>
                <div className="flex items-center gap-6">
                  <div
                    onClick={handleAvatarClick}
                    className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group cyber-glow"
                  >
                    {settings.avatarUrl ? (
                      <img
                        src={settings.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-cyber-primary to-cyber-secondary flex items-center justify-center">
                        <FiUser size={40} className="text-black" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <FiCamera size={24} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-cyber-text mb-2">点击更换头像</p>
                    <p className="text-sm text-cyber-muted">支持 JPG、PNG、GIF 格式，最大 2MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Background Effect */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text flex items-center gap-2">
                  <FiZap className="text-cyber-primary" />
                  动态背景效果
                </h3>
                <div className="grid grid-cols-5 gap-3">
                  {BACKGROUND_EFFECTS.map((effect) => {
                    const Icon = effect.icon;
                    const isActive = settings.backgroundEffect === effect.id;
                    return (
                      <button
                        key={effect.id}
                        onClick={() => handleEffectChange(effect.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          isActive
                            ? 'border-cyber-primary bg-cyber-primary/20 text-cyber-primary'
                            : 'border-cyber-border bg-cyber-surface hover:border-cyber-primary/50 text-cyber-muted hover:text-cyber-text'
                        }`}
                      >
                        <Icon size={24} />
                        <span className="text-xs">{effect.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Performance Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text flex items-center gap-2">
                  <FiZap className="text-cyber-primary" />
                  性能设置
                </h3>
                <div className="space-y-3">
                  {/* 减少动画 */}
                  <label className="flex items-center justify-between p-3 rounded-lg border border-cyber-border bg-cyber-surface cursor-pointer hover:border-cyber-primary/50 transition-all">
                    <div>
                      <span className="text-cyber-text">减少动画效果</span>
                      <p className="text-xs text-cyber-muted mt-1">禁用背景动画以提升性能</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.reduceMotion || false}
                      onChange={(e) => onSettingsChange({ 
                        ...settings, 
                        reduceMotion: e.target.checked 
                      })}
                      className="w-5 h-5 rounded border-cyber-border bg-cyber-surface text-cyber-primary focus:ring-cyber-primary"
                    />
                  </label>
                  
                  {/* 粒子数量 */}
                  <div className="p-3 rounded-lg border border-cyber-border bg-cyber-surface">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-cyber-text">粒子数量</span>
                      <span className="text-cyber-primary text-sm">{settings.particleCount || 100}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="10"
                      value={settings.particleCount || 100}
                      onChange={(e) => onSettingsChange({ 
                        ...settings, 
                        particleCount: parseInt(e.target.value) 
                      })}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-cyber-border"
                      style={{
                        background: `linear-gradient(to right, ${settings.primaryColor} ${((settings.particleCount || 100) - 10) / 1.9}%, rgba(255,255,255,0.1) ${((settings.particleCount || 100) - 10) / 1.9}%)`,
                      }}
                      disabled={settings.reduceMotion}
                    />
                    <div className="flex justify-between mt-1 text-xs text-cyber-muted">
                      <span>低</span>
                      <span>高</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Presets */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text flex items-center gap-2">
                  <FiSun className="text-cyber-primary" />
                  预设配色
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_COLORS.map((preset) => {
                    const isActive = settings.primaryColor === preset.primary;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => handlePresetSelect(preset)}
                        className={`relative flex items-center gap-2 p-3 rounded-lg border transition-all ${
                          isActive
                            ? 'border-cyber-primary bg-cyber-primary/10'
                            : 'border-cyber-border bg-cyber-surface hover:border-cyber-primary/50'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{
                            background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                            boxShadow: `0 0 10px ${preset.primary}40`,
                          }}
                        />
                        <span className="text-sm text-cyber-text">{preset.name}</span>
                        {isActive && (
                          <FiCheck size={16} className="absolute right-2 text-cyber-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Colors */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text flex items-center gap-2">
                  <FiDroplet className="text-cyber-primary" />
                  自定义颜色
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-cyber-muted">主色调</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-2 border-cyber-border"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="flex-1 px-3 py-2 bg-cyber-surface border border-cyber-border rounded-lg text-cyber-text font-mono uppercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-cyber-muted">副色调</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-2 border-cyber-border"
                      />
                      <input
                        type="text"
                        value={settings.secondaryColor}
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="flex-1 px-3 py-2 bg-cyber-surface border border-cyber-border rounded-lg text-cyber-text font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text">预览效果</h3>
                <div
                  className="h-32 rounded-lg overflow-hidden relative"
                  style={{
                    background: `linear-gradient(135deg, ${settings.primaryColor}20, ${settings.secondaryColor}20)`,
                    border: `1px solid ${settings.primaryColor}40`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center gap-4">
                    <div
                      className="px-4 py-2 rounded-lg font-medium"
                      style={{
                        background: settings.primaryColor,
                        color: '#000',
                        boxShadow: `0 0 20px ${settings.primaryColor}60`,
                      }}
                    >
                      主要按钮
                    </div>
                    <div
                      className="px-4 py-2 rounded-lg font-medium border"
                      style={{
                        borderColor: settings.primaryColor,
                        color: settings.primaryColor,
                      }}
                    >
                      次要按钮
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Account Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text">账户信息</h3>
                <div className="cyber-panel p-4 space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-cyber-border">
                    <span className="text-cyber-muted">用户名</span>
                    <span className="text-cyber-text font-medium">{currentUser?.username || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-cyber-border">
                    <span className="text-cyber-muted">角色</span>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: currentUser?.role === 'admin' ? `${settings.primaryColor}20` : 'rgba(255,255,255,0.1)',
                        color: currentUser?.role === 'admin' ? settings.primaryColor : '#888',
                        border: `1px solid ${currentUser?.role === 'admin' ? settings.primaryColor : '#333'}`,
                      }}
                    >
                      {currentUser?.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-cyber-muted">用户 ID</span>
                    <span className="text-cyber-text font-mono text-sm">{currentUser?.id?.slice(0, 8) || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyber-text">权限列表</h3>
                <div className="cyber-panel p-4 space-y-3">
                  {currentUser?.role === 'admin' ? (
                    <>
                      <PermissionItem name="用户管理" description="创建、编辑、删除用户" enabled />
                      <PermissionItem name="文件管理" description="上传、编辑、删除所有文件" enabled />
                      <PermissionItem name="文件夹管理" description="创建、重命名、删除文件夹" enabled />
                      <PermissionItem name="标签管理" description="创建、编辑、删除标签" enabled />
                      <PermissionItem name="类型调整" description="修改文件类型分类" enabled />
                      <PermissionItem name="字段命名" description="自定义字段名称" enabled />
                      <PermissionItem name="服务器扫描" description="扫描本地目录" enabled />
                      <PermissionItem name="系统设置" description="修改系统配置" enabled />
                    </>
                  ) : (
                    <>
                      <PermissionItem name="查看文件" description="浏览和预览文件" enabled />
                      <PermissionItem name="上传文件" description="上传新文件" enabled />
                      <PermissionItem name="下载文件" description="下载文件" enabled />
                      <PermissionItem name="用户管理" description="创建、编辑、删除用户" enabled={false} />
                      <PermissionItem name="系统设置" description="修改系统配置" enabled={false} />
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyber-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-cyber-border text-cyber-muted hover:text-cyber-text hover:border-cyber-primary/50 transition-all"
          >
            取消
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-medium transition-all cyber-button"
            style={{
              background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`,
              boxShadow: `0 0 20px ${settings.primaryColor}40`,
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionItem({ name, description, enabled }: { name: string; description: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-cyber-text font-medium">{name}</p>
        <p className="text-xs text-cyber-muted">{description}</p>
      </div>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}
      >
        {enabled ? <FiCheck size={16} /> : <FiX size={16} />}
      </div>
    </div>
  );
}
