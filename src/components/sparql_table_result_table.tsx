import type { SparqlTableResult } from "@/sparql_queries";
import PaginatedTable from "./paginated_table";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";

export default function SparqlTableResultTable({
    data: unformattedData,
    pagination,
    onPaginationChange,
}: {
    data: SparqlTableResult,
    pagination?: PaginationState,
    onPaginationChange?: (state: PaginationState) => void,
}) {
    const cols = unformattedData.head.vars;
    const data = unformattedData.results.bindings;

    type TData = (typeof data)[number];

    const columns: ColumnDef<TData>[] = cols.map((colName) => ({
        accessorFn: (row) => row[colName].value,
        header: colName,
    }));

    return (
        <PaginatedTable
            columns={columns}
            data={data}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
        />
    );
}
