import { describe, expect, test } from "vitest";
import type { Constraint } from "./constraints";
import {
    ancestorsOf,
    canMoveNode,
    findNode,
    insertNode,
    locateNode,
    mapTree,
    moveNode,
    removeNode,
    ungroupNode,
} from "./constraint-tree";
import { removeProperty } from "./selection-ops";
import type { ConstraintGroup, ConstraintNode } from "./shared";

const leaf = (id: string, propertyId?: string): Constraint => ({
    subType: "langEquals",
    id,
    target: propertyId ? { kind: "property", propertyId } : { kind: "subject" },
    value: { kind: "literal", value: "en" },
});
const group = (id: string, children: ConstraintNode[], operator: ConstraintGroup["operator"] = "and"): ConstraintGroup =>
    ({ subType: "group", id, operator, children });

/** Shape of the tree as nested ids, for compact assertions. */
type Shape = string | [string, Shape[]];
const shape = (nodes: readonly ConstraintNode[]): Shape[] =>
    nodes.map((node) => (node.subType === "group" ? [node.id, shape(node.children)] : node.id));

// c1, g1 [c2, g2 [c3]], c4
const tree: ConstraintNode[] = [leaf("c1"), group("g1", [leaf("c2"), group("g2", [leaf("c3")], "or")]), leaf("c4")];

describe("constraint tree", () => {
    test("locate and ancestors", () => {
        expect(locateNode(tree, "c3")).toMatchObject({ parent: { id: "g2" }, index: 0 });
        expect(locateNode(tree, "c4")).toMatchObject({ parent: null, index: 2 });
        expect(ancestorsOf(tree, "c3").map((g) => g.id)).toEqual(["g1", "g2"]);
        expect(ancestorsOf(tree, "c1")).toEqual([]);
        expect(findNode(tree, "missing")).toBeUndefined();
    });

    test("insert and remove", () => {
        expect(shape(insertNode(tree, leaf("c5"), "g2"))).toEqual(["c1", ["g1", ["c2", ["g2", ["c3", "c5"]]]], "c4"]);
        expect(shape(insertNode(tree, leaf("c5"), null))).toEqual(["c1", ["g1", ["c2", ["g2", ["c3"]]]], "c4", "c5"]);
        expect(shape(removeNode(tree, "g2"))).toEqual(["c1", ["g1", ["c2"]], "c4"]);
    });

    test("move", () => {
        expect(shape(moveNode(tree, "c1", "g2"))).toEqual([["g1", ["c2", ["g2", ["c3", "c1"]]]], "c4"]);
        expect(shape(moveNode(tree, "c3", null))).toEqual(["c1", ["g1", ["c2", ["g2", []]]], "c4", "c3"]);
    });

    test("cannot move into itself, its contents or where it already is", () => {
        expect(canMoveNode(tree, "g1", "g1")).toBe(false);
        expect(canMoveNode(tree, "g1", "g2")).toBe(false);
        expect(canMoveNode(tree, "c3", "g2")).toBe(false);
        expect(canMoveNode(tree, "c1", null)).toBe(false);
        expect(canMoveNode(tree, "c1", "c4")).toBe(false);
        expect(canMoveNode(tree, "g2", null)).toBe(true);
        expect(shape(moveNode(tree, "g1", "g2"))).toEqual(shape(tree));
    });

    test("ungroup", () => {
        expect(shape(ungroupNode(tree, "g1"))).toEqual(["c1", "c2", ["g2", ["c3"]], "c4"]);
    });

    test("mapTree visits children first and removes nodes", () => {
        const visited: string[] = [];
        mapTree(tree, (node) => { visited.push(node.id); return node; });
        expect(visited).toEqual(["c1", "c2", "c3", "g2", "g1", "c4"]);
    });

    test("removing a property removes referencing constraints anywhere, keeping groups", () => {
        const selection = removeProperty({
            properties: [{ id: "p1", alternatives: [["a"]], mandatory: false }],
            constraints: [leaf("c1", "p1"), group("g1", [leaf("c2", "p1"), leaf("c3")])],
        }, "p1");
        expect(selection.properties).toEqual([]);
        expect(shape(selection.constraints)).toEqual([["g1", ["c3"]]]);
    });
});
