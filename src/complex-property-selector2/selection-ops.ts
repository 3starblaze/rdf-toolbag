import { constraintDefinitions, definitionOf, type Constraint, type ConstraintSubType } from "./constraints";
import {
    allConstraints,
    allNodes,
    insertNode,
    isGroup,
    mapTree,
    moveNode,
    removeNode,
    replaceNode,
    ungroupNode,
} from "./constraint-tree";
import type {
    ComplexPropertySelection,
    ConstraintGroup,
    ConstraintNode,
    GroupOperator,
    SelectedProperty,
} from "./shared";
import { makeId } from "./util";

function refersTo(constraint: Constraint, propertyId: string): boolean {
    return definitionOf(constraint).referencedPropertyIds(constraint).includes(propertyId);
}

/** Constraints (anywhere in the tree) that refer to the property. */
export function constraintsReferencing(
    selection: ComplexPropertySelection,
    propertyId: string,
): Constraint[] {
    return allConstraints(selection.constraints).filter((constraint) => refersTo(constraint, propertyId));
}

/** Remove the property together with every constraint that refers to it. Groups are kept. */
export function removeProperty(
    selection: ComplexPropertySelection,
    propertyId: string,
): ComplexPropertySelection {
    return {
        properties: selection.properties.filter((p) => p.id !== propertyId),
        constraints: mapTree(
            selection.constraints,
            (node) => (!isGroup(node) && refersTo(node, propertyId) ? null : node),
        ),
    };
}

export function addProperty(
    selection: ComplexPropertySelection,
): { selection: ComplexPropertySelection, property: SelectedProperty } {
    const property: SelectedProperty = {
        id: makeId("p", selection.properties.map((p) => p.id)),
        alternatives: [[""]],
        mandatory: false,
    };
    return {
        selection: { ...selection, properties: [...selection.properties, property] },
        property,
    };
}

function nodeIds(selection: ComplexPropertySelection): string[] {
    return allNodes(selection.constraints).map((node) => node.id);
}

/** Add a constraint to the group (`null` for the top level). */
export function addConstraint(
    selection: ComplexPropertySelection,
    subType: ConstraintSubType,
    parentId: string | null = null,
): { selection: ComplexPropertySelection, constraint: Constraint } {
    const constraint = constraintDefinitions[subType].create({
        id: makeId("c", nodeIds(selection)),
        selection,
    });
    return {
        selection: { ...selection, constraints: insertNode(selection.constraints, constraint, parentId) },
        constraint,
    };
}

/** Add an empty group to the group (`null` for the top level). */
export function addGroup(
    selection: ComplexPropertySelection,
    operator: GroupOperator,
    parentId: string | null = null,
): { selection: ComplexPropertySelection, group: ConstraintGroup } {
    const group: ConstraintGroup = {
        subType: "group",
        id: makeId("g", nodeIds(selection)),
        operator,
        children: [],
    };
    return {
        selection: { ...selection, constraints: insertNode(selection.constraints, group, parentId) },
        group,
    };
}

export function replaceProperty(
    selection: ComplexPropertySelection,
    property: SelectedProperty,
): ComplexPropertySelection {
    return {
        ...selection,
        properties: selection.properties.map((p) => (p.id === property.id ? property : p)),
    };
}

/** Replace the constraint or group with the same id. */
export function replaceConstraintNode(
    selection: ComplexPropertySelection,
    node: ConstraintNode,
): ComplexPropertySelection {
    return { ...selection, constraints: replaceNode(selection.constraints, node) };
}

/** Remove the constraint or group (together with everything inside it). */
export function removeConstraintNode(
    selection: ComplexPropertySelection,
    id: string,
): ComplexPropertySelection {
    return { ...selection, constraints: removeNode(selection.constraints, id) };
}

/** Move the constraint or group into the group (`null` for the top level). */
export function moveConstraintNode(
    selection: ComplexPropertySelection,
    id: string,
    parentId: string | null,
): ComplexPropertySelection {
    return { ...selection, constraints: moveNode(selection.constraints, id, parentId) };
}

/** Replace the group with its children. */
export function ungroup(selection: ComplexPropertySelection, groupId: string): ComplexPropertySelection {
    return { ...selection, constraints: ungroupNode(selection.constraints, groupId) };
}
