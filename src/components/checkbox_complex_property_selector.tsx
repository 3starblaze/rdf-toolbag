import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { SingleStringCombobox } from "./property_selector";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import {
    makeDefaultSelection,
    type ComplexPropertySelection,
    type ComplexPropertySelectorProps,
    type PropFetcher,
} from "./complex_property_selector";
import { createContext, useContext, useId, useState } from "react";
import { Checkbox } from "./ui/checkbox";
import { Field, FieldLabel } from "./ui/field";

/**
 * Complex property selector that use checkboxes instead.
 *
 * Current implementation is poor:
 * - slow performance (checkbox selection latency is noticeable)
 * - no loading marker
 * - very annoying collapsible state changes during rerender
 */

interface Entry {
    label: string,
    value: string,
}

function StatefulCheckboxItem({
    entry,
    value: controlledValue,
    defaultValue,
    onValueChange,
}: {
    entry: Entry,
    value?: boolean,
    defaultValue?: boolean,
    onValueChange?: (newValue: boolean) => void,
}) {
    const { label } = entry;
    const id = useId();

    const [value, setValue] = useControllableState<boolean>({
        prop: controlledValue,
        defaultProp: defaultValue || false,
        onChange: onValueChange,
    });

    return (
        <Field orientation="horizontal" data-invalid>
            <Checkbox
                id={id}
                checked={value}
                onCheckedChange={(item) => setValue(item === true)}
            />
            <FieldLabel htmlFor={id}>
                {label}
            </FieldLabel>
        </Field>
    );
}

function StatefulCheckboxList({
    entries,
    value,
    onValueChange,
}: {
    entries: Entry[],
    value: boolean[],
    onValueChange: (newValue: boolean[]) => void,
}) {
    return (
        <div>
            {entries.map((entry, i) => {
                return (
                    <StatefulCheckboxItem
                        key={entry.value}
                        entry={entry}
                        value={value[i]}
                        onValueChange={(newValue) => onValueChange([
                            ...value.slice(0, i),
                            newValue,
                            ...value.slice(i+1),
                        ])}
                    />
                )
            })}
        </div>
    );
}

function DataPropCheckboxList({
    entries,
    dataProps,
    onDataPropsChange,
}: {
    entries: Entry[],
    dataProps: ComplexPropertySelection["dataProps"],
    onDataPropsChange: (newVal: ComplexPropertySelection["dataProps"]) => void,
}) {
    const selectedValues = new Set(dataProps.map(({ name }) => name));
    const checked = entries.map(({ value }) => selectedValues.has(value));

    type DataProp = (typeof dataProps)[number];

    function setChecked(newChecked: boolean[]) {
        const newSelectedValues: DataProp[] = newChecked.flatMap(
            (newValue, i) => newValue ? { name: entries[i].value } : [],
        );

        onDataPropsChange(newSelectedValues);
    }

    return (
        <StatefulCheckboxList
            entries={entries}
            value={checked}
            onValueChange={setChecked}
        />
    );
}

function ObjectPropCheckboxList({
    entries,
    objectProps,
    onObjectPropsChange,
}: {
    entries: Entry[],
    objectProps: ComplexPropertySelection["objectProps"],
    onObjectPropsChange: (newVal: ComplexPropertySelection["objectProps"]) => void,
}) {
    const { recursionDepth } = useContext(RecursionContext);

    const selectedValues = new Set(objectProps.map(({ name }) => name));
    const checked = entries.map(({ value }) => selectedValues.has(value));

    type ObjectProp = (typeof objectProps)[number];

    function setChecked(newChecked: boolean[]) {
        const newSelectedValues: ObjectProp[] = newChecked.flatMap(
            (newValue, i) => newValue ? {
                name: entries[i].value,
                selection: makeDefaultSelection(),
            }: [],
        );

        onObjectPropsChange(newSelectedValues);
    }

    function RenderEntry({
        entry,
        i,
    }: {
        entry: Entry,
        i: number,
    }) {
        const id = useId();

        const { label, value } = entry;

        const itemChecked = checked[i];
        const propIndex = itemChecked ? objectProps.findIndex((item) => item.name === value) : -1;
        const prop = (propIndex === -1)
                        ? undefined
                        : objectProps[propIndex];

        const [collapsibleOpen, setCollapsibleOpen] = useState(false);

        const canCollapse = !!prop;

        return (
            <Collapsible
                open={collapsibleOpen}
                onOpenChange={setCollapsibleOpen}
                className="group"
            >
                <div className="flex flex-col">
                    <Field orientation="horizontal" data-invalid>
                        <Checkbox
                            id={id}
                            checked={itemChecked}
                            onCheckedChange={(item) => setChecked([
                                ...checked.slice(0, i),
                                item === true,
                                ...checked.slice(i + 1),
                            ])}
                        />
                        <CollapsibleTrigger
                            className={cn(
                                "cursor-pointer",
                                !canCollapse && "hidden",
                            )}
                        >
                            <ChevronDown
                                className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                            />
                        </CollapsibleTrigger>
                        <FieldLabel htmlFor={id}>
                            {label}
                        </FieldLabel>
                    </Field>
                    <CollapsibleContent className={cn(
                        "text-gray-700 ml-4 p-2",
                        (recursionDepth % 2 === 0) ? "bg-gray-100" : "bg-white",
                    )}>
                        {prop && (
                            <RecursionContext value={{
                                recursionDepth: recursionDepth + 1,
                            }}>
                                <ComplexPropertySelectorBase
                                    selection={prop.selection}
                                    onSelectionChange={(newSelection) => onObjectPropsChange([
                                        ...objectProps.slice(0, propIndex),
                                        {
                                            ...prop,
                                            selection: newSelection,
                                        },
                                        ...objectProps.slice(propIndex + 1),
                                    ])}
                                />
                            </RecursionContext>
                        )}
                    </CollapsibleContent>
                </div>
            </Collapsible>
        );
    };

    return (
        <div>
            {entries.map((entry, i) => (
                <RenderEntry key={entry.value} {...{ entry, i }} />
            ))}
        </div>
    );
}

type BaseProps = Omit<
    ComplexPropertySelectorProps,
    "dataPropFetcher" | "objectPropFetcher" | "rdfTypeFetcher"
>;

function ComplexPropertySelectorBase({
    selection: controlledSelection,
    onSelectionChange,
    defaultSelection,
}: BaseProps) {
    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    const rdfType = selection.rdfType;
    const rdfTypeQuery = useRdfTypeQuery();
    const dataPropQuery = useDataPropQuery(rdfType);
    const objPropQuery = useObjPropQuery(rdfType);

    return (
        <div className="flex flex-col gap-4 max-w-fit">
            <div>
                <p>Type</p>
                <SingleStringCombobox
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
                <div className="max-h-40 overflow-scroll">
                    {dataPropQuery.data && (
                        <DataPropCheckboxList
                            entries={dataPropQuery.data}
                            dataProps={selection.dataProps}
                            onDataPropsChange={(newValue) => {
                                setSelection({
                                    ...selection,
                                    dataProps: newValue,
                                });
                            }}
                        />
                    )}
                </div>
            </div>
            <div>
                <p>Properties (class)</p>
                <div className="max-h-40 overflow-scroll">
                    {objPropQuery.data && (
                        <ObjectPropCheckboxList
                            entries={objPropQuery.data}
                            objectProps={selection.objectProps}
                            onObjectPropsChange={(newValue) => {
                                setSelection({
                                    ...selection,
                                    objectProps: newValue,
                                });
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

interface FetcherData {
    dataPropFetcher?: PropFetcher,
    objectPropFetcher?: PropFetcher,
    rdfTypeFetcher?: () => Promise<{ value: string, label: string }[]>,
}

const FetcherContext = createContext<FetcherData>({});

function useRdfTypeQuery() {
    const { rdfTypeFetcher } = useContext(FetcherContext);

    return useQuery({
        queryKey: ["RdfTypeQuery"],
        queryFn: rdfTypeFetcher ?? skipToken,
    });
}

function useDataPropQuery(rdfType: string) {
    const { dataPropFetcher } = useContext(FetcherContext);
    const nulledRdfType = (rdfType === "") ? null : rdfType;

    return useQuery({
        queryKey: ["ComplexPropertySelector", "dataProp", nulledRdfType],
        queryFn: dataPropFetcher
            ? (() => dataPropFetcher(nulledRdfType))
            : skipToken,
    });
}

function useObjPropQuery(rdfType: string) {
    const { objectPropFetcher } = useContext(FetcherContext);
    const nulledRdfType = (rdfType === "") ? null : rdfType;

    return useQuery({
        queryKey: ["ComplexPropertySelector", "objectProp", nulledRdfType],
        queryFn: objectPropFetcher
            ? (() => objectPropFetcher(nulledRdfType))
            : skipToken,
    });
}

interface RecursionData {
    recursionDepth: number,
}

const RecursionContext = createContext<RecursionData>({ recursionDepth: 0 });

export default function CheckboxComplexPropertySelector(
    {
        dataPropFetcher,
        objectPropFetcher,
        rdfTypeFetcher,
        ...restProps
    }: ComplexPropertySelectorProps
) {
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <FetcherContext value={{
                dataPropFetcher,
                objectPropFetcher,
                rdfTypeFetcher,
            }}>
                <RecursionContext value={{ recursionDepth: 0 }}>
                    <ComplexPropertySelectorBase {...restProps} />
                </RecursionContext>
            </FetcherContext>
        </QueryClientProvider>
    );
}
