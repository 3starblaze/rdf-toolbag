import ExamineSparql from "@/components/examine_sparql";
import PaginatedTable from "@/components/paginated_table";
import StateGuard from "@/components/state_guard";
import { defaultConstructQuery } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import N3 from "n3";

export default function DefaultConstructQuery({
    url,
}: {
    url: URL,
}) {
    const { tanstackQueryOptions, queryString } = defaultConstructQuery(url);

    const queryRes = useQuery(tanstackQueryOptions);

    const columns: ColumnDef<N3.Quad>[] = [
        {
            id: "subject",
            accessorFn: (quad) => quad.subject.value,
        },
        {
            id: "predicate",
            accessorFn: (quad) => quad.predicate.value,
        },
        {
            id: "object",
            accessorFn: (quad) => quad.object.value,
        },
    ];

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Sample data</h1>
                <ExamineSparql query={queryString} />
            </div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <PaginatedTable
                        columns={columns}
                        data={data}
                    />
                )}
            />
        </div>
    );
}
