import { useEffect, type ReactNode } from "react";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { SingleStringCombobox } from "@/components/property_selector";
import { useSelectorContext } from "../selector-context";
import type { SuggestionTarget } from "../shared";

/** Combobox whose suggestions are requested from the selector's `suggestionsFetcher`. */
export function SuggestionInput({
    value,
    onValueChange,
    target,
    placeholder,
    ariaLabel,
    startAddon,
}: {
    value: string,
    onValueChange: (newValue: string) => void,
    target: SuggestionTarget,
    placeholder?: string,
    ariaLabel?: string,
    startAddon?: ReactNode,
}) {
    const { selection, suggestionsFetcher, rememberLabels } = useSelectorContext();
    const context = { selection, target };

    // NOTE: The context contains the whole selection, so any edit changes the query key. Without
    // `keepPreviousData` the query would briefly have no data, and the combobox would fall back to
    // showing raw values (URIs) until suggestions arrive again.
    const queryResult = useQuery({
        queryKey: ["ComplexPropertySelector2", context],
        queryFn: suggestionsFetcher ? (() => suggestionsFetcher(context)) : skipToken,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (queryResult.data) rememberLabels(queryResult.data);
    }, [queryResult.data, rememberLabels]);

    return (
        <SingleStringCombobox
            value={value}
            onValueChange={onValueChange}
            suggestionsQueryResult={queryResult}
            placeholder={placeholder}
            ariaLabel={ariaLabel}
            startAddon={startAddon}
        />
    );
}
