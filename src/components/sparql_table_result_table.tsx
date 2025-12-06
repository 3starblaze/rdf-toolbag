import type { SparqlTableResult } from "@/sparql_queries";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function SparqlTableResultTable({
    data
}: {
    data: SparqlTableResult
}) {
    const cols = data.head.vars;
    const rows = data.results.bindings;

    return (
        <Table>
            <TableHeader>
                {cols.map((col) => (
                    <TableHead
                        key={col}
                        className="font-bold"
                    >
                        {col}
                    </TableHead>
                ))}
            </TableHeader>
            <TableBody>
                {rows.map((row, i) => (
                    <TableRow
                        key={i}
                    >
                        {cols.map((col) => (
                            <TableCell key={col}>
                                {row[col].value}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
