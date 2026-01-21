export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isSmartFolder: boolean;
  smartRules: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
  files?: FileItem[];
  _count?: {
    files: number;
  };
}

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  path: string;
  thumbnailPath: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  dominantColor: string | null;
  palette: string | null;
  rating: number;
  annotation: string | null;
  folderId: string | null;
  folder?: Folder;
  tags: FileTag[];
  createdAt: string;
  updatedAt: string;
  fileCreatedAt: string | null;
  fileModifiedAt: string | null;
  // 视频元数据
  codec: string | null;
  bitrate: number | null;
  fps: number | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
  parent?: Tag;
  children?: Tag[];
  files?: FileTag[];
  _count?: {
    files: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FileTag {
  id: string;
  fileId: string;
  tagId: string;
  tag: Tag;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FileFilters {
  folderId?: string;
  search?: string;
  mimeType?: string;
  color?: string | string[]; // 支持单色或多色筛选
  rating?: number;
  tagIds?: string[];
  format?: string; // File extension filter (e.g., 'jpg' or 'jpg,png,gif')
  sortBy?: 'createdAt' | 'format' | 'name' | 'size' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export type ViewMode = 'grid' | 'list' | 'masonry';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  isDisabled?: boolean;
  permissions?: string[];
  avatarUrl?: string;
  createdAt?: string;
  lastLogin?: string | null;
}

export interface UserServer {
  id: string;
  userId: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BackgroundEffectType = 'particles' | 'snow' | 'rain' | 'matrix' | 'none';

export interface UserSettings {
  backgroundEffect: BackgroundEffectType;
  primaryColor: string;
  secondaryColor: string;
  avatarUrl: string;
  reduceMotion?: boolean;  // 降低动画效果
  particleCount?: number;  // 粒子数量 (10-200)
}

export interface FileSequence {
  id: string;
  isSequence: true;
  name: string;
  baseName: string;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  files: FileItem[];
  firstFile: FileItem;
}

// History record types
export type HistoryAction = 'view' | 'edit' | 'rename' | 'move' | 'tag' | 'rate' | 'delete' | 'restore';

export interface HistoryRecord {
  id: string;
  fileId: string;
  fileName: string;
  filePath: string | null;
  action: HistoryAction;
  details: Record<string, any> | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface TrashItem {
  id: string;
  fileId: string;
  originalName: string;
  originalPath: string;
  thumbnailPath: string | null;
  mimeType: string;
  size: number;
  folderId: string | null;
  folderName: string | null;
  deletedAt: string;
  deletedBy: string | null;
  deletedByName: string | null;
  fileExists: boolean;
  canRestore: boolean;
}
