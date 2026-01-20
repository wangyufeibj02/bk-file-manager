// 服务器配置 - 生产环境请通过环境变量覆盖这些值
export const config = {
  // 服务器
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'bk-file-manager-jwt-secret-2026-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 默认管理员账户（仅首次运行时创建）
  defaultAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'bkadmin123',
    displayName: process.env.ADMIN_DISPLAY_NAME || '管理员',
  },

  // 文件存储
  storage: {
    uploadsDir: process.env.UPLOADS_DIR || './uploads',
    thumbnailsDir: process.env.THUMBNAILS_DIR || './thumbnails',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
  },

  // bcrypt 加密轮数
  bcryptRounds: 12,
};
