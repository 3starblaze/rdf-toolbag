import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { SingleStringCombobox, PropertySelector } from "./property_selector";
import { Button } from "./ui/button";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";

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

export type PropFetcher = (rdfType: string | null) => Promise<{ value: string, label: string }[]>;

export function makeDefaultSelection(): ComplexPropertySelection {
    return { rdfType: "", dataProps: [], objectProps: [] };
}

// FIXME: A lot of duplication with PropertySelector
function ComplexPropertySelectorFragment({
    value: controlledValue,
    defaultValue,
    onValueChange,
    dataPropFetcher,
    objectPropFetcher,
    rdfTypeFetcher,
    rdfType,
    addButtonContent = "+",
    /**
     * @see ComplexPropertySelector
     */
    recursionDepth = 0,
}: {
    value?: ComplexPropertySelection["objectProps"],
    onValueChange?: (newValue: ComplexPropertySelection["objectProps"]) => void,
    dataPropFetcher?: PropFetcher,
    objectPropFetcher?: PropFetcher,
    rdfTypeFetcher?: () => Promise<{ value: string, label: string }[]>,
    rdfType: string,
    defaultValue?: ComplexPropertySelection["objectProps"],
    addButtonContent: string,
    recursionDepth?: number,
}) {
    const [value, setValue] = useControllableState<ComplexPropertySelection["objectProps"]>({
        prop: controlledValue,
        defaultProp: defaultValue || [],
        onChange: onValueChange,
    });

    const nulledRdfType = (rdfType === "") ? null : rdfType;

    const objPropQuery = useQuery({
        queryKey: ["ComplexPropertySelector", "objectProp", nulledRdfType],
        queryFn: objectPropFetcher
            ? (() => objectPropFetcher(nulledRdfType))
            : skipToken,
    });

    return (
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
                            <SingleStringCombobox
                                suggestionsQueryResult={objPropQuery}
                                value={item.name}
                                onValueChange={(newItemName) => setValue([
                                    ...value.slice(0, i),
                                    { ...value[i], name: newItemName },
                                    ...value.slice(i + 1),
                                ])}
                            />
                            <Button
                                className="cursor-pointer"
                                variant="destructive"
                                onClick={() => setValue([
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
                                onSelectionChange={(newSelection) => setValue([
                                    ...value.slice(0, i),
                                    { ...value[i], selection: newSelection },
                                    ...value.slice(i + 1),
                                ])}
                                dataPropFetcher={dataPropFetcher}
                                objectPropFetcher={objectPropFetcher}
                                rdfTypeFetcher={rdfTypeFetcher}
                                recursionDepth={recursionDepth + 1}
                            />
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
            <Button
                className="cursor-pointer"
                variant="outline"
                onClick={() => {
                    setValue([
                        ...value,
                        { name: "", selection: makeDefaultSelection() },
                    ])
                }}
            >
                {addButtonContent}
            </Button>
        </div >
    );
}

export interface ComplexPropertySelectorProps {
    selection?: ComplexPropertySelection,
    onSelectionChange?: (selection: ComplexPropertySelection) => void,
    defaultSelection?: ComplexPropertySelection,
    dataPropFetcher?: PropFetcher,
    objectPropFetcher?: PropFetcher,
    rdfTypeFetcher?: () => Promise<{ value: string, label: string }[]>,
    prefixMap?: { [prefix: string]: string },
    /**
     * Recursion index that is used to apply style properly.
     */
    recursionDepth?: number,
}

function ComplexPropertySelectorBase({
    selection: controlledSelection,
    onSelectionChange,
    rdfTypeFetcher,
    defaultSelection,
    dataPropFetcher,
    objectPropFetcher,
    recursionDepth = 0,
}: ComplexPropertySelectorProps) {
    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    const rdfTypeQuery = useQuery({
        queryKey: ["RdfTypeQuery"],
        queryFn: rdfTypeFetcher ?? skipToken,
    })

    const nulledRdfType = (selection.rdfType === "") ? null : selection.rdfType;

    const dataPropQuery = useQuery({
        queryKey: ["ComplexPropertySelector", "dataProp", nulledRdfType],
        queryFn: dataPropFetcher
               ? (() => dataPropFetcher(nulledRdfType))
               : skipToken,
    });

    return (
        <div className="flex flex-col gap-4">
            <div>
                <p>Type</p>
                <SingleStringCombobox
                    key={selection.rdfType}
                    suggestionsQueryResult={rdfTypeQuery}
                    value={selection.rdfType}
                    onValueChange={(newRdfType) => setSelection({
                        ...selection,
                        rdfType: newRdfType ?? "",
                    })}
                    placeholder="Enter type"
                />
            </div>
            <div>
                <p>Properties (data)</p>
                <PropertySelector
                    value={selection.dataProps.map(({ name }) => name)}
                    onValueChange={(newDataProps) => setSelection({
                        ...selection,
                        dataProps: newDataProps.map((name) => ({ name })),
                    })}
                    suggestionsQueryResult={dataPropQuery}
                    addButtonContent="Add data property"
                />
            </div>
            <div>
                <p>Properties (object)</p>
                <ComplexPropertySelectorFragment
                    value={selection.objectProps}
                    onValueChange={(newValue) => setSelection({
                        ...selection,
                        objectProps: newValue,
                    })}
                    recursionDepth={recursionDepth}
                    addButtonContent="Add object property"
                    dataPropFetcher={dataPropFetcher}
                    objectPropFetcher={objectPropFetcher}
                    rdfTypeFetcher={rdfTypeFetcher}
                    rdfType={selection.rdfType}
                />
            </div>
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
