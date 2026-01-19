import { SiftBookmark, SiftFolder } from '../utils/types';

export async function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return chrome.bookmarks.getTree();
}

export async function getAllBookmarks(): Promise<SiftBookmark[]> {
  const tree = await getBookmarkTree();
  const bookmarks: SiftBookmark[] = [];

  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          id: node.id,
          title: node.title,
          url: node.url,
          parentId: node.parentId,
          dateAdded: node.dateAdded,
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return bookmarks;
}

export async function getAllFolders(): Promise<SiftFolder[]> {
  const tree = await getBookmarkTree();
  const folders: SiftFolder[] = [];

  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (!node.url && node.id !== '0') {
        folders.push({
          id: node.id,
          title: node.title,
          parentId: node.parentId,
          children: [],
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return folders;
}

export async function createFolder(
  title: string,
  parentId?: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.create({
    title,
    parentId: parentId || '1', // Default to "Bookmarks Bar"
  });
}

export async function createBookmark(
  title: string,
  url: string,
  parentId?: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.create({
    title,
    url,
    parentId: parentId || '1',
  });
}

export async function moveBookmark(
  id: string,
  destination: { parentId?: string; index?: number }
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.move(id, destination);
}

export async function deleteBookmark(id: string): Promise<void> {
  return chrome.bookmarks.remove(id);
}

export async function deleteFolder(id: string): Promise<void> {
  return chrome.bookmarks.removeTree(id);
}

export async function updateBookmark(
  id: string,
  changes: { title?: string; url?: string }
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.update(id, changes);
}

export async function createSiftFolder(name?: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const folderName = name || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if Sift root folder exists
  const tree = await getBookmarkTree();
  let siftRoot: chrome.bookmarks.BookmarkTreeNode | undefined;

  function findSiftFolder(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (!node.url && node.title === 'Sift') {
        siftRoot = node;
        return;
      }
      if (node.children) {
        findSiftFolder(node.children);
      }
    }
  }

  findSiftFolder(tree);

  // Create Sift root if it doesn't exist
  if (!siftRoot) {
    siftRoot = await createFolder('Sift', '1');
  }

  // Create the named subfolder
  return createFolder(folderName, siftRoot.id);
}

export async function searchBookmarks(query: string): Promise<SiftBookmark[]> {
  const results = await chrome.bookmarks.search(query);
  return results
    .filter((node) => node.url)
    .map((node) => ({
      id: node.id,
      title: node.title,
      url: node.url!,
      parentId: node.parentId,
      dateAdded: node.dateAdded,
    }));
}

export async function sortFolder(folderId: string): Promise<void> {
  const children = await chrome.bookmarks.getChildren(folderId);

  // Separate folders and bookmarks
  const folders = children.filter((c) => !c.url);
  const bookmarks = children.filter((c) => c.url);

  // Sort alphabetically
  folders.sort((a, b) => a.title.localeCompare(b.title));
  bookmarks.sort((a, b) => a.title.localeCompare(b.title));

  // Move folders first, then bookmarks
  const sorted = [...folders, ...bookmarks];
  for (let i = 0; i < sorted.length; i++) {
    await chrome.bookmarks.move(sorted[i].id, { parentId: folderId, index: i });
  }
}

export async function sortAllFolders(): Promise<void> {
  const folders = await getAllFolders();
  for (const folder of folders) {
    await sortFolder(folder.id);
  }
}

export async function getBookmarkPath(bookmarkId: string): Promise<string> {
  const tree = await getBookmarkTree();
  const pathParts: string[] = [];

  function findPath(
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    targetId: string,
    currentPath: string[]
  ): boolean {
    for (const node of nodes) {
      if (node.id === targetId) {
        pathParts.push(...currentPath);
        return true;
      }
      if (node.children) {
        const newPath = node.title ? [...currentPath, node.title] : currentPath;
        if (findPath(node.children, targetId, newPath)) {
          return true;
        }
      }
    }
    return false;
  }

  findPath(tree, bookmarkId, []);
  return pathParts.join(' / ') || 'Root';
}

export async function getBookmarkPaths(
  bookmarkIds: string[]
): Promise<Record<string, string>> {
  const tree = await getBookmarkTree();
  const paths: Record<string, string> = {};

  // Build a map of id -> path for efficiency
  function buildPathMap(
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    currentPath: string[]
  ) {
    for (const node of nodes) {
      const nodePath = node.title ? [...currentPath, node.title] : currentPath;
      if (bookmarkIds.includes(node.id)) {
        paths[node.id] = currentPath.join(' / ') || 'Root';
      }
      if (node.children) {
        buildPathMap(node.children, nodePath);
      }
    }
  }

  buildPathMap(tree, []);
  return paths;
}
