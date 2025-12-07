import GuardedTableView from "@/components/guarded_table_view";
import PaginatedChart from "@/components/paginated_chart";
import { defaultPagination } from "@/components/sparql_table_result_table";
import { createTypeCountQuery } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";
import type { PaginationState } from "@tanstack/react-table";
import { useState } from "react";

export default function TypeCountInfo({
    url,
}: {
    url: URL,
}) {
    const queryRes = useQuery({
        queryKey: ["typeCount"],
        queryFn: createTypeCountQuery({ sparqlURL: url }),
    });

    const [pagination, setPagination] = useState<PaginationState>(defaultPagination);

    return (
        <div>
            {queryRes.data && (
                <PaginatedChart
                    data={queryRes.data}
                    pagination={pagination}
                    labelDataKey="obj"
                    valueDataKey="count"
                />
            )}
            <GuardedTableView
                queryRes={queryRes}
                pagination={pagination}
                onPaginationChange={setPagination}
            />
        </div>
    );
}
