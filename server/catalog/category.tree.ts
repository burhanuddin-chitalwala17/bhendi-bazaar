/**
 * The two tree rules Postgres cannot express declaratively (category-tree TRD
 * D1/D2), pure over `(id, parentId)` rows so every branch is unit-testable
 * without a database. Callers load the rows — the table is tens of rows.
 */

export interface CategoryTreeNode {
  id: string;
  parentId: string | null;
}

/**
 * The category and everything beneath it, for subtree product queries.
 * Breadth-first with a visited set: already-corrupt data (a cycle that slipped
 * in outside the app) must degrade to a wrong list, never a hang.
 */
export function collectSubtreeIds(
  nodes: CategoryTreeNode[],
  rootId: string
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const siblings = childrenByParent.get(node.parentId);
    if (siblings) siblings.push(node.id);
    else childrenByParent.set(node.parentId, [node.id]);
  }

  const collected = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (collected.has(childId)) continue;
      collected.add(childId);
      queue.push(childId);
    }
  }
  return [...collected];
}

/**
 * Would setting `newParentId` as `categoryId`'s parent make the category its own
 * ancestor? Walks up from the proposed parent; self-parenting is the one-step
 * case of the same rule. A visited set terminates the walk on already-corrupt
 * data — a pre-existing loop that never reaches `categoryId` is not a cycle
 * this write creates.
 */
export function wouldCreateCycle(
  nodes: CategoryTreeNode[],
  categoryId: string,
  newParentId: string
): boolean {
  const parentById = new Map(nodes.map((n) => [n.id, n.parentId]));
  const visited = new Set<string>();
  let current: string | null | undefined = newParentId;
  while (current != null && !visited.has(current)) {
    if (current === categoryId) return true;
    visited.add(current);
    current = parentById.get(current);
  }
  return false;
}

/**
 * Every descendant of `rootId` as one flat list — `null` meaning the whole tree.
 * The root itself is excluded: a page never offers a tile for where the shopper
 * already is, so the set shrinks on every descent and a leaf yields nothing.
 *
 * Breadth-first, so the shallowest categories reach the visible left end of the
 * storefront's single scrolling lane row and depth only ever pushes one further
 * right. Input order is preserved within a level, which is how siblings inherit
 * `order` without this module knowing the column exists. A visited set keeps
 * already-corrupt data degrading to a wrong list rather than hanging, as in
 * `collectSubtreeIds`.
 */
export function flattenDescendantIds(
  nodes: CategoryTreeNode[],
  rootId: string | null
): string[] {
  const childrenByParent = new Map<string | null, string[]>();
  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId);
    if (siblings) siblings.push(node.id);
    else childrenByParent.set(node.parentId, [node.id]);
  }

  const seen = new Set<string>(rootId === null ? [] : [rootId]);
  const ordered: string[] = [];
  let frontier = childrenByParent.get(rootId) ?? [];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
      next.push(...(childrenByParent.get(id) ?? []));
    }
    frontier = next;
  }
  return ordered;
}

/**
 * The path from the root down to — but not including — `id`, which is what a
 * breadcrumb reads. Descend-only navigation draws no tile for an ancestor, so
 * this trail is the only way back up the tree from a category page.
 */
export function collectAncestorIds(
  nodes: CategoryTreeNode[],
  id: string
): string[] {
  const parentById = new Map(nodes.map((n) => [n.id, n.parentId]));
  const visited = new Set<string>([id]);
  const ancestors: string[] = [];
  let current: string | null | undefined = parentById.get(id);
  while (current != null && !visited.has(current)) {
    visited.add(current);
    ancestors.push(current);
    current = parentById.get(current);
  }
  return ancestors.reverse();
}
