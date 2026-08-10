/** Flat zip listing entry from the API. */
export type ZipListEntry = {
  name: string;
  size: number;
  isDirectory: boolean;
};

/** Hierarchical node for the archive browser. */
export type ZipTreeNode = {
  /** Stable id: directory paths end with `/`. */
  id: string;
  /** Display name (final path segment). */
  name: string;
  /** Full entry path (directories include trailing `/`). */
  path: string;
  isDirectory: boolean;
  size: number;
  children: ZipTreeNode[];
};

function compareNodes(a: ZipTreeNode, b: ZipTreeNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function sortTree(nodes: ZipTreeNode[]): void {
  nodes.sort(compareNodes);
  for (const node of nodes) {
    if (node.children.length > 0) sortTree(node.children);
  }
}

/**
 * Build a folder tree from a flat zip central-directory listing.
 * Synthesizes missing intermediate folders when the archive only lists files.
 */
export function buildZipEntryTree(entries: ZipListEntry[]): ZipTreeNode[] {
  const root: ZipTreeNode[] = [];
  const folders = new Map<string, ZipTreeNode>();

  function ensureFolder(dirPath: string): ZipTreeNode {
    const id = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const existing = folders.get(id);
    if (existing) return existing;

    const segments = id.replace(/\/+$/, '').split('/').filter(Boolean);
    const name = segments[segments.length - 1] ?? id;
    const node: ZipTreeNode = {
      id,
      name,
      path: id,
      isDirectory: true,
      size: 0,
      children: [],
    };
    folders.set(id, node);

    if (segments.length <= 1) {
      root.push(node);
    } else {
      const parentPath = `${segments.slice(0, -1).join('/')}/`;
      ensureFolder(parentPath).children.push(node);
    }
    return node;
  }

  for (const entry of entries) {
    const raw = entry.name.replace(/^\/+/, '');
    if (!raw || raw === '/') continue;

    if (entry.isDirectory || raw.endsWith('/')) {
      ensureFolder(raw);
      continue;
    }

    const segments = raw.split('/').filter(Boolean);
    if (segments.length === 0) continue;
    const fileName = segments[segments.length - 1]!;
    const fileNode: ZipTreeNode = {
      id: raw,
      name: fileName,
      path: raw,
      isDirectory: false,
      size: entry.size,
      children: [],
    };

    if (segments.length === 1) {
      root.push(fileNode);
    } else {
      const parentPath = `${segments.slice(0, -1).join('/')}/`;
      ensureFolder(parentPath).children.push(fileNode);
    }
  }

  sortTree(root);
  return root;
}

/** Folder ids to expand by default (root-level directories). */
export function defaultExpandedZipFolders(tree: ZipTreeNode[]): Set<string> {
  const expanded = new Set<string>();
  for (const node of tree) {
    if (node.isDirectory) expanded.add(node.id);
  }
  // If there is a single root folder, also expand its immediate children folders.
  if (tree.length === 1 && tree[0]?.isDirectory) {
    for (const child of tree[0].children) {
      if (child.isDirectory) expanded.add(child.id);
    }
  }
  return expanded;
}

export function countZipTreeFiles(nodes: ZipTreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.isDirectory) n += countZipTreeFiles(node.children);
    else n += 1;
  }
  return n;
}
