# 百科交互文件管理系统

一个现代化文件管理系统，专为内部服务器的文件归类和筛查设计。

## ✨ 功能特点

- 📁 **文件夹管理** - 支持多层级文件夹结构
- 🏷️ **标签系统** - 灵活的多标签管理
- 🎨 **颜色筛选** - 根据图片主色调筛选文件
- ⭐ **评分系统** - 5星评分快速标记重要文件
- 🔍 **智能搜索** - 按文件名、类型、标签等多维度搜索
- 📤 **拖拽上传** - 支持批量拖拽上传
- 🖼️ **多种视图** - 网格、瀑布流、列表三种布局
- 🔎 **文件预览** - 图片、视频、音频在线预览
- 📱 **响应式设计** - 适配各种屏幕尺寸

## 🛠️ 技术栈

- **前端**: React + TypeScript + Tailwind CSS + Vite
- **后端**: Express + TypeScript
- **数据库**: SQLite + Prisma
- **图片处理**: Sharp

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

### 3. 启动开发服务器

```bash
npm run dev
```

前端访问: http://localhost:3000
后端 API: http://localhost:3001

## 📖 API 接口

### 文件夹 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/folders | 获取所有文件夹 |
| GET | /api/folders/tree | 获取文件夹树结构 |
| GET | /api/folders/:id | 获取单个文件夹 |
| POST | /api/folders | 创建文件夹 |
| PATCH | /api/folders/:id | 更新文件夹 |
| DELETE | /api/folders/:id | 删除文件夹 |

### 文件 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/files | 获取文件列表（支持筛选） |
| GET | /api/files/:id | 获取文件详情 |
| POST | /api/files/upload | 上传文件 |
| PATCH | /api/files/:id | 更新文件信息 |
| DELETE | /api/files/:id | 删除文件 |
| POST | /api/files/bulk/move | 批量移动文件 |
| POST | /api/files/bulk/delete | 批量删除文件 |
| POST | /api/files/bulk/tag | 批量添加标签 |

### 标签 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tags | 获取所有标签 |
| GET | /api/tags/tree | 获取标签树结构 |
| POST | /api/tags | 创建标签 |
| PATCH | /api/tags/:id | 更新标签 |
| DELETE | /api/tags/:id | 删除标签 |

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl/Cmd + 点击 | 多选文件 |
| ← / → | 预览时切换文件 |
| Esc | 关闭预览 |
| + / - | 缩放预览图片 |
| 0 | 重置缩放 |

## 📁 项目结构

```
├── prisma/
│   └── schema.prisma    # 数据库模型
├── server/
│   ├── index.ts         # 服务器入口
│   ├── lib/             # 工具函数
│   └── routes/          # API 路由
├── src/
│   ├── components/      # React 组件
│   ├── hooks/           # 自定义 Hooks
│   ├── types/           # TypeScript 类型
│   ├── App.tsx          # 主应用
│   └── main.tsx         # 入口文件
├── uploads/             # 上传文件目录
└── thumbnails/          # 缩略图目录
```

## 📄 License

MIT
