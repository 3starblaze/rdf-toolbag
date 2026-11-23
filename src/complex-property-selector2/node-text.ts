import { definitionOf, type Constraint, type ConstraintTextContext } from "./constraints";
import { isGroup } from "./constraint-tree";
import type { ConstraintGroup, ConstraintNode } from "./shared";

const notPrefix = (node: ConstraintNode) => (node.negated ? "NOT " : "");

/** Full one-line text of a constraint, including its negation. */
export function describeConstraint(constraint: Constraint, ctx: ConstraintTextContext): string {
    return notPrefix(constraint) + definitionOf(constraint).describe(constraint, ctx);
}

/** Short name of a constraint, including its negation. */
export function constraintShortName(constraint: Constraint, ctx: ConstraintTextContext): string {
    return notPrefix(constraint) + definitionOf(constraint).shortName(constraint, ctx);
}

/** Name of a group, e.g. "NOT OR group", optionally followed by a summary of its first item. */
export function groupName(group: ConstraintGroup, ctx: ConstraintTextContext, withSummary = false): string {
    const base = `${notPrefix(group)}${group.operator.toUpperCase()} group`;
    if (!withSummary) return base;
    const first = group.children[0];
    let summary = "empty";
    if (first) summary = isGroup(first) ? "nested group" : constraintShortName(first, ctx);
    if (summary.length > 44) summary = summary.slice(0, 43) + "…";
    return `${base} · ${summary}`;
}

/** Number of constraints (not groups) inside the nodes. */
export function countConstraints(nodes: readonly ConstraintNode[]): number {
    return nodes.reduce((n, node) => n + (isGroup(node) ? countConstraints(node.children) : 1), 0);
}

export function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}
