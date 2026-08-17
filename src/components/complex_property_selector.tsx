import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { SingleStringCombobox } from "./property_selector";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider, skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { DestroyItemButton, MultiItemAddButton, MultiItemRow, MultiItemSelectorBase, MultiItemSelectorList } from "./MultiItemList";
import {
    getFetchTargetValue,
    getThisSelection,
    type PropFetchTarget,
    type SuggestionsFetcher,
    type SuggestionsFetcherContext,
} from "@/suggestions-fetcher-util";

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


export function makeDefaultSelection(): ComplexPropertySelection {
    return { rdfType: "", dataProps: [], objectProps: [] };
}

function useSuggestionsQuery(
    fetchFn: SuggestionsFetcher | null,
    context: SuggestionsFetcherContext,
): UseQueryResult<{ label: string, value: string }[], Error> {
    return useQuery({
        queryKey: ["ComplexPropertySelector", "objectProp", context],
        queryFn: fetchFn
            ? (() => fetchFn(context))
            : skipToken,
    });
}

function PropCombobox({
    suggestionsFetcher,
    setName,
    suggestionsFetcherContext,
}: {
    suggestionsFetcher: SuggestionsFetcher | null,
    suggestionsFetcherContext: SuggestionsFetcherContext & { fetchTarget: PropFetchTarget },
    setName: (newName: string) => void,
}) {
    const value = getFetchTargetValue(suggestionsFetcherContext).name;

    const suggestionsQueryResult = useSuggestionsQuery(
        suggestionsFetcher,
        suggestionsFetcherContext,
    );

    return (
        <SingleStringCombobox
            suggestionsQueryResult={suggestionsQueryResult}
            value={value}
            onValueChange={setName}
        />
    );
}

function ObjectPropsSelector({
    thisSelection,
    suggestionsFetcher,
    onValueChange,
    partialSuggestionsFetcherContext,
    /**
     * @see ComplexPropertySelector
     */
    recursionDepth = 0,
}: {
    thisSelection: ComplexPropertySelection,
    onValueChange: (newValue: ComplexPropertySelection["objectProps"]) => void,
    suggestionsFetcher: SuggestionsFetcher | null,
    rdfType: string,
    defaultValue?: ComplexPropertySelection["objectProps"],
    recursionDepth?: number,
    partialSuggestionsFetcherContext: PartialSuggestionsFetcherContext,
}) {
    const value = thisSelection.objectProps;

    const addItem = () => {
        onValueChange([
            ...value,
            { name: "", selection: makeDefaultSelection() },
        ])
    }

    return (
        <div>
            <p>Properties (object)</p>
            <MultiItemSelectorBase>
                <MultiItemSelectorList>
                    {value.map((item, i) => (
                        <Collapsible
                            key={i}
                            className="flex flex-col group gap-2"
                        >
                            <MultiItemRow>
                                <PropCombobox
                                    suggestionsFetcher={suggestionsFetcher}
                                    suggestionsFetcherContext={{
                                        ...partialSuggestionsFetcherContext,
                                        fetchTarget: {
                                            targetItem: "objectProp",
                                            propIndex: i,
                                        },
                                    }}
                                    setName={(newName) => onValueChange([
                                        ...value.slice(0, i),
                                        { ...item, name: newName },
                                        ...value.slice(i+1)
                                    ])}
                                />
                                <DestroyItemButton
                                    onClick={() => onValueChange([
                                        ...value.slice(0, i),
                                        ...value.slice(i + 1),
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
                                    selection={value[i].selection}
                                    onSelectionChange={(newSelection) => onValueChange([
                                        ...value.slice(0, i),
                                        { ...value[i], selection: newSelection },
                                        ...value.slice(i + 1),
                                    ])}
                                    suggestionsFetcher={suggestionsFetcher ?? undefined}
                                    recursionDepth={recursionDepth + 1}
                                    partialSuggestionsFetcherContext={{
                                        ...partialSuggestionsFetcherContext,
                                        parentFetchTargets: [
                                            ...partialSuggestionsFetcherContext.parentFetchTargets,
                                            { targetItem: "objectProp", propIndex: i },
                                        ],
                                    }}
                                />
                            </CollapsibleContent>
                        </Collapsible>
                    ))}
                </MultiItemSelectorList>
                <MultiItemAddButton onClick={addItem}>
                    Add object property
                </MultiItemAddButton>
            </MultiItemSelectorBase>
        </div>
    );
}

type PartialSuggestionsFetcherContext = Omit<SuggestionsFetcherContext, "fetchTarget">

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

function RdfTypeSelector({
    onValueChange,
    partialSuggestionsFetcherContext,
    suggestionsFetcher,
}: {
    onValueChange: (val: string) => void,
    suggestionsFetcher: SuggestionsFetcher | null,
    partialSuggestionsFetcherContext: PartialSuggestionsFetcherContext,
}) {
    const ctx = {
        ...partialSuggestionsFetcherContext,
        fetchTarget: { targetItem: "rdfType" },
    } satisfies SuggestionsFetcherContext;

    const rdfTypeQuery = useSuggestionsQuery(suggestionsFetcher, ctx);

    const value = getFetchTargetValue(ctx);

    return (
        <div>
            <p>Type</p>
            <SingleStringCombobox
                suggestionsQueryResult={rdfTypeQuery}
                value={value}
                onValueChange={onValueChange}
                placeholder="Enter type"
            />
        </div>
    );
}

function DataPropsSelector({
    thisSelection,
    suggestionsFetcher,
    setSelection,
    partialSuggestionsFetcherContext,
} : {
    thisSelection: ComplexPropertySelection,
    suggestionsFetcher: SuggestionsFetcher | null,
    setSelection: (newValue: ComplexPropertySelection) => void,
    partialSuggestionsFetcherContext: PartialSuggestionsFetcherContext,
}) {
    function addDataProp() {
        setSelection({
            ...thisSelection,
            dataProps: [...thisSelection.dataProps, { name: "" }],
        })
    }

    function setDataPropName(newName: string, i: number) {
        setSelection({
            ...thisSelection,
            dataProps: [
                ...thisSelection.dataProps.slice(0, i),
                { ...thisSelection.dataProps[i], name: newName },
                ...thisSelection.dataProps.slice(i+1),
            ],
        });
    }

    function deleteDataProp(i: number) {
        setSelection({
            ...thisSelection,
            dataProps: [
                ...thisSelection.dataProps.slice(0, i),
                ...thisSelection.dataProps.slice(i+1),
            ],
        });
    }

    return (
        <div>
            <p>Properties (data)</p>
            <MultiItemSelectorBase>
                <MultiItemSelectorList>
                    {thisSelection.dataProps.map((_, i) => (
                        <div
                            key={i}
                            className="flex gap-2"
                        >
                            <PropCombobox
                                suggestionsFetcherContext={{
                                    ...partialSuggestionsFetcherContext,
                                    fetchTarget: { targetItem: "dataProp", propIndex: i },
                                }}
                                suggestionsFetcher={suggestionsFetcher}
                                setName={(newName) => setDataPropName(newName, i)}
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

function ComplexPropertySelectorBase({
    onSelectionChange,
    suggestionsFetcher,
    partialSuggestionsFetcherContext,
    recursionDepth,
}: ComplexPropertySelectorProps & {
    onSelectionChange: (it: ComplexPropertySelection) => void,
    /** Fragment of context that is used to build full context. */
    partialSuggestionsFetcherContext: PartialSuggestionsFetcherContext,
    /**
     * Recursion index that is used to apply style properly.
     */
    recursionDepth: number,
}) {
    const selection = getThisSelection(partialSuggestionsFetcherContext);

    return (
        <div className="flex flex-col gap-4">
            <RdfTypeSelector
                onValueChange={(rdfType) => onSelectionChange({
                    ...selection,
                    rdfType,
                })}
                suggestionsFetcher={suggestionsFetcher ?? null}
                partialSuggestionsFetcherContext={partialSuggestionsFetcherContext}
            />
            <DataPropsSelector
                suggestionsFetcher={suggestionsFetcher ?? null}
                setSelection={onSelectionChange}
                thisSelection={selection}
                partialSuggestionsFetcherContext={partialSuggestionsFetcherContext}
            />
            <ObjectPropsSelector
                partialSuggestionsFetcherContext={partialSuggestionsFetcherContext}
                suggestionsFetcher={suggestionsFetcher ?? null}
                thisSelection={selection}
                onValueChange={(newValue) => onSelectionChange({
                    ...selection,
                    objectProps: newValue,
                })}
                recursionDepth={recursionDepth}
                rdfType={selection.rdfType}
            />
        </div>
    );
}

export default function ComplexPropertySelector({
    defaultSelection,
    selection: controlledSelection,
    onSelectionChange,
    ...props
}: ComplexPropertySelectorProps) {
    // NOTE: We are wrapping this component with its own queryClient so that this component can be
    // used without explicitly requiring end users to use tanstack query.
    // NOTE: Client is provided in a separate component so that `useQuery` works as expected and
    // that recursive property selector invokations don't make new clients.
    const queryClient = new QueryClient();

    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ComplexPropertySelectorBase
                {...props}
                onSelectionChange={setSelection}
                partialSuggestionsFetcherContext={{
                    rootSelection: selection,
                    parentFetchTargets: [],
                }}
                recursionDepth={0}
            />
        </QueryClientProvider>
    );
}
