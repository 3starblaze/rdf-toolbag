import { useQuery } from "@tanstack/react-query";

import {
    archetypesForTypeQuery,
} from "@/sparql_queries";
import ArchetypeMatrix from "./archetype_matrix";
import PaginatedTable, { defaultPagination } from "@/components/paginated_table";
import { createColumnHelper, type PaginationState } from "@tanstack/react-table";
import { useState } from "react";
import StateGuard from "@/components/state_guard";
import PaginatedChart from "@/components/paginated_chart";
import { Button } from "@/components/ui/button";
import { useArchetypeActionColumn } from "./archetype_util";
import ExamineSparql from "@/components/examine_sparql";

export default function ArchetypeInfo({
    url,
    rdfType,
    properties,
}: {
    url: URL,
    rdfType: string | undefined,
    properties: string[] | undefined,
}) {
    const enabled = (rdfType !== undefined) && (properties !== undefined);

    const maybeItems = enabled ? archetypesForTypeQuery(url, rdfType, properties) : null;

    const queryString = maybeItems?.queryString;

    const queryRes = useQuery({
        ...(maybeItems?.tanstackQueryOptions ?? {queryKey: []}),
        enabled,
    });

    const [pagination, setPagination] = useState<PaginationState>(defaultPagination);

    type TData = Exclude<(typeof queryRes.data), undefined>[number];

    const columnHelper = createColumnHelper<TData>();

    const matrixView = (data: TData[]) => properties ? (
        <ArchetypeMatrix
            data={data}
            allProperties={properties}
            pagination={pagination}
            onPaginationChange={setPagination}
        />
    ): (<></>);

    const actionCol = useArchetypeActionColumn();

    const sparseView = (data: TData[]) => (
        <PaginatedTable
            data={data}
            pagination={pagination}
            onPaginationChange={setPagination}
            columns={[
                actionCol,
                columnHelper.accessor("archetype", {
                    header: "Archetype",
                    cell: ({ getValue }) => (
                        <pre>
                            {JSON.stringify([...getValue().values()], undefined, 4)}
                        </pre>
                    ),
                }),
                columnHelper.accessor("count", {
                    header: "Count",
                    cell: ({ getValue }) => (
                        <div>{getValue()}</div>
                    ),
                }),
            ]}
        />
    );

    const [isMatrixView, setIsMatrixView] = useState(true);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
                <p className="font-bold">Available archetypes</p>
                <ExamineSparql
                    query={queryString || ""}
                />
            </div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <>
                        <PaginatedChart
                            data={data}
                            pagination={pagination}
                            valueDataKey="count"
                        />
                        {/* NOTE: This probably should have been a tab but this will do */}
                        <div className="flex gap-2">
                            <Button
                                variant={isMatrixView ? "default" : "outline"}
                                onClick={(() => setIsMatrixView(true))}
                            >
                                Matrix view
                            </Button>
                            <Button
                                variant={!isMatrixView ? "default" : "outline"}
                                onClick={() => setIsMatrixView(false)}
                            >
                                Sparse view
                            </Button>
                        </div>
                        {isMatrixView ? matrixView(data) : sparseView(data)}
                    </>
                )}
            />
        </div>
    );
}
