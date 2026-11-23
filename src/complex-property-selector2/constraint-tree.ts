import type { Constraint } from "./constraints";
import type { ConstraintGroup, ConstraintNode } from "./shared";

export function isGroup(node: ConstraintNode): node is ConstraintGroup {
    return node.subType === "group";
}

export interface NodeLocation {
    node: ConstraintNode,
    /** Group that directly contains the node, `null` for the top level. */
    parent: ConstraintGroup | null,
    /** Index of the node within its parent's children (or the top-level list). */
    index: number,
}

export function locateNode(
    nodes: readonly ConstraintNode[],
    id: string,
    parent: ConstraintGroup | null = null,
): NodeLocation | undefined {
    for (const [index, node] of nodes.entries()) {
        if (node.id === id) return { node, parent, index };
        if (isGroup(node)) {
            const found = locateNode(node.children, id, node);
            if (found) return found;
        }
    }
    return undefined;
}

export function findNode(nodes: readonly ConstraintNode[], id: string): ConstraintNode | undefined {
    return locateNode(nodes, id)?.node;
}

/** Groups that contain the node, outermost first. */
export function ancestorsOf(nodes: readonly ConstraintNode[], id: string): ConstraintGroup[] {
    const walk = (list: readonly ConstraintNode[], chain: ConstraintGroup[]): ConstraintGroup[] | undefined => {
        for (const node of list) {
            if (node.id === id) return chain;
            if (isGroup(node)) {
                const found = walk(node.children, [...chain, node]);
                if (found) return found;
            }
        }
        return undefined;
    };
    return walk(nodes, []) ?? [];
}

/** Every node of the tree, parents before their children. */
export function allNodes(nodes: readonly ConstraintNode[]): ConstraintNode[] {
    return nodes.flatMap((node) => isGroup(node) ? [node, ...allNodes(node.children)] : [node]);
}

export function allGroups(nodes: readonly ConstraintNode[]): ConstraintGroup[] {
    return allNodes(nodes).filter(isGroup);
}

export function allConstraints(nodes: readonly ConstraintNode[]): Constraint[] {
    return allNodes(nodes).filter((node): node is Constraint => !isGroup(node));
}

/** Ids of the node and everything inside it. */
export function selfAndDescendantIds(node: ConstraintNode): string[] {
    return allNodes([node]).map((it) => it.id);
}

/** Apply `fn` to every node, children first. Nodes for which `fn` returns `null` are removed. */
export function mapTree(
    nodes: readonly ConstraintNode[],
    fn: (node: ConstraintNode) => ConstraintNode | null,
): ConstraintNode[] {
    return nodes.flatMap((node) => {
        const mapped = fn(isGroup(node) ? { ...node, children: mapTree(node.children, fn) } : node);
        return mapped === null ? [] : [mapped];
    });
}

export function replaceNode(nodes: readonly ConstraintNode[], newNode: ConstraintNode): ConstraintNode[] {
    return mapTree(nodes, (node) => (node.id === newNode.id ? newNode : node));
}

export function removeNode(nodes: readonly ConstraintNode[], id: string): ConstraintNode[] {
    return mapTree(nodes, (node) => (node.id === id ? null : node));
}

/** Add the node as the last child of the group (`null` for the top level). */
export function insertNode(
    nodes: readonly ConstraintNode[],
    node: ConstraintNode,
    parentId: string | null,
): ConstraintNode[] {
    if (parentId === null) return [...nodes, node];
    return mapTree(nodes, (it) => (it.id === parentId && isGroup(it) ? { ...it, children: [...it.children, node] } : it));
}

/**
 * Whether the node can be moved into the group (`null` for the top level): not into itself or its
 * own contents, and not where it already is.
 */
export function canMoveNode(nodes: readonly ConstraintNode[], id: string, parentId: string | null): boolean {
    const location = locateNode(nodes, id);
    if (!location) return false;
    if (parentId !== null) {
        const parent = findNode(nodes, parentId);
        if (!parent || !isGroup(parent)) return false;
        if (selfAndDescendantIds(location.node).includes(parentId)) return false;
    }
    return (location.parent?.id ?? null) !== parentId;
}

/** Move the node to the end of the group (`null` for the top level). See `canMoveNode`. */
export function moveNode(nodes: readonly ConstraintNode[], id: string, parentId: string | null): ConstraintNode[] {
    if (!canMoveNode(nodes, id, parentId)) return [...nodes];
    const node = findNode(nodes, id)!;
    return insertNode(removeNode(nodes, id), node, parentId);
}

/** Replace the group with its children. */
export function ungroupNode(nodes: readonly ConstraintNode[], groupId: string): ConstraintNode[] {
    return nodes.flatMap((node) => {
        if (!isGroup(node)) return [node];
        if (node.id === groupId) return node.children;
        return [{ ...node, children: ungroupNode(node.children, groupId) }];
    });
}
