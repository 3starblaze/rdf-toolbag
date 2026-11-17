import type { Constraint } from "./constraints";

/**
 * Property that is selected from the subject. Each property is independent: it carries its own
 * path(s) and never refers to another property.
 */
export interface SelectedProperty {
    /** Identifier that constraints use to refer to this property. Unique within a selection. */
    id: string,
    /**
     * Alternative paths. Each path is a sequence of property names (steps) starting at the subject.
     * More than one path is a union: the property must match at least one of them.
     */
    alternatives: string[][],
    /**
     * Name that identifies the union variable. Only used when there is more than one alternative.
     */
    alias?: string,
    /** Whether the property must be present. */
    mandatory: boolean,
}

/** Argument of a constraint that refers to the subject itself. */
export interface SubjectArg {
    kind: "subject",
}

/** Argument of a constraint that refers to a selected property. */
export interface PropertyArg {
    kind: "property",
    /** `SelectedProperty.id` of the referenced property. */
    propertyId: string,
}

/** Argument of a constraint that holds a fixed value. */
export interface LiteralArg {
    kind: "literal",
    value: string,
}

/** Argument of a constraint. Subject and property arguments are looked up when the query runs. */
export type ConstraintArg = SubjectArg | PropertyArg | LiteralArg;

export interface ComplexPropertySelection {
    properties: SelectedProperty[],
    constraints: Constraint[],
}

/** Item that suggestions are requested for. */
export type SuggestionTarget =
    | {
        kind: "propertyStep",
        propertyId: string,
        alternativeIndex: number,
        stepIndex: number,
    }
    | {
        kind: "constraintArg",
        constraintId: string,
        /** `subType` of the constraint, e.g. "rdfType". */
        subType: Constraint["subType"],
        /** Name of the argument within the constraint, e.g. "target" or "value". */
        arg: string,
    };

export interface SuggestionsFetcherContext {
    /** Whole selection. */
    selection: ComplexPropertySelection,
    /** Item that suggestions are requested for. */
    target: SuggestionTarget,
}

export interface Suggestion {
    value: string,
    label: string,
}

export type SuggestionsFetcher = (ctx: SuggestionsFetcherContext) => Promise<Suggestion[]>;

/** Which view of the selector is shown. `null` is the main view. */
export type SelectorLocation =
    | null
    | { kind: "property", id: string }
    | { kind: "constraint", id: string };
