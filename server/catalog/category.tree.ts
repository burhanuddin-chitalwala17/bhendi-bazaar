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
