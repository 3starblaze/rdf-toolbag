import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState, type ReactNode } from "react"

interface ComboboxOption {
    value: string,
    label: string,
}

export function Combobox({
    options,
    unselectedLabel,
    emptyLabel,
    searchPlaceholder,
    value: providedValue,
    onValueChange,
    open: providedOpen,
    onOpenChange,
    allowCustomValues: providedAllowCustomValues,
    className,
}: {
    options: ComboboxOption[],
    unselectedLabel: ReactNode,
    emptyLabel: ReactNode,
    searchPlaceholder: string,
    value?: string,
    onValueChange?: (value: string) => void,
    open?: boolean,
    onOpenChange?: (value: boolean) => void,
    allowCustomValues?: boolean,
    className?: string,
}) {
  const allowCustomValues = providedAllowCustomValues ?? false;
  const [internalValue, setInternalValue] = useState("");
  const value = providedValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = providedOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [inputValue, setInputValue] = useState(value);
  const inputValueExists = !!options.find((item) => item.value === inputValue);

  return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("justify-between w-fit", className)}
                >
                    {value
                        ? options.find((option) => option.value === value)?.label || value
                        : unselectedLabel}
                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Command>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={inputValue}
                        onValueChange={setInputValue}
                    />
                    <CommandList>
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {allowCustomValues && !inputValueExists && (
                                <CommandItem
                                    value={inputValue}
                                    onSelect={(currentValue) => {
                                        setValue(currentValue === value ? "" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <CheckIcon
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === inputValue ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    Custom: {inputValue}
                                </CommandItem>
                            )}
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={(currentValue) => {
                                        setValue(currentValue === value ? "" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <CheckIcon
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
