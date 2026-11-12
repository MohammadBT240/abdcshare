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
  collections: LibraryCollectionRef[];
  canEdit: boolean;
  canDelete: boolean;
}

export type LibraryCollectionType = 'Training' | 'Workshop' | 'Conference' | 'Project' | 'Programme' | 'Other';
export type LibraryCollectionStatus = 'Active' | 'Archived';

export interface LibraryCollectionRef {
  id: string;
  title: string;
  type: LibraryCollectionType;
  section: string | null;
}

export interface LibraryCollection {
  id: string;
  title: string;
  slug: string;
  type: LibraryCollectionType;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  facilitator: string | null;
  venue: string | null;
  externalUrl: string | null;
  visibility: LibraryVisibility;
  departments: LibraryDepartmentRef[];
  status: LibraryCollectionStatus;
  owner: LibraryRef;
  itemCount: number;
  hiddenItemCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LibraryCollectionMember {
  position: number;
  section: string | null;
  item: LibraryItem;
}

export interface LibraryCollectionFields {
  title: string;
  type: LibraryCollectionType;
  description?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  facilitator?: string | null;
  venue?: string | null;
  externalUrl?: string | null;
  visibility?: LibraryVisibility;
  departmentIds?: number[];
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
  /** Create only: add to this collection. */
  collectionId?: string;
  section?: string | null;
}

export interface LibraryPreview {
  url: string | null;
  mode: 'native' | 'converted' | 'unavailable';
  previewStatus: LibraryPreviewStatus;
  reason?: 'pending' | 'failed' | 'unsupported';
}
