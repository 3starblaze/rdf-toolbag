import { Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSelectorContext } from "../../selector-context";
import type { ConstraintArg } from "../../shared";
import { argText } from "../../util";

/** Compact view of a constraint argument. */
export function ArgChip({ arg, budget = 18 }: { arg: ConstraintArg, budget?: number }) {
    const { selection, labelOf } = useSelectorContext();
    const info = argText(arg, selection, labelOf, budget);

    return (
        <span
            title={info.full}
            data-arg-kind={arg.kind}
            className={cn(
                "flex h-6 min-w-0 flex-[1_1_0] items-center gap-1.5 rounded-md px-2 text-[13px]",
                info.isLiteral
                    ? "border border-dashed border-neutral-400 bg-background text-cyan-800 dark:text-cyan-300"
                    : "bg-neutral-200/70 text-foreground dark:bg-neutral-800",
            )}
        >
            {!info.isLiteral && <Route aria-hidden="true" className="size-3 shrink-0" />}
            <span className="min-w-0 truncate">{info.text}</span>
        </span>
    );
}

/** Compact one-line view of a binary constraint: kind, target, operator and value. */
export function BinaryConstraintSummary({
    label,
    operator,
    target,
    value,
}: {
    label: string,
    operator: string,
    target: ConstraintArg,
    value: ConstraintArg,
}) {
    return (
        <>
            <Badge className="h-5.5 shrink-0 rounded-md px-2">{label}</Badge>
            <ArgChip arg={target} />
            <span className="shrink-0 text-[13px] text-muted-foreground">{operator}</span>
            <ArgChip arg={value} />
        </>
    );
}
