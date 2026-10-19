import type { Folder, Node, Root } from 'fumadocs-core/page-tree';

/**
 * Builds sidebar groups and collapsible folders from a flat page tree, so
 * page files and URLs stay flat. `meta.json` separators carry the structure:
 *
 * - `---Label---` (no icon) is a group label and closes any open folder.
 * - `---[Icon]Name---` opens a collapsible folder, named and iconed like the
 *   separator, that holds the following pages.
 * - A bare `---` closes the open folder without rendering anything.
 *
 * Folders start closed, and Fumadocs opens the one that holds the current page.
 */
export function groupSections(tree: Root): Root {
  const children: Node[] = [];
  let folder: Folder | undefined;
  let folders = 0;
  for (const node of tree.children) {
    if (node.type !== 'separator') {
      if (folder) folder.children.push(node);
      else children.push(node);
      continue;
    }
    folder = undefined;
    if (!node.name) continue;
    if (!node.icon) {
      children.push(node);
      continue;
    }
    folders += 1;
    folder = {
      $id: `${tree.$id ?? 'root'}:folder-${folders}`,
      type: 'folder',
      name: node.name,
      icon: node.icon,
      collapsible: true,
      defaultOpen: false,
      children: [],
    };
    children.push(folder);
  }
  return { ...tree, children };
}
