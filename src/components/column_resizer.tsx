import { cn } from "@/lib/utils";
import {
    type Header,
} from "@tanstack/react-table";
import { GripVerticalIcon } from "lucide-react";

export function ColumnResizer<TData, TValue>({
    header,
    ...props
}: {
    header: Header<TData, TValue>,
} & React.ComponentProps<"div">) {
    if (header.column.getCanResize() === false) return <></>;

    // NOTE: Style is similar to shadcn's "Collapsible" component's handle
    return (
        <div
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            className={cn(
                "relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
                "cursor-col-resize z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border",
            )}
            // NOTE: these styles ensure that text selection (and other) behavior won't kick in
            // while dragging is in progress.
            style={{
                userSelect: "none",
                touchAction: "none",
            }}
            {...props}
        >
            <GripVerticalIcon className="size-2.5" />
        </div>
    );
};
