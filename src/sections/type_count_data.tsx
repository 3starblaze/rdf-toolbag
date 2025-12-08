import GuardedTableView from "@/components/guarded_table_view";
import { defaultPagination } from "@/components/paginated_table";
import SparqlTablePaginatedChart from "@/components/sparql_table_paginated_chart";
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
                <SparqlTablePaginatedChart
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
