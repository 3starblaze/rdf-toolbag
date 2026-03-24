import { Button } from "./ui/button";
import { Combobox } from "./ui/combobox";
import {
    useControllableState
} from "@radix-ui/react-use-controllable-state";

/**
 * String array input which is ideal for collecting properties.
 */
export function PropertySelector({
    value: controlledValue,
    defaultValue,
    onValueChange,
    suggestions,
    addButtonContent = "+",
}: {
    suggestions: { label: string, value: string }[],
    value?: string[],
    defaultValue?: string[],
    onValueChange?: (newValue: string[]) => void,
    addButtonContent: string,
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
                    </div>
                ))}
            </div>
            <Button
                className="cursor-pointer"
                variant="outline"
                onClick={() => setSelectedProperties((old) => [...old, ""])}
            >
                {addButtonContent}
            </Button>
        </div>
    );
}
