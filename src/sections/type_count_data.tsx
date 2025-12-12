import PaginatedChart from "@/components/paginated_chart";
import PaginatedTable, { defaultPagination } from "@/components/paginated_table";
import StateGuard from "@/components/state_guard";
import { Button } from "@/components/ui/button";
import { typeCountQuery } from "@/sparql_queries";
import { useStore } from "@/store";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useState } from "react";

export default function TypeCountInfo({
    url,
}: {
    url: URL,
}) {
    const queryRes = useQuery(typeCountQuery(url));

    const pinnedRdfType = useStore((store) => store.pinnedRdfType);
    const setPinnedRdfType = useStore((store) => store.setPinnedRdfType);

    const [pagination, setPagination] = useState<PaginationState>(defaultPagination);

    type TData = Exclude<typeof queryRes.data, undefined>[number];

    const columnHelper = createColumnHelper<TData>();

    const columns: ColumnDef<TData>[] = [
        columnHelper.display({
            id: "action",
            cell: ({ row }) => {
                const { type: rdfType } = row.original;
                const isPinned = pinnedRdfType === rdfType;

                return (
                    <Button
                        variant={isPinned ? "default" : "outline"}
                        onClick={() => setPinnedRdfType(rdfType)}
                    >
                        {isPinned ? "Pinned" : "Pin"}
                    </Button>
                );
            },
        }),
        columnHelper.accessor("type", {}) as ColumnDef<TData>,
        columnHelper.accessor("count", {}) as ColumnDef<TData>,
    ];

    return (
        <div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <>
                        <PaginatedChart
                            data={data}
                            pagination={pagination}
                            valueDataKey="count"
                        />
                        <PaginatedTable
                            columns={columns}
                            data={data}
                            pagination={pagination}
                            onPaginationChange={setPagination}
                        />
                    </>
                )}
            />
        </div>
    );
}
