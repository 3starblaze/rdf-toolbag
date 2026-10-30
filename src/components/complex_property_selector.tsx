import { useState } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { SingleStringCombobox } from "./property_selector";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { DestroyItemButton, MultiItemAddButton, MultiItemRow, MultiItemSelectorBase, MultiItemSelectorList } from "./MultiItemList";

export interface ComplexPropertySelection {
    rdfType: string,
    dataProps: {
        name: string,
    }[],
    objectProps: {
        name: string,
        selection: ComplexPropertySelection,
    }[],
}

/** Item that suggestions are requested for. */
export type SuggestionTarget =
    | { kind: "rdfType" }
    | { kind: "dataProp", index: number }
    | { kind: "objectProp", index: number };

/** Object property on the path from the root selection to the current selection. */
export interface SuggestionAncestor {
    /** Name of the object property. */
    name: string,
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
type SuggestionContextBase = Omit<SuggestionsFetcherContext, "target">;

export function makeDefaultSelection(): ComplexPropertySelection {
    return { rdfType: "", dataProps: [], objectProps: [] };
}

function SuggestionCombobox({
    value,
    onValueChange,
    suggestionsFetcher,
    context,
    placeholder,
}: {
    value: string,
    onValueChange: (newValue: string) => void,
    suggestionsFetcher: SuggestionsFetcher | undefined,
    context: SuggestionsFetcherContext,
    placeholder?: string,
}) {
    const suggestionsQueryResult = useQuery({
        queryKey: ["ComplexPropertySelector", context],
        queryFn: suggestionsFetcher
            ? (() => suggestionsFetcher(context))
            : skipToken,
    });

    return (
        <SingleStringCombobox
            suggestionsQueryResult={suggestionsQueryResult}
            value={value}
            onValueChange={onValueChange}
            placeholder={placeholder}
        />
    );
}

function DataPropsSelector({
    selection,
    onSelectionChange,
    suggestionsFetcher,
    contextBase,
}: {
    selection: ComplexPropertySelection,
    onSelectionChange: (newSelection: ComplexPropertySelection) => void,
    suggestionsFetcher: SuggestionsFetcher | undefined,
    contextBase: SuggestionContextBase,
}) {
    function addDataProp() {
        onSelectionChange({
            ...selection,
            dataProps: [...selection.dataProps, { name: "" }],
        })
    }

    function setDataPropName(newName: string, i: number) {
        onSelectionChange({
            ...selection,
            dataProps: [
                ...selection.dataProps.slice(0, i),
                { ...selection.dataProps[i], name: newName },
                ...selection.dataProps.slice(i+1),
            ],
        });
    }

    function deleteDataProp(i: number) {
        onSelectionChange({
            ...selection,
            dataProps: [
                ...selection.dataProps.slice(0, i),
                ...selection.dataProps.slice(i+1),
            ],
        });
    }

    return (
        <div>
            <p>Properties (data)</p>
            <MultiItemSelectorBase>
                <MultiItemSelectorList>
                    {/* NOTE: Index keys are intentional. Item name may not be unique. */}
                    {selection.dataProps.map((item, i) => (
                        <div
                            key={i}
                            className="flex gap-2"
                        >
                            <SuggestionCombobox
                                value={item.name}
                                onValueChange={(newName) => setDataPropName(newName, i)}
                                suggestionsFetcher={suggestionsFetcher}
                                context={{ ...contextBase, target: { kind: "dataProp", index: i } }}
                            />
                            <DestroyItemButton
                                onClick={() => deleteDataProp(i)}
                            />
                        </div>
                    ))}
                </MultiItemSelectorList>
                <MultiItemAddButton onClick={addDataProp}>
                    Add data property
                </MultiItemAddButton>
            </MultiItemSelectorBase>
        </div>
    );
}

function ObjectPropsSelector({
    selection,
    onSelectionChange,
    suggestionsFetcher,
    contextBase,
    recursionDepth,
}: {
    selection: ComplexPropertySelection,
    onSelectionChange: (newSelection: ComplexPropertySelection) => void,
    suggestionsFetcher: SuggestionsFetcher | undefined,
    contextBase: SuggestionContextBase,
    /**
     * @see ComplexPropertySelector
     */
    recursionDepth: number,
}) {
    const objectProps = selection.objectProps;

    function setObjectProps(newObjectProps: ComplexPropertySelection["objectProps"]) {
        onSelectionChange({ ...selection, objectProps: newObjectProps });
    }

    return (
        <div>
            <p>Properties (object)</p>
            <MultiItemSelectorBase>
                <MultiItemSelectorList>
                    {/* NOTE: Index keys are intentional. Names change while the user types, so they cannot identify a row. */}
                    {objectProps.map((item, i) => (
                        <Collapsible
                            key={i}
                            className="flex flex-col group gap-2"
                        >
                            <MultiItemRow>
                                <SuggestionCombobox
                                    value={item.name}
                                    onValueChange={(newName) => setObjectProps([
                                        ...objectProps.slice(0, i),
                                        { ...item, name: newName },
                                        ...objectProps.slice(i+1),
                                    ])}
                                    suggestionsFetcher={suggestionsFetcher}
                                    context={{ ...contextBase, target: { kind: "objectProp", index: i } }}
                                />
                                <DestroyItemButton
                                    onClick={() => setObjectProps([
                                        ...objectProps.slice(0, i),
                                        ...objectProps.slice(i + 1),
                                    ])}
                                />
                                <CollapsibleTrigger className="cursor-pointer">
                                    <ChevronDown
                                        className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                                    />
                                </CollapsibleTrigger>
                            </MultiItemRow>
                            <CollapsibleContent className={cn(
                                "text-gray-700 ml-4 p-2",
                                (recursionDepth % 2 === 0) ? "bg-gray-100" : "bg-white",
                            )}>
                                <ComplexPropertySelectorBase
                                    selection={item.selection}
                                    onSelectionChange={(newSelection) => setObjectProps([
                                        ...objectProps.slice(0, i),
                                        { ...item, selection: newSelection },
                                        ...objectProps.slice(i + 1),
                                    ])}
                                    rootSelection={contextBase.rootSelection}
                                    ancestors={[
                                        ...contextBase.ancestors,
                                        { name: item.name, index: i, selection: item.selection },
                                    ]}
                                    suggestionsFetcher={suggestionsFetcher}
                                    recursionDepth={recursionDepth + 1}
                                />
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </MultiItemSelectorList>
                <MultiItemAddButton onClick={() => setObjectProps([
                    ...objectProps,
                    { name: "", selection: makeDefaultSelection() },
                ])}>
                    Add object property
                </MultiItemAddButton>
            </MultiItemSelectorBase>
        </div>
    );
}

export interface ComplexPropertySelectorProps {
    /** Selection to show. */
    selection?: ComplexPropertySelection,
    /** Callback invoked on selection change. */
    onSelectionChange?: (selection: ComplexPropertySelection) => void,
    /** Initial selection value for uncontrolled state. */
    defaultSelection?: ComplexPropertySelection,
    /** Fetch suggestions for rdfType and props. */
    suggestionsFetcher?: SuggestionsFetcher,
}

function ComplexPropertySelectorBase({
    selection,
    onSelectionChange,
    rootSelection,
    ancestors,
    suggestionsFetcher,
    recursionDepth,
}: {
    /** Selection shown at this level. */
    selection: ComplexPropertySelection,
    onSelectionChange: (newSelection: ComplexPropertySelection) => void,
    rootSelection: ComplexPropertySelection,
    ancestors: readonly SuggestionAncestor[],
    suggestionsFetcher: SuggestionsFetcher | undefined,
    /**
     * Recursion index that is used to apply style properly.
     */
    recursionDepth: number,
}) {
    const contextBase: SuggestionContextBase = { rootSelection, selection, ancestors };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <p>Type</p>
                <SuggestionCombobox
                    value={selection.rdfType}
                    onValueChange={(rdfType) => onSelectionChange({ ...selection, rdfType })}
                    suggestionsFetcher={suggestionsFetcher}
                    context={{ ...contextBase, target: { kind: "rdfType" } }}
                    placeholder="Enter type"
                />
            </div>
            <DataPropsSelector
                selection={selection}
                onSelectionChange={onSelectionChange}
                suggestionsFetcher={suggestionsFetcher}
                contextBase={contextBase}
            />
            <ObjectPropsSelector
                selection={selection}
                onSelectionChange={onSelectionChange}
                suggestionsFetcher={suggestionsFetcher}
                contextBase={contextBase}
                recursionDepth={recursionDepth}
            />
        </div>
    );
}

export default function ComplexPropertySelector({
    defaultSelection,
    selection: controlledSelection,
    onSelectionChange,
    suggestionsFetcher,
}: ComplexPropertySelectorProps) {
    // NOTE: We are wrapping this component with its own queryClient so that this component can be
    // used without explicitly requiring end users to use tanstack query.
    // NOTE: The client is created once per instance so that its cache survives re-renders.
    const [queryClient] = useState(() => new QueryClient());

    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ComplexPropertySelectorBase
                selection={selection}
                onSelectionChange={setSelection}
                rootSelection={selection}
                ancestors={[]}
                suggestionsFetcher={suggestionsFetcher}
                recursionDepth={0}
            />
        </QueryClientProvider>
    );
}
