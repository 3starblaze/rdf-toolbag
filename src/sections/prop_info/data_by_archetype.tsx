import { useQuery } from "@tanstack/react-query";
import {
    findByArchetypeQuery,
} from "@/sparql_queries";
import StateGuard from "@/components/state_guard";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import PaginatedTable from "@/components/paginated_table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import ExamineSparql from "@/components/examine_sparql";

const defaultLimit = 50;
const limitOptions = [10, 20, 50, 100, 200, 500, 1000];

function LimitSelector({
    limit,
    setLimit
}: {
    limit: number,
    setLimit: (val: number) => void,
}) {
    return (
        <div className="flex flex-row items-center gap-2">
            <p>Limit</p>
            <Select
                value={limit.toString()}
                onValueChange={(value) => setLimit(Number(value))}
            >
                <SelectTrigger className="">
                    <SelectValue placeholder="Select limit size" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {limitOptions.map((opt) => (
                            <SelectItem value={opt.toString()}>{opt}</SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>
    );
}

export default function DataByArchetype({
    url,
    rdfType,
    properties,
}: {
    url: URL,
    rdfType: string | undefined,
    properties: string[] | undefined,
}) {
    const enabled = (rdfType !== undefined) && (properties !== undefined);

    const [limit, setLimit] = useState(defaultLimit);

    const maybeRes = enabled ? findByArchetypeQuery(url, rdfType, properties, limit) : null;

    const queryRes = useQuery({
        ...(maybeRes?.tanstackQueryOptions ?? {queryKey: [] }),
        enabled,
    });

    return (
        <div>
            <div className="flex gap-2 items-center">
                <p className="font-bold">Data for archetype</p>
                <ExamineSparql
                    query={maybeRes?.queryString ?? ""}
                />
            </div>
            <pre className="text-sm">
                {JSON.stringify(properties, undefined, 4)}
            </pre>
            <LimitSelector
                limit={limit}
                setLimit={setLimit}
            />
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => {
                    if (!enabled || data.length === 0) return (<p>No results</p>);

                    type TData = (typeof data)[number];
                    const columnHelper = createColumnHelper<TData>();

                    const generatedColumns: ColumnDef<TData>[] = properties.map((propName) => ({
                        id: propName,
                        cell: ({ getValue }) => (
                            <p>{getValue<string>()}</p>
                        ),
                        accessorFn: (row) => row[propName],
                    }));

                    const columns: ColumnDef<TData>[] = [
                        columnHelper.accessor("subject", {
                            cell: ({ getValue }) => (
                                <p>{getValue()}</p>
                            ),
                        }),
                        ...generatedColumns,
                    ];

                    return (
                        <PaginatedTable
                            columns={columns}
                            data={data}
                        />
                    )
                }}
            />
        </div>
    );
}
