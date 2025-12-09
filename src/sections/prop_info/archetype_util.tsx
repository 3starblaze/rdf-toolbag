import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";

export interface ArchetypeCountPayload {
    archetype: Set<string>,
    count: number,
}

const columnHelper = createColumnHelper<ArchetypeCountPayload>();

function isSetEqual(a: Set<unknown>, b: Set<unknown>): boolean {
    return (a.size === b.size) && [...a].every((x) => b.has(x));
}

export function useArchetypeActionColumn(): ColumnDef<ArchetypeCountPayload> {
    const pinnedArchetype = useStore((store) => store.pinnedArchetype);
    const setPinnedArchetype = useStore((store) => store.setPinnedArchetype);

    return columnHelper.display({
        id: "action",
        header: () => (<></>),
        cell: ({ row }) => {
            const { archetype } = row.original;

            const isPinned = pinnedArchetype && isSetEqual(archetype, pinnedArchetype);

            return (
                <Button
                    variant={isPinned ? "default" : "outline"}
                    onClick={() => setPinnedArchetype(archetype)}
                >
                    {isPinned ? "Pinned" : "Pin"}
                </Button>
            );
        },
    });
}
