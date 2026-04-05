import { useState } from "react";
import { Button } from "./ui/button";
import { Combobox, ComboboxContent, ComboboxList, ComboboxItem, ComboboxInput, ComboboxEmpty, ComboboxStatus } from "./ui/combobox";
import {
    useControllableState
} from "@radix-ui/react-use-controllable-state";
import { type UseQueryResult } from "@tanstack/react-query";
import { Spinner } from "./ui/spinner";

export function SingleStringCombobox({
    value,
    onValueChange,
    suggestionsQueryResult,
    placeholder,
    hiddenValueList,
}: {
    value: string,
    onValueChange: (newValue: string) => void,
    suggestionsQueryResult: UseQueryResult<{ label: string, value: string }[], Error>,
    /** Which values should not be displayed in suggestions. */
    hiddenValueList?: string[],
    placeholder?: string,
}) {
    const suggestions = suggestionsQueryResult.data?.filter(
        ({ value }) => !hiddenValueList || !hiddenValueList.includes(value)
    );
    const isSuggestionsLoading = suggestionsQueryResult.isLoading;

    const valueToLabel = (targetValue: string) => suggestions
        ?.find((item) => item.value === targetValue)?.label ?? targetValue;

    // NOTE: It's important to set the initial value correctly because it could hold stale data.
    const [inputValue, setInputValue] = useState(valueToLabel(value));
    const shouldSuggestCustom = inputValue && (
        !suggestions || !suggestions.find((item) => item.value === inputValue)
    );

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
                ...suggestions ?? [],
            ]}
            itemToStringLabel={valueToLabel}
        >
            <ComboboxInput
                className="grow"
                placeholder={placeholder}
            >
            </ComboboxInput>
            <ComboboxContent>
                <ComboboxStatus>
                    {isSuggestionsLoading && (
                        <div className="flex gap-2 p-2 items-center text-gray-500">
                            <Spinner />
                            Loading
                        </div>
                    )}
                </ComboboxStatus>
                <ComboboxEmpty>
                    {!suggestionsQueryResult.isPending && "Nothing found"}
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
    suggestionsQueryResult,
    value: controlledValue,
    defaultValue,
    onValueChange,
    addButtonContent = "+",
}: {
    suggestionsQueryResult: UseQueryResult<{ label: string, value: string }[], Error>,
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

    const suggestions = suggestionsQueryResult.data;

    const unselectedSuggestions = suggestions
        ?.filter((item) => !selectedProperties.includes(item.value)) ?? [];

    // NOTE: This is used to add the current value to suggestions. If we just pass
    // `unselectedSuggestions`, we lose the currently selected item's label which is undesirable.
    // NOTE: this is wrapped as array so that we can easily spread the result.
    const valueToSuggestion = (targetValue: string) => {
        const maybeRes = suggestions?.find((suggestion) => suggestion.value === targetValue);
        return maybeRes ? [maybeRes] : [];
    };

    const repackageQueryResult = (item: string) => {
        const { data, ...rest } = suggestionsQueryResult;
        return {
            ...rest,
            data: data
                ? [...valueToSuggestion(item), ...unselectedSuggestions]
                : undefined,
        } as UseQueryResult<{
            label: string,
            value: string,
        }[], Error>;
    }

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
                            suggestionsQueryResult={repackageQueryResult(item)}
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
