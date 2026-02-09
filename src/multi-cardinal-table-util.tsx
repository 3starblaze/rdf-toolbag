import {
    type SparqlTableResult,
} from "@/sparql_queries";
import {
    createColumnHelper,
    type ColumnDef,
} from "@tanstack/react-table";
import PaginatedTable from "@/components/paginated_table";

export interface MulticardinalRow {
    subject: string,
    props: { [key: string]: string[] },
}

export function tableToRows(table: SparqlTableResult) {
    const cols = table.head.vars;
    if (cols.length !== 3) {
        throw new Error(`Expected 3 columns for table, got ${cols.length}`);
    }

    const collectingMap = new Map<string, MulticardinalRow>();

    const getOrCreate = (subject: string): MulticardinalRow => {
        const maybeEntry = collectingMap.get(subject);
        if (maybeEntry) return maybeEntry;

        const entry: MulticardinalRow = {
            subject,
            props: {},
        };

        collectingMap.set(subject, entry);
        return entry;
    }

    const pushProp = (row: MulticardinalRow, prop: string, value: string) => {
        let arr: string[];

        if (prop in row.props) {
            arr = row.props[prop];
        } else {
            arr = [];
            row.props[prop] = arr;
        }

        arr.push(value);
    };

    for (const item of table.results.bindings) {
        const subject = item[cols[0]].value;
        const predicate = item[cols[1]].value;
        const object = item[cols[2]].value;

        const entry = getOrCreate(subject);
        pushProp(entry, predicate, object);
    }

    return [...collectingMap.values()];
}

export function AggregatedTable({
    properties,
    rows,
}: {
    properties: string[]
    rows: MulticardinalRow[],
}) {
    const columnHelper = createColumnHelper<MulticardinalRow>();

    const generatedColumns: ColumnDef<MulticardinalRow>[] = properties.map((prop) => ({
        id: prop,
        accessorFn: (row) => row.props[prop],
        cell: ({ getValue }) => {
            const val = getValue<string[] | undefined>() ?? [];

            if (val.length === 1) {
                return <p>{val[0]}</p>
            }

            return (
                <pre>{JSON.stringify(val, undefined, 4)}</pre>
            )
        },
    }));

    const columns: ColumnDef<MulticardinalRow>[] = [
        columnHelper.accessor("subject", {}) as ColumnDef<MulticardinalRow>,
        ...generatedColumns,
    ];

    return (
        <PaginatedTable
            data={rows}
            columns={columns}
        />
    );
}
