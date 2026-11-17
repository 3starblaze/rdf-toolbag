import { createContext, useContext } from "react";
import type { ComplexPropertySelection, Suggestion, SuggestionsFetcher } from "./shared";
import type { LabelOf } from "./util";

export interface SelectorContextValue {
    /** Whole selection. */
    selection: ComplexPropertySelection,
    suggestionsFetcher: SuggestionsFetcher | undefined,
    /** Label of a value, as last seen in suggestions. Falls back to the value itself. */
    labelOf: LabelOf,
    /** Remember labels of suggestions so that compact views can show them. */
    rememberLabels: (suggestions: readonly Suggestion[]) => void,
}

export const SelectorContext = createContext<SelectorContextValue | null>(null);

export function useSelectorContext(): SelectorContextValue {
    const ctx = useContext(SelectorContext);
    if (!ctx) throw new Error("useSelectorContext must be used within ComplexPropertySelector");
    return ctx;
}
