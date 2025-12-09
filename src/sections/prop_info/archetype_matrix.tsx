import PaginatedTable from "@/components/paginated_table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { type PaginationState, type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useArchetypeActionColumn, type ArchetypeCountPayload } from "./archetype_util";

export default function ArchetypeMatrix({
    allProperties, data, pagination, onPaginationChange,
}: {
    allProperties: string[],
    data: ArchetypeCountPayload[],
    pagination?: PaginationState,
    onPaginationChange?: (state: PaginationState) => void,
}) {
    const generatedCols: ColumnDef<ArchetypeCountPayload>[] = allProperties.map((propName) => ({
        id: propName,
        header: ({}) => (
            <div className="flex py-2">
                <p
                    className="rotate-180 font-normal flex justify-start"
                    style={{
                        writingMode: "vertical-lr",
                    }}>{propName}</p>
            </div>
        ),
        accessorFn: ({ archetype }) => archetype.has(propName),
        cell: ({ getValue }) => (
            <div className={cn(
                "w-5 aspect-square rounded-full",
                getValue() ? "bg-gray-500" : "bg-gray-200"
            )}></div>
        )
    }));

    const countCol: ColumnDef<ArchetypeCountPayload> = {
        accessorKey: "count",
        header: "Count",
        cell: ({ getValue }) => (
            <div>{getValue() as number}</div>
        ),
    };

    const actionCol = useArchetypeActionColumn();

    return (
        <PaginatedTable
            data={data}
            columns={[
                actionCol,
                ...generatedCols,
                countCol,
            ]}
            pagination={pagination}
            onPaginationChange={onPaginationChange} />
    );
}
