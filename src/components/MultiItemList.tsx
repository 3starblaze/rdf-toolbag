import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function DestroyItemButton({
  onClick,
}: {
  onClick: () => void,
}) {
  return (
    <Button
      className="cursor-pointer"
      variant="destructive"
      onClick={onClick}
    >
       -
    </Button>
  );
}

export function MultiItemAddButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("cursor-pointer", className)}
      variant="outline"
      {...props}
    />
  );
}

export function MultiItemSelectorList({
    className,
    children,
}: {
    children?: React.ReactNode,
    className?: string,
}) {
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            {children}
        </div>
    );
}

export function MultiItemSelectorBase({
  children,
}: {
  children?: React.ReactNode,
}) {
  return (
    <div className="max-w-prose flex flex-col gap-2">
      {children}
    </div>
  );
}

export function MultiItemRow({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex gap-2", className)}
      {...props}
    />
  );
}
