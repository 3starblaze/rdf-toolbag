/** Property that is matched by name. */
export interface PropertySelection {
    /**
     * Property names. More than one name is a union: the property must match at least one of them.
     */
    names: string[],
    /**
     * Name that identifies the union variable. Only used when `names` has more than one value.
     * Like other variable names, it is sanitized and prefixed when it collides with another.
     */
    alias?: string,
    /** Whether the property must be present. */
    mandatory: boolean,
}

export interface ObjectPropSelection extends PropertySelection {
    selection: ComplexPropertySelection,
}

/** Type that the subject must have. */
export interface TypeSelection {
    /**
     * Type names. More than one name is a union: the subject must have at least one of them.
     */
    names: string[],
}

export interface ComplexPropertySelection {
    rdfType: TypeSelection,
    dataProps: PropertySelection[],
    objectProps: ObjectPropSelection[],
}

/** Item that suggestions are requested for. */
export type SuggestionTarget =
    | { kind: "rdfType", valueIndex: number }
    | { kind: "dataProp", index: number, valueIndex: number }
    | { kind: "objectProp", index: number, valueIndex: number };

/**
 * Object property on the path from the root selection to the current selection.
 */
export interface SuggestionAncestor extends PropertySelection {
    /** Index of the object property within its parent's `objectProps`. */
    index: number,
    /** Selection that the object property points to. */
    selection: ComplexPropertySelection,
}

export interface SuggestionsFetcherContext {
    /** Whole selection tree. */
    rootSelection: ComplexPropertySelection,
    /** Selection that directly contains the target. */
    selection: ComplexPropertySelection,
    /** Object properties from the root to `selection`, outermost first. Empty at the root. */
    ancestors: readonly SuggestionAncestor[],
    /** Item that suggestions are requested for. */
    target: SuggestionTarget,
}

export type SuggestionsFetcher = (
    ctx: SuggestionsFetcherContext,
) => Promise<{ value: string, label: string }[]>;

/** Context fields shared by every suggestion request made from one selection level. */
export type SuggestionContextBase = Omit<SuggestionsFetcherContext, "target">;

export function makeDefaultSelection(): ComplexPropertySelection {
    return { rdfType: { names: [""] }, dataProps: [], objectProps: [] };
}
