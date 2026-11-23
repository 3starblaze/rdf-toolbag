import type { ComponentType } from "react";
import type { ComplexPropertySelection, ConstraintArg } from "../shared";
import type { LabelOf } from "../util";

/** Fields every constraint has. */
export interface ConstraintBase {
    /** Unique key of the constraint kind, e.g. "rdfType". Used for serialization. */
    subType: string,
    /** Identifier of this constraint. Unique among all constraints and groups of a selection. */
    id: string,
    /** Whether the constraint is inverted (NOT). */
    negated?: boolean,
}

export interface ConstraintMainViewProps<C extends ConstraintBase> {
    constraint: C,
}

export interface ConstraintEditViewProps<C extends ConstraintBase> {
    constraint: C,
    onConstraintChange: (newConstraint: C) => void,
}

export interface ConstraintTextContext {
    selection: ComplexPropertySelection,
    labelOf: LabelOf,
}

/**
 * How a literal argument is written in the query. Subject and property arguments are always written
 * as variables.
 */
export type LiteralTermKind = "iri" | "string";

export interface ConstraintQueryContext {
    /**
     * SPARQL term of an argument: a variable for the subject or a property, an IRI or a string
     * literal (see `literalAs`) for a literal.
     *
     * Returns `null` when the argument cannot be used yet, i.e. the literal is empty or the
     * referenced property was removed or has no complete path.
     */
    term: (arg: ConstraintArg, literalAs: LiteralTermKind) => string | null,
}

/**
 * Everything the selector needs to know about one kind of constraint. Each kind lives in its own
 * folder under `constraints/` and is registered in `constraints/index.ts`.
 */
export interface ConstraintDefinition<C extends ConstraintBase> {
    subType: C["subType"],
    /** Name of the constraint kind, e.g. "Type". */
    label: string,
    /** One sentence that explains the constraint kind. */
    description: string,
    /** Create a new constraint of this kind. */
    create: (args: { id: string, selection: ComplexPropertySelection }) => C,
    /**
     * Ids of the properties that the constraint refers to. A constraint is removed together with
     * any property it refers to.
     */
    referencedPropertyIds: (constraint: C) => string[],
    /** Full one-line text of the constraint, e.g. for hover and accessible names. */
    describe: (constraint: C, ctx: ConstraintTextContext) => string,
    /** Short name of the constraint, e.g. for the breadcrumb. */
    shortName: (constraint: C, ctx: ConstraintTextContext) => string,
    /**
     * SPARQL expression of the constraint, e.g. `LANG(?label) = "en"`. Expressions of all
     * constraints are combined with `&&`, `||` and `!` (following groups and negation) into one
     * FILTER. Negation is applied by the query builder, so the expression should not include it.
     *
     * Returns `null` when the constraint is incomplete and should be left out of the query.
     */
    expression: (constraint: C, ctx: ConstraintQueryContext) => string | null,
    /** Compact one-line view, shown in the constraint list of the main view. */
    MainView: ComponentType<ConstraintMainViewProps<C>>,
    /** View where the constraint is edited. */
    EditView: ComponentType<ConstraintEditViewProps<C>>,
}
