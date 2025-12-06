import type { SparqlTableResult } from "@/sparql_queries";

export default function SparqlTableResultTable({
    data
}: {
    data: SparqlTableResult
}) {
    const cols = data.head.vars;
    const rows = data.results.bindings;

    return (
        <table>
            <tr className="bg-gray-200">
                {cols.map((col) => (<th key={col}>{col}</th>))}
            </tr>
            {rows.map((row, i) => (
                <tr
                    key={i}
                    className="even:bg-gray-100"
                >
                    {cols.map((col) => (
                        <td key={col} className="px-4 py-2">
                            {row[col].value}
                        </td>
                    ))}
                </tr>
            ))}
        </table>
    );
}
