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
import { useState } from "react"

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
}: {
    options: ComboboxOption[],
    unselectedLabel: string,
    emptyLabel: string,
    searchPlaceholder: string,
    value?: string,
    onValueChange?: (value: string) => void,
    open?: boolean,
    onOpenChange?: (value: boolean) => void,
}) {
  const [internalValue, setInternalValue] = useState("");
  const value = providedValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = providedOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="justify-between w-fit"
                >
                    {value
                        ? options.find((option) => option.value === value)?.label
                        : unselectedLabel}
                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
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
