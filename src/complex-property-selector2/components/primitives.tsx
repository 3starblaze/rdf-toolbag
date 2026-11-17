import type { ComponentProps, ReactNode } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Heading of a section, followed by an optional action (usually an add button). */
export function SectionHeader({
    title,
    children,
}: {
    title: ReactNode,
    children?: ReactNode,
}) {
    return (
        <div className="flex min-h-7 items-center gap-2">
            <p className="m-0 font-medium">{title}</p>
            {children}
        </div>
    );
}

/** Small outlined icon button with a plus sign. */
export function AddIconButton({
    label,
    ...props
}: Omit<ComponentProps<typeof Button>, "children"> & { label: string }) {
    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 cursor-pointer"
            aria-label={label}
            title={label}
            {...props}
        >
            <Plus className="size-3.5" />
        </Button>
    );
}

/** One-line row in a list that opens the item when clicked. */
export function RowButton({
    className,
    children,
    ...props
}: ComponentProps<"button">) {
    return (
        <button
            type="button"
            className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg border bg-background pr-2.5 pl-3 text-left shadow-xs transition-all outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                className,
            )}
            {...props}
        >
            {children}
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
    );
}

/** Bordered block that groups related inputs. */
export function ItemCard({
    title,
    actions,
    children,
}: {
    title: ReactNode,
    actions?: ReactNode,
    children?: ReactNode,
}) {
    return (
        <section className="flex flex-col gap-2 rounded-lg border bg-neutral-50 p-3 dark:bg-neutral-900">
            <div className="flex min-h-7 items-center gap-2">
                <p className="m-0 min-w-0 flex-1 font-medium">{title}</p>
                {actions}
            </div>
            {children}
        </section>
    );
}

export function OrLabel({ className }: { className?: string }) {
    return (
        <span className={cn("text-sm font-medium text-gray-500", className)}>OR</span>
    );
}

export function Hint({ children }: { children?: ReactNode }) {
    return <p className="m-0 text-[13px] text-muted-foreground">{children}</p>;
}

/** Segmented control: exactly one option is always selected. */
export function SegmentedToggle<T extends string>({
    value,
    onValueChange,
    options,
    ariaLabel,
    size = "sm",
}: {
    value: T,
    onValueChange: (newValue: T) => void,
    options: readonly { value: T, label: ReactNode }[],
    ariaLabel: string,
    size?: "sm" | "default",
}) {
    return (
        <ToggleGroup
            type="single"
            value={value}
            // NOTE: Clicking the selected item would deselect it, which is not allowed here.
            onValueChange={(newValue) => newValue && onValueChange(newValue as T)}
            aria-label={ariaLabel}
            className="gap-0 rounded-lg border bg-muted p-0.5"
        >
            {options.map((option) => (
                <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className={cn(
                        "cursor-pointer gap-1.5 rounded-md! border-0 font-medium text-neutral-600 hover:bg-transparent hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs dark:text-neutral-400 [&_svg:not([class*='size-'])]:size-3.5",
                        size === "sm" ? "h-6.5 min-w-0 px-2.5 text-[13px]" : "h-7.5 min-w-0 px-3.5 text-sm",
                    )}
                >
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
