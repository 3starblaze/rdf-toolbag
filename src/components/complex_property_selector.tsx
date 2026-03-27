import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { PropertySelector } from "./property_selector";
import { Combobox } from "./ui/combobox";
import { Button } from "./ui/button";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { skipToken, useQuery } from "@tanstack/react-query";

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

// FIXME: A lot of duplication with PropertySelector
function ComplexPropertySelectorFragment({
    value: controlledValue,
    defaultValue,
    onValueChange,
    dataPropFetcher,
    objectPropFetcher,
    rdfType,
    addButtonContent = "+",
    /**
     * @see ComplexPropertySelector
     */
    recursionDepth = 0,
}: {
    value?: ComplexPropertySelection["objectProps"],
    onValueChange?: (newValue: ComplexPropertySelection["objectProps"]) => void,
    dataPropFetcher?: (rdfType: string) => Promise<{ value: string, label: string }[]>,
    objectPropFetcher?: (rdfType: string) => Promise<{ value: string, label: string }[]>,
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

    const objPropQuery = useQuery({
        queryKey: ["ComplexPropertySelector", "objectProp", rdfType],
        queryFn: (rdfType && objectPropFetcher)
            ? (() => objectPropFetcher(rdfType))
            : skipToken,
    });

    const suggestions = objPropQuery.data ?? [];

    return (
        <div className="max-w-prose flex flex-col gap-2">
            <div className="flex flex-col gap-1">
                {value.map((item, i) => (
                    <Collapsible className="flex flex-col group gap-2">
                        <div
                            key={i}
                            className="flex gap-2"
                        >
                            <Combobox
                                className="grow"
                                options={suggestions}
                                unselectedLabel={(<span />)}
                                emptyLabel="..."
                                searchPlaceholder="..."
                                value={item.name}
                                onValueChange={(newItemName) => setValue([
                                    ...value.slice(0, i),
                                    { ...value[i], name: newItemName },
                                    ...value.slice(i + 1),
                                ])}
                                allowCustomValues
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
                            <CollapsibleTrigger>
                                <Button className="cursor-pointer">
                                    <ChevronDown
                                        className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                                    />
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className={cn(
                            "text-gray-700 ml-4 p-2",
                            (recursionDepth % 2 === 0) ? "bg-gray-100" : "bg-white",
                        )}>
                            <ComplexPropertySelector
                                selection={value[i].selection}
                                onSelectionChange={(newSelection) => setValue([
                                    ...value.slice(0, i),
                                    { ...value[i], selection: newSelection },
                                    ...value.slice(i + 1),
                                ])}
                                dataPropFetcher={dataPropFetcher}
                                objectPropFetcher={objectPropFetcher}
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

export default function ComplexPropertySelector({
    selection: controlledSelection,
    onSelectionChange,
    defaultSelection,
    dataPropFetcher,
    objectPropFetcher,
    recursionDepth = 0,
}: {
    selection?: ComplexPropertySelection,
    onSelectionChange?: (selection: ComplexPropertySelection) => void,
    defaultSelection?: ComplexPropertySelection,
    dataPropFetcher?: (rdfType: string) => Promise<{ value: string, label: string }[]>,
    objectPropFetcher?: (rdfType: string) => Promise<{ value: string, label: string }[]>,
    rdfTypeFetcher?: () => Promise<{ value: string, label: string }[]>,
    prefixMap?: { [prefix: string]: string },
    /**
     * Recursion index that is used to apply style properly.
     */
    recursionDepth?: number,
}) {
    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    const dataPropQuery = useQuery({
        queryKey: ["ComplexPropertySelector", "dataProp", selection.rdfType],
        queryFn: (selection.rdfType && dataPropFetcher)
               ? (() => dataPropFetcher(selection.rdfType))
               : skipToken,
    });

    const dataPropSuggestions = dataPropQuery.data ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div>
                <p>Type</p>
                <Combobox
                    emptyLabel=""
                    value={selection.rdfType}
                    onValueChange={(newRdfType) => setSelection({
                        ...selection,
                        rdfType: newRdfType,
                    })}
                    options={[]}
                    searchPlaceholder=""
                    unselectedLabel=""
                    allowCustomValues
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
                    suggestions={dataPropSuggestions}
                    addButtonContent="Add data property"
                />
            </div>
            <div>
                <p>Properties (class)</p>
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
                    rdfType={selection.rdfType}
                />
            </div>
        </div>
    );
}
