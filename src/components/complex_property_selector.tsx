import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { SingleStringCombobox, PropertySelector } from "./property_selector";
import { Button } from "./ui/button";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider, skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";

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

interface PropFetchTarget {
    targetItem: "dataProp" | "objectProp",
    propIndex: number,
}

interface RdfTypeFetchTarget {
    targetItem: "rdfType",
}

type FetchTarget = PropFetchTarget | RdfTypeFetchTarget;

interface BaseFetcherContext {
    thisSelection: ComplexPropertySelection,
    fetchTarget: FetchTarget,
    /** Parent information that's provided if `thisSelection` is not root selection. */
    parentContext: BaseFetcherContext | null,
}

export type SuggestionsFetcher = (ctx: BaseFetcherContext) => Promise<{
    value: string,
    label: string
}[]>;

export function makeDefaultSelection(): ComplexPropertySelection {
    return { rdfType: "", dataProps: [], objectProps: [] };
}

function useSuggestionsQuery(
    fetchFn: SuggestionsFetcher | null,
    context: BaseFetcherContext,
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
    propIndex,
    thisSelection,
    setName,
    targetItem,
    parentContext,
}: {
    suggestionsFetcher: SuggestionsFetcher | null,
    propIndex: number,
    thisSelection: ComplexPropertySelection,
    setName: (newName: string) => void,
    targetItem: "objectProp" | "dataProp",
    parentContext?: BaseFetcherContext,
}) {
    const suggestionsQueryResult = useSuggestionsQuery(suggestionsFetcher, {
        fetchTarget: { targetItem, propIndex },
        parentContext: parentContext ?? null,
        thisSelection,
    });

    let value: string;

    switch (targetItem) {
        case "dataProp":
            value = thisSelection.dataProps[propIndex].name
            break;
        case "objectProp":
            value = thisSelection.objectProps[propIndex].name;
            break;
    }

    return (
        <SingleStringCombobox
            suggestionsQueryResult={suggestionsQueryResult}
            value={value}
            onValueChange={setName}
        />
    );
}

// FIXME: A lot of duplication with PropertySelector
function ObjectPropsSelector({
    thisSelection,
    suggestionsFetcher,
    onValueChange,
    addButtonContent = "+",
    parentContext,
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
    addButtonContent: string,
    recursionDepth?: number,
    parentContext?: BaseFetcherContext,
}) {
    const value = thisSelection.objectProps;

    const selector = (
        <div className="max-w-prose flex flex-col gap-2">
            <div className="flex flex-col gap-1">
                {value.map((item, i) => (
                    <Collapsible
                        key={item.name}
                        className="flex flex-col group gap-2"
                    >
                        <div
                            key={item.name}
                            className="flex gap-2"
                        >
                            <PropCombobox
                                targetItem="objectProp"
                                suggestionsFetcher={suggestionsFetcher}
                                propIndex={i}
                                thisSelection={thisSelection}
                                setName={(newName) => onValueChange([
                                    ...value.slice(0, i - 1),
                                    { ...item, name: newName },
                                    ...value.slice(i)
                                ])}
                            />
                            <Button
                                className="cursor-pointer"
                                variant="destructive"
                                onClick={() => onValueChange([
                                    ...value.slice(0, i),
                                    ...value.slice(i + 1),
                                ])}
                            >
                                -
                            </Button>
                            <CollapsibleTrigger className="cursor-pointer">
                                <ChevronDown
                                    className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                                />
                            </CollapsibleTrigger>
                        </div>
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
                                // FIXME: populate parentContext
                                parentContext={parentContext}
                            />
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
            <Button
                className="cursor-pointer"
                variant="outline"
                onClick={() => {
                    onValueChange([
                        ...value,
                        { name: "", selection: makeDefaultSelection() },
                    ])
                }}
            >
                {addButtonContent}
            </Button>
        </div >
    );

    return (
        <div>
            <p>Properties (object)</p>
            {selector}
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
    /** See BaseFetcherContext */
    parentContext?: BaseFetcherContext,
    /**
     * Recursion index that is used to apply style properly.
     */
    recursionDepth?: number,
}

function RdfTypeSelector({
    thisSelection,
    onValueChange,
    parentContext,
    suggestionsFetcher,
}: {
    thisSelection: ComplexPropertySelection,
    onValueChange: (val: string) => void,
    suggestionsFetcher: SuggestionsFetcher | null,
    parentContext: BaseFetcherContext | null,
}) {
    const rdfTypeQuery = useSuggestionsQuery(suggestionsFetcher, {
        thisSelection,
        fetchTarget: { targetItem: "rdfType" },
        parentContext,
    });

    return (
        <div>
            <p>Type</p>
            <SingleStringCombobox
                suggestionsQueryResult={rdfTypeQuery}
                value={thisSelection.rdfType}
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
} : {
    thisSelection: ComplexPropertySelection,
    suggestionsFetcher: SuggestionsFetcher | null,
    setSelection: (newValue: ComplexPropertySelection) => void,
}) {
    const suggestionsQueryResult = useSuggestionsQuery(suggestionsFetcher, {
        // FIXME: Use correct index and isolate per property
        fetchTarget: { targetItem: "dataProp", propIndex: 0 },
        thisSelection,
        // FIXME: Use context
        parentContext: null,
    });

    return (
        <div>
            <p>Properties (data)</p>
            <PropertySelector
                value={thisSelection.dataProps.map(({ name }) => name)}
                onValueChange={(newDataProps) => setSelection({
                    ...thisSelection,
                    dataProps: newDataProps.map((name) => ({ name })),
                })}
                suggestionsQueryResult={suggestionsQueryResult}
                addButtonContent="Add data property"
            />
        </div>
    );
}

function ComplexPropertySelectorBase({
    selection: controlledSelection,
    onSelectionChange,
    defaultSelection,
    suggestionsFetcher,
    parentContext,
    recursionDepth = 0,
}: ComplexPropertySelectorProps) {
    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    return (
        <div className="flex flex-col gap-4">
            <RdfTypeSelector
                thisSelection={selection}
                parentContext={parentContext ?? null}
                onValueChange={(rdfType) => setSelection({
                    ...selection,
                    rdfType,
                })}
                suggestionsFetcher={suggestionsFetcher ?? null}
            />
            <DataPropsSelector
                suggestionsFetcher={suggestionsFetcher ?? null}
                setSelection={setSelection}
                thisSelection={selection}
            />
            <ObjectPropsSelector
                suggestionsFetcher={suggestionsFetcher ?? null}
                thisSelection={selection}
                onValueChange={(newValue) => setSelection({
                    ...selection,
                    objectProps: newValue,
                })}
                recursionDepth={recursionDepth}
                addButtonContent="Add object property"
                rdfType={selection.rdfType}
            />
        </div>
    );
}


export default function ComplexPropertySelector(
    props: ComplexPropertySelectorProps,
) {
    // NOTE: We are wrapping this component with its own queryClient so that this component can be
    // used without explicitly requiring end users to use tanstack query.
    // NOTE: Client is provided in a separate component so that `useQuery` works as expected and
    // that recursive property selector invokations don't make new clients.
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <ComplexPropertySelectorBase {...props} />
        </QueryClientProvider>
    );
}
