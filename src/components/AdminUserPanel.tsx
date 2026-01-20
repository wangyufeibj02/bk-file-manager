import { useState, useEffect } from 'react';
import { 
  FiX, FiUsers, FiUserPlus, FiEdit2, FiTrash2, FiShield, FiUser, 
  FiCheck, FiLock, FiUnlock, FiSearch, FiRefreshCw 
} from 'react-icons/fi';
import { User } from '../types';

interface AdminUserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl: string;
}

interface UserListItem {
  id: string;
  username: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
  lastLogin: string | null;
}

const PERMISSIONS = [
  { id: 'file_view', name: '查看文件', description: '浏览和预览所有文件' },
  { id: 'file_upload', name: '上传文件', description: '上传新文件到系统' },
  { id: 'file_edit', name: '编辑文件', description: '修改文件名称和属性' },
  { id: 'file_delete', name: '删除文件', description: '删除系统中的文件' },
  { id: 'folder_manage', name: '文件夹管理', description: '创建、重命名、删除文件夹' },
  { id: 'tag_manage', name: '标签管理', description: '创建、编辑、删除标签' },
  { id: 'type_adjust', name: '类型调整', description: '修改文件类型分类' },
  { id: 'field_naming', name: '字段命名', description: '自定义字段和属性名称' },
  { id: 'scan_local', name: '本地扫描', description: '扫描本地目录' },
  { id: 'user_manage', name: '用户管理', description: '创建、编辑、删除用户' },
  { id: 'system_config', name: '系统设置', description: '修改系统配置' },
];

const DEFAULT_USER_PERMISSIONS = ['file_view', 'file_upload'];
const DEFAULT_ADMIN_PERMISSIONS = PERMISSIONS.map(p => p.id);

export function AdminUserPanel({ isOpen, onClose, apiBaseUrl }: AdminUserPanelProps) {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newPermissions, setNewPermissions] = useState<string[]>(DEFAULT_USER_PERMISSIONS);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/users`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword) {
      setError('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
          permissions: newPermissions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建用户失败');
      }

      await loadUsers();
      setShowCreateModal(false);
      resetCreateForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<UserListItem>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('更新用户失败');
      await loadUsers();
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除此用户吗？此操作不可撤销。')) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('删除用户失败');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除用户失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDisabled = async (user: UserListItem) => {
    await handleUpdateUser(user.id, { isDisabled: !user.isDisabled });
  };

  const resetCreateForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('user');
    setNewPermissions(DEFAULT_USER_PERMISSIONS);
  };

  const togglePermission = (permId: string) => {
    setNewPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const handleRoleChange = (role: 'user' | 'admin') => {
    setNewRole(role);
    setNewPermissions(role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_USER_PERMISSIONS);
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="cyber-panel w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-primary to-cyber-secondary flex items-center justify-center">
              <FiUsers size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-cyber-text glitch-text">用户管理</h2>
              <p className="text-sm text-cyber-muted">ADMIN.USER.MANAGEMENT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cyber-primary/20 rounded-lg transition-colors text-cyber-muted hover:text-cyber-primary"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-4 border-b border-cyber-border">
          <div className="relative flex-1 max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" size={18} />
            <input
              type="text"
              placeholder="搜索用户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-cyber-surface border border-cyber-border rounded-lg text-cyber-text placeholder-cyber-muted focus:outline-none focus:border-cyber-primary"
            />
          </div>
          <button
            onClick={loadUsers}
            className="p-2 border border-cyber-border rounded-lg hover:bg-cyber-hover text-cyber-muted hover:text-cyber-text transition-colors"
            title="刷新"
          >
            <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <FiUserPlus size={18} />
            创建用户
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-cyber-muted">加载中...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-cyber-muted">
              <FiUsers size={32} className="mb-2 opacity-50" />
              <p>{searchQuery ? '未找到匹配的用户' : '暂无用户'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`cyber-panel p-4 flex items-center gap-4 transition-all ${
                    user.isDisabled ? 'opacity-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    user.role === 'admin'
                      ? 'bg-gradient-to-br from-cyber-primary to-cyber-secondary'
                      : 'bg-cyber-surface border border-cyber-border'
                  }`}>
                    {user.role === 'admin' ? (
                      <FiShield size={24} className="text-black" />
                    ) : (
                      <FiUser size={24} className="text-cyber-muted" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-cyber-text font-medium">{user.username}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        user.role === 'admin'
                          ? 'bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/50'
                          : 'bg-cyber-surface text-cyber-muted border border-cyber-border'
                      }`}>
                        {user.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                      {user.isDisabled && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/50">
                          已禁用
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-cyber-muted mt-1">
                      <span>创建: {new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
                      {user.lastLogin && (
                        <span>最后登录: {new Date(user.lastLogin).toLocaleString('zh-CN')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleDisabled(user)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.isDisabled
                          ? 'hover:bg-green-500/20 text-green-400'
                          : 'hover:bg-yellow-500/20 text-yellow-400'
                      }`}
                      title={user.isDisabled ? '启用用户' : '禁用用户'}
                    >
                      {user.isDisabled ? <FiUnlock size={18} /> : <FiLock size={18} />}
                    </button>
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-2 hover:bg-cyber-primary/20 text-cyber-muted hover:text-cyber-primary rounded-lg transition-colors"
                      title="编辑"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 hover:bg-red-500/20 text-cyber-muted hover:text-red-400 rounded-lg transition-colors"
                      title="删除"
                      disabled={user.username === 'admin'}
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyber-border flex justify-between items-center">
          <span className="text-sm text-cyber-muted">
            共 {users.length} 个用户
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-cyber-border text-cyber-muted hover:text-cyber-text hover:border-cyber-primary/50 transition-all"
          >
            关闭
          </button>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110]">
          <div className="cyber-panel w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-cyber-border">
              <h3 className="text-lg font-bold text-cyber-text">创建新用户</h3>
              <p className="text-sm text-cyber-muted">CREATE.NEW.USER</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm text-cyber-muted mb-1">用户名</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-cyber-surface border border-cyber-border rounded-lg text-cyber-text focus:outline-none focus:border-cyber-primary"
                  placeholder="输入用户名"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-cyber-muted mb-1">密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-cyber-surface border border-cyber-border rounded-lg text-cyber-text focus:outline-none focus:border-cyber-primary"
                  placeholder="输入密码"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm text-cyber-muted mb-2">角色</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleRoleChange('user')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      newRole === 'user'
                        ? 'border-cyber-primary bg-cyber-primary/20 text-cyber-primary'
                        : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                    }`}
                  >
                    <FiUser size={20} />
                    <span>普通用户</span>
                    {newRole === 'user' && <FiCheck size={16} className="ml-auto" />}
                  </button>
                  <button
                    onClick={() => handleRoleChange('admin')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      newRole === 'admin'
                        ? 'border-cyber-primary bg-cyber-primary/20 text-cyber-primary'
                        : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                    }`}
                  >
                    <FiShield size={20} />
                    <span>管理员</span>
                    {newRole === 'admin' && <FiCheck size={16} className="ml-auto" />}
                  </button>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm text-cyber-muted mb-2">权限配置</label>
                <div className="space-y-2 max-h-48 overflow-y-auto cyber-panel p-3">
                  {PERMISSIONS.map(perm => (
                    <div
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        newPermissions.includes(perm.id)
                          ? 'bg-cyber-primary/10 border border-cyber-primary/50'
                          : 'hover:bg-cyber-hover border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        newPermissions.includes(perm.id)
                          ? 'bg-cyber-primary text-black'
                          : 'border border-cyber-border'
                      }`}>
                        {newPermissions.includes(perm.id) && <FiCheck size={14} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-cyber-text text-sm">{perm.name}</p>
                        <p className="text-xs text-cyber-muted">{perm.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-cyber-border flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="px-4 py-2 rounded-lg border border-cyber-border text-cyber-muted hover:text-cyber-text transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateUser}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建用户'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(updates) => handleUpdateUser(editingUser.id, updates)}
          loading={loading}
        />
      )}
    </div>
  );
}

interface EditUserModalProps {
  user: UserListItem;
  onClose: () => void;
  onSave: (updates: Partial<UserListItem>) => void;
  loading: boolean;
}

function EditUserModal({ user, onClose, onSave, loading }: EditUserModalProps) {
  const [role, setRole] = useState(user.role);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110]">
      <div className="cyber-panel w-full max-w-md">
        <div className="p-6 border-b border-cyber-border">
          <h3 className="text-lg font-bold text-cyber-text">编辑用户</h3>
          <p className="text-sm text-cyber-muted">EDIT.USER: {user.username}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Role */}
          <div>
            <label className="block text-sm text-cyber-muted mb-2">角色</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole('user')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  role === 'user'
                    ? 'border-cyber-primary bg-cyber-primary/20 text-cyber-primary'
                    : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                }`}
              >
                <FiUser size={20} />
                <span>普通用户</span>
              </button>
              <button
                onClick={() => setRole('admin')}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  role === 'admin'
                    ? 'border-cyber-primary bg-cyber-primary/20 text-cyber-primary'
                    : 'border-cyber-border text-cyber-muted hover:border-cyber-primary/50'
                }`}
              >
                <FiShield size={20} />
                <span>管理员</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-cyber-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-cyber-border text-cyber-muted hover:text-cyber-text transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSave({ role })}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
