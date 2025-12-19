import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import N3 from "n3";
import PaginatedTable from "./paginated_table";

export default function SparqlGraphResultTable({
    data,
    pagination,
    onPaginationChange,
}: {
    data: N3.Quad[],
    pagination?: PaginationState,
    onPaginationChange?: (state: PaginationState) => void,
}) {
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
        <PaginatedTable
            columns={columns}
            data={data}
            pagination={pagination}
            onPaginationChange={onPaginationChange}
        />
    );
}
