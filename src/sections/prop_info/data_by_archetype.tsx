import { useQuery } from "@tanstack/react-query";
import {
    findByArchetypeQuery,
} from "@/sparql_queries";
import StateGuard from "@/components/state_guard";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import PaginatedTable from "@/components/paginated_table";

export default function DataByArchetype({
    url,
    rdfType,
    properties,
}: {
    url: URL,
    rdfType: string | undefined,
    properties: string[] | undefined,
}) {
    const limit = 10;

    const enabled = (rdfType !== undefined) && (properties !== undefined);

    const queryRes = useQuery({
        ...findByArchetypeQuery(url, rdfType as string, properties as string[], limit),
        enabled,
    });

    return (
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
                        cell: ({ getValue}) => (
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
    );
}
