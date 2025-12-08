import type { SparqlTableResult } from "@/sparql_queries";
import type { PaginationState } from "@tanstack/react-table";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

export default function PaginatedChart({
    data,
    labelDataKey,
    valueDataKey,
    pagination,
}: {
    data: SparqlTableResult,
    labelDataKey?: string,
    valueDataKey: string,
    pagination: PaginationState,
}) {
    const { pageSize, pageIndex } = pagination;

    const rows = data.results.bindings.map((obj) => ({
        ...(labelDataKey ? { [labelDataKey]: obj[labelDataKey]?.value } : {}),
        [valueDataKey]: Number(obj[valueDataKey].value),
    })).slice(pageSize * pageIndex, pageSize * (pageIndex + 1));

    return (
        <BarChart
            className="max-w-160 min-h-80"
            width={"100%"}
            height={"100%"}
            responsive
            data={rows}
            margin={{
                left: 0,
                bottom: 0,
            }}
        >
            (labelDataKey && (<XAxis dataKey={labelDataKey} />))
            <YAxis />
            <Bar dataKey={valueDataKey} className="fill-gray-500" />
        </BarChart>
    );
}
