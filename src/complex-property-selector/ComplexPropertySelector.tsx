import { useState, type ReactNode } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { SingleStringCombobox } from "../components/property_selector";
import { Asterisk, ChevronDown, CircleQuestionMark } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { cn } from "@/lib/utils";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { DestroyItemButton, MultiItemAddButton, MultiItemRow, MultiItemSelectorBase, MultiItemSelectorList } from "../components/MultiItemList";
import { makeDefaultSelection, type ComplexPropertySelection, type ObjectPropSelection, type PropertySelection, type SuggestionAncestor, type SuggestionContextBase, type SuggestionsFetcher, type SuggestionsFetcherContext } from "./shared";

function replaceAt<T>(items: readonly T[], i: number, item: T): T[] {
    return [...items.slice(0, i), item, ...items.slice(i + 1)];
}

function removeAt<T>(items: readonly T[], i: number): T[] {
    return [...items.slice(0, i), ...items.slice(i + 1)];
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

/**
 * Editable list of values. The first value is always shown, extra values are alternatives that
 * form a union with it.
 */
function SuggestionValueList({
    values,
    onValuesChange,
    suggestionsFetcher,
    makeContext,
    placeholder,
    addLabel,
    primaryTrailing,
}: {
    values: string[],
    onValuesChange: (newValues: string[]) => void,
    suggestionsFetcher: SuggestionsFetcher | undefined,
    /** Creates the suggestion context for the value at `valueIndex`. */
    makeContext: (valueIndex: number) => SuggestionsFetcherContext,
    placeholder?: string,
    addLabel: string,
    /** Rendered next to the first value, e.g. to remove the whole item. */
    primaryTrailing?: ReactNode,
}) {
    return (
        <MultiItemSelectorList>
            {/* NOTE: Index keys are intentional. Values may not be unique. */}
            {values.map((value, i) => (
                <MultiItemRow key={i}>
                    {i > 0 && (
                        <span className="self-center w-8 shrink-0 text-sm font-medium text-gray-500 ml-4">
                            OR
                        </span>
                    )}
                    <SuggestionCombobox
                        value={value}
                        onValueChange={(newValue) => onValuesChange(replaceAt(values, i, newValue))}
                        suggestionsFetcher={suggestionsFetcher}
                        context={makeContext(i)}
                        placeholder={placeholder}
                    />
                    {i === 0 ? primaryTrailing : (
                        <DestroyItemButton onClick={() => onValuesChange(removeAt(values, i))} />
                    )}
                </MultiItemRow>
            ))}
            <MultiItemAddButton onClick={() => onValuesChange([...values, ""])}>
                {addLabel}
            </MultiItemAddButton>
        </MultiItemSelectorList>
    );
}

function UnionAliasInput({
    value,
    onValueChange,
}: {
    value: string | undefined,
    onValueChange: (newValue: string) => void,
}) {
    return (
        <Input
            aria-label="Union alias"
            placeholder="Union alias (optional)"
            value={value ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
        />
    );
}

function MandatoryToggle({
    mandatory,
    onMandatoryChange,
}: {
    mandatory: boolean,
    onMandatoryChange: (newMandatory: boolean) => void,
}) {
    return (
        <Button
            className="cursor-pointer"
            variant="outline"
            size="icon"
            aria-label={mandatory ? "Mandatory" : "Optional"}
            data-mandatory={mandatory}
            title={mandatory ? "Mandatory: click to make optional" : "Optional: click to make mandatory"}
            onClick={() => onMandatoryChange(!mandatory)}
        >
            {mandatory ? <Asterisk /> : <CircleQuestionMark />}
        </Button>
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
    const dataProps = selection.dataProps;

    function setDataProps(newDataProps: PropertySelection[]) {
        onSelectionChange({ ...selection, dataProps: newDataProps });
    }

    return (
        <div>
            <p>Properties (data)</p>
            <MultiItemSelectorBase>
                <MultiItemSelectorList>
                    {/* NOTE: Index keys are intentional. Item name may not be unique. */}
                    {dataProps.map((item, i) => (
                        <div
                            key={i}
                            className="flex flex-col gap-2"
                        >
                            <SuggestionValueList
                                values={item.names}
                                onValuesChange={(names) => setDataProps(
                                    replaceAt(dataProps, i, { ...item, names })
                                )}
                                suggestionsFetcher={suggestionsFetcher}
                                makeContext={(valueIndex) => ({
                                    ...contextBase,
                                    target: { kind: "dataProp", index: i, valueIndex },
                                })}
                                addLabel="Add alternative"
                                primaryTrailing={<>
                                    <MandatoryToggle
                                        mandatory={item.mandatory}
                                        onMandatoryChange={(mandatory) => setDataProps(
                                            replaceAt(dataProps, i, { ...item, mandatory })
                                        )}
                                    />
                                    <DestroyItemButton
                                        onClick={() => setDataProps(removeAt(dataProps, i))}
                                    />
                                </>}
                            />
                            {item.names.length > 1 && (
                                <UnionAliasInput
                                    value={item.alias}
                                    onValueChange={(alias) => setDataProps(
                                        replaceAt(dataProps, i, { ...item, alias })
                                    )}
                                />
                            )}
                        </div>
                    ))}
                </MultiItemSelectorList>
                <MultiItemAddButton onClick={() => setDataProps([
                    ...dataProps,
                    { names: [""], mandatory: false },
                ])}>
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

    function setObjectProps(newObjectProps: ObjectPropSelection[]) {
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
                            <SuggestionValueList
                                values={item.names}
                                onValuesChange={(names) => setObjectProps(
                                    replaceAt(objectProps, i, { ...item, names })
                                )}
                                suggestionsFetcher={suggestionsFetcher}
                                makeContext={(valueIndex) => ({
                                    ...contextBase,
                                    target: { kind: "objectProp", index: i, valueIndex },
                                })}
                                addLabel="Add alternative"
                                primaryTrailing={<>
                                    <MandatoryToggle
                                        mandatory={item.mandatory}
                                        onMandatoryChange={(mandatory) => setObjectProps(
                                            replaceAt(objectProps, i, { ...item, mandatory })
                                        )}
                                    />
                                    <DestroyItemButton
                                        onClick={() => setObjectProps(removeAt(objectProps, i))}
                                    />
                                    <CollapsibleTrigger className="cursor-pointer">
                                        <ChevronDown
                                            className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                                        />
                                    </CollapsibleTrigger>
                                </>}
                            />
                            {item.names.length > 1 && (
                                <UnionAliasInput
                                    value={item.alias}
                                    onValueChange={(alias) => setObjectProps(
                                        replaceAt(objectProps, i, { ...item, alias })
                                    )}
                                />
                            )}
                            <CollapsibleContent className={cn(
                                "text-gray-700 ml-4 p-2",
                                (recursionDepth % 2 === 0) ? "bg-gray-100" : "bg-white",
                            )}>
                                <ComplexPropertySelectorBase
                                    selection={item.selection}
                                    onSelectionChange={(newSelection) => setObjectProps(
                                        replaceAt(objectProps, i, { ...item, selection: newSelection })
                                    )}
                                    rootSelection={contextBase.rootSelection}
                                    ancestors={[
                                        ...contextBase.ancestors,
                                        {
                                            names: item.names,
                                            alias: item.alias,
                                            mandatory: item.mandatory,
                                            index: i,
                                            selection: item.selection,
                                        },
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
                    { names: [""], mandatory: false, selection: makeDefaultSelection() },
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
                <SuggestionValueList
                    values={selection.rdfType.names}
                    onValuesChange={(names) => onSelectionChange({ ...selection, rdfType: { names } })}
                    suggestionsFetcher={suggestionsFetcher}
                    makeContext={(valueIndex) => ({
                        ...contextBase,
                        target: { kind: "rdfType", valueIndex },
                    })}
                    placeholder="Enter type"
                    addLabel="Add alternative type"
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
