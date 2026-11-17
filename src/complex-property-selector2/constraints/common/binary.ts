import type { ComplexPropertySelection, ConstraintArg } from "../../shared";
import { argPropertyIds, argText } from "../../util";
import type { ConstraintBase, ConstraintDefinition, ConstraintTextContext } from "../types";

/**
 * Constraint that relates a target (usually the subject or a property) to a value (usually a
 * literal), e.g. "Subject is ex:Person".
 */
export interface BinaryConstraint extends ConstraintBase {
    target: ConstraintArg,
    value: ConstraintArg,
}

/** Default arguments of a new binary constraint: the first property and an empty literal. */
export function defaultBinaryArgs(selection: ComplexPropertySelection): Pick<BinaryConstraint, "target" | "value"> {
    const first = selection.properties[0];
    return {
        target: first ? { kind: "property", propertyId: first.id } : { kind: "subject" },
        value: { kind: "literal", value: "" },
    };
}

/** Shared text helpers of binary constraint definitions. */
export function binaryConstraintText<C extends BinaryConstraint>({
    label,
    operator,
}: {
    label: string,
    operator: string,
}): Pick<ConstraintDefinition<C>, "referencedPropertyIds" | "describe" | "shortName"> {
    return {
        referencedPropertyIds: (constraint) => argPropertyIds([constraint.target, constraint.value]),
        describe: (constraint, { selection, labelOf }: ConstraintTextContext) => {
            const target = argText(constraint.target, selection, labelOf, Infinity);
            const value = argText(constraint.value, selection, labelOf, Infinity);
            return `${label}: ${target.full} ${operator} ${value.full}`;
        },
        shortName: (constraint, { selection, labelOf }: ConstraintTextContext) => {
            return `${label} · ${argText(constraint.target, selection, labelOf, 16).text}`;
        },
    };
}
