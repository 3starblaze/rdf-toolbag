import { useState } from "react";
import { Button } from "./ui/button";
import { Combobox, ComboboxContent, ComboboxList, ComboboxItem, ComboboxInput, ComboboxEmpty } from "./ui/combobox";
import {
    useControllableState
} from "@radix-ui/react-use-controllable-state";

export function SingleStringCombobox({
    value,
    onValueChange,
    suggestions,
    placeholder,
}: {
    value: string,
    onValueChange: (newValue: string) => void,
    suggestions: { label: string, value: string }[],
    placeholder?: string,
}) {
    const valueToLabel = (targetValue: string) => suggestions
        .find((item) => item.value === targetValue)?.label ?? targetValue;

    // NOTE: It's important to set the initial value correctly because it could hold stale data.
    const [inputValue, setInputValue] = useState(valueToLabel(value));
    const shouldSuggestCustom = inputValue && !suggestions.find((item) => item.value === inputValue);

    return (
        <Combobox
            inputValue={inputValue}
            onInputValueChange={setInputValue}
            value={value}
            onValueChange={(newValue) => onValueChange(newValue || "")}
            items={[
                ...(shouldSuggestCustom ? [{
                    label: inputValue,
                    value: inputValue,
                    isCustom: true,
                }] : []),
                ...suggestions,
            ]}
            itemToStringLabel={valueToLabel}
        >
            <ComboboxInput
                className="grow"
                placeholder={placeholder}
            >
            </ComboboxInput>
            <ComboboxContent>
                <ComboboxEmpty>
                    Nothing found
                </ComboboxEmpty>
                <ComboboxList>
                    {(item, i) => (
                        <ComboboxItem key={`${i}-${item}`} value={item.value}>
                            {item.isCustom ? (
                                `Use "${item.label}"`
                            ) : item.label}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

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

    return (
        <div className="max-w-prose flex flex-col gap-2">
            <div className="flex flex-col gap-1">
                {selectedProperties.map((item, i) => (
                    <div
                        key={`${i}-${item}`}
                        className="flex gap-2"
                    >
                        <SingleStringCombobox
                            value={item}
                            onValueChange={(val) => setSelectedProperties([
                                ...selectedProperties.slice(0, i),
                                val,
                                ...selectedProperties.slice(i + 1),
                            ])}
                            suggestions={suggestions}
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
