import { constraintDefinitions, definitionOf, type Constraint, type ConstraintSubType } from "./constraints";
import type { ComplexPropertySelection, SelectedProperty } from "./shared";
import { makeId } from "./util";

/** Constraints that refer to the property. */
export function constraintsReferencing(
    selection: ComplexPropertySelection,
    propertyId: string,
): Constraint[] {
    return selection.constraints.filter(
        (constraint) => definitionOf(constraint).referencedPropertyIds(constraint).includes(propertyId),
    );
}

/** Remove the property together with every constraint that refers to it. */
export function removeProperty(
    selection: ComplexPropertySelection,
    propertyId: string,
): ComplexPropertySelection {
    const referencing = new Set(constraintsReferencing(selection, propertyId));
    return {
        properties: selection.properties.filter((p) => p.id !== propertyId),
        constraints: selection.constraints.filter((c) => !referencing.has(c)),
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

export function addConstraint(
    selection: ComplexPropertySelection,
    subType: ConstraintSubType,
): { selection: ComplexPropertySelection, constraint: Constraint } {
    const constraint = constraintDefinitions[subType].create({
        id: makeId("c", selection.constraints.map((c) => c.id)),
        selection,
    });
    return {
        selection: { ...selection, constraints: [...selection.constraints, constraint] },
        constraint,
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

export function replaceConstraint(
    selection: ComplexPropertySelection,
    constraint: Constraint,
): ComplexPropertySelection {
    return {
        ...selection,
        constraints: selection.constraints.map((c) => (c.id === constraint.id ? constraint : c)),
    };
}

export function removeConstraint(
    selection: ComplexPropertySelection,
    constraintId: string,
): ComplexPropertySelection {
    return { ...selection, constraints: selection.constraints.filter((c) => c.id !== constraintId) };
}
