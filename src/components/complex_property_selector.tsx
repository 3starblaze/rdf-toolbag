import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { PropertySelector } from "./property_selector";
import { Combobox } from "./ui/combobox";
import { Button } from "./ui/button";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "@/lib/utils";

interface SuggestionMap {
    [rdfType: string]: {
        dataProps: string[],
        objectProps: string[],
    }
}

// FIXME: A lot of duplication with PropertySelector
function ComplexPropertySelectorFragment({
    value: controlledValue,
    defaultValue,
    onValueChange,
    suggestions,
    addButtonContent = "+",
    /**
     * @see ComplexPropertySelector
     */
    recursionDepth = 0,
}: {
    suggestions: { label: string, value: string }[],
    addButtonContent: string,
    value?: string[],
    defaultValue?: string[],
    onValueChange?: (newValue: string[]) => void,
    recursionDepth?: number,
}) {
    const [selectedProperties, setSelectedProperties] = useControllableState<string[]>({
        prop: controlledValue,
        defaultProp: defaultValue ?? [],
        onChange: onValueChange,
    });

    // NOTE: Since properties are meant to be unique, there's no point in suggesting properties
    // that are already selected.
    const filteredSuggestions = suggestions
        .filter(({ value }) => !selectedProperties.includes(value));

    return (
        <div className="max-w-prose flex flex-col gap-2">
            <div className="flex flex-col gap-1">
                {selectedProperties.map((item, i) => (
                    <Collapsible className="flex flex-col group gap-2">
                        <div
                            key={i}
                            className="flex gap-2"
                        >
                            <Combobox
                                className="grow"
                                options={filteredSuggestions}
                                unselectedLabel={(<span />)}
                                emptyLabel="..."
                                searchPlaceholder="..."
                                value={item}
                                onValueChange={(val) => setSelectedProperties([
                                    ...selectedProperties.slice(0, i),
                                    val,
                                    ...selectedProperties.slice(i + 1),
                                ])}
                                allowCustomValues
                            />
                            <Button
                                className="cursor-pointer"
                                variant="destructive"
                                onClick={() => setSelectedProperties([
                                    ...selectedProperties.slice(0, i),
                                    ...selectedProperties.slice(i + 1),
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
                                suggestionMap={{}}
                                recursionDepth={recursionDepth + 1}
                            />
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
            <Button
                className="cursor-pointer"
                variant="outline"
                onClick={() => setSelectedProperties((old) => [...old, ""])}
            >
                {addButtonContent}
            </Button>
        </div >
    );
}

export default function ComplexPropertySelector({
    recursionDepth = 0,
}: {
    suggestionMap: SuggestionMap,
    /**
     * Recursion index that is used to apply style properly.
     */
    recursionDepth?: number,
}) {
    return (
        <div className="flex flex-col gap-4">
            <div>
                <p>Type</p>
                <Combobox
                    emptyLabel=""
                    options={[]}
                    searchPlaceholder=""
                    unselectedLabel=""
                    allowCustomValues
                />
            </div>
            <div>
                <p>Properties (data)</p>
                <PropertySelector
                    suggestions={[]}
                    addButtonContent="Add data property"
                />
            </div>
            <div>
                <p>Properties (class)</p>
                <ComplexPropertySelectorFragment
                    suggestions={[]}
                    recursionDepth={recursionDepth}
                    addButtonContent="Add object property"
                />
            </div>
        </div>
    );
}
