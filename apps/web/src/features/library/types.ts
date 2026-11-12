import type { PageMeta } from '@abdcshare/api-client';

export type LibraryItemStatus = 'Draft' | 'Published' | 'Archived';
export type LibraryVisibility = 'Firm' | 'Departments';
export type LibraryFileType = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'text';
export type LibrarySort = 'relevance' | 'newest' | 'title' | 'views' | 'downloads';
export type LibraryPreviewStatus = 'None' | 'Pending' | 'Ready' | 'Failed';

export interface LibraryRef {
  id: string;
  name: string;
}

export interface LibraryDepartmentRef {
  id: number;
  name: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  description: string | null;
  category: LibraryRef;
  authors: string | null;
  publishedYear: number | null;
  source: string | null;
  tags: string[];
  visibility: LibraryVisibility;
  departments: LibraryDepartmentRef[];
  status: LibraryItemStatus;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fileType: LibraryFileType | null;
  previewStatus: LibraryPreviewStatus;
  uploadedBy: LibraryRef;
  publishedAt: string | null;
  archivedAt: string | null;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LibraryCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface LibraryTag {
  tag: string;
  count: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Fields shared by create + edit (mirrors CreateLibraryItemDto / UpdateLibraryItemDto). */
export interface LibraryItemFields {
  title: string;
  categoryId: string;
  description?: string | null;
  authors?: string | null;
  publishedYear?: number | null;
  source?: string | null;
  tags?: string[];
  visibility?: LibraryVisibility;
  departmentIds?: number[];
}

export interface LibraryPreview {
  url: string | null;
  mode: 'native' | 'converted' | 'unavailable';
  previewStatus: LibraryPreviewStatus;
  reason?: 'pending' | 'failed' | 'unsupported';
}
