import type { PageMeta } from '@abdcshare/api-client';

export type LibraryItemStatus = 'Draft' | 'Published' | 'Archived';
export type LibraryVisibility = 'Firm' | 'Departments';
export type LibraryFileType = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'text';
export type LibrarySort = 'relevance' | 'newest' | 'title' | 'views' | 'downloads';
export type LibraryPreviewStatus = 'None' | 'Pending' | 'Ready' | 'Failed';
export type LibraryLicence = 'FreeToShare' | 'InternalUseOnly' | 'Licensed';
export type LibraryReportReason = 'ClientConfidential' | 'Copyright' | 'OutdatedOrWrong' | 'Inappropriate' | 'Other';
export type LibraryReportStatus = 'Open' | 'Dismissed' | 'Actioned';
export type LibraryReportOutcome = 'Dismiss' | 'Restrict' | 'Archive' | 'Delete';
export type LibraryEventAction =
  | 'Viewed'
  | 'Downloaded'
  | 'Uploaded'
  | 'FileReplaced'
  | 'Edited'
  | 'VisibilityChanged'
  | 'Archived'
  | 'Restored'
  | 'Deleted'
  | 'Reported'
  | 'ReportResolved'
  | 'OwnershipTransferred'
  | 'AddedToCollection'
  | 'RemovedFromCollection'
  | 'ZipExported';

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
  licence: LibraryLicence;
  licenceNote: string | null;
  /** false = view-only. */
  downloadable: boolean;
  declaredAt: string | null;
  /** The viewer may download the original (view-only items: editors only). */
  canDownload: boolean;
  /** Curators only: open reports on this item. */
  openReports: number;
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
  licence?: LibraryLicence;
  licenceNote?: string | null;
  downloadable?: boolean;
  /** Create only: add to this collection. */
  collectionId?: string;
  section?: string | null;
}

export interface LibraryEvent {
  id: string;
  action: LibraryEventAction;
  actor: { id: string; name: string } | null;
  collection: { id: string; title: string } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LibraryEventPage {
  data: LibraryEvent[];
  nextCursor: string | null;
}

export interface LibraryReportEntry {
  id: string;
  reason: LibraryReportReason;
  note: string | null;
  reporter: { id: string; name: string };
  status: LibraryReportStatus;
  outcome: LibraryReportOutcome | null;
  resolution: string | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface LibraryReportGroup {
  itemId: string | null;
  itemTitle: string;
  item: {
    status: LibraryItemStatus;
    visibility: LibraryVisibility;
    uploadedBy: { id: string; name: string };
    departments: LibraryDepartmentRef[];
  } | null;
  latestAt: string;
  reports: LibraryReportEntry[];
}

export interface LibraryPreview {
  url: string | null;
  mode: 'native' | 'converted' | 'unavailable';
  previewStatus: LibraryPreviewStatus;
  reason?: 'pending' | 'failed' | 'unsupported';
}
