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

/**
 * Remove duplicates that could happen when results have cartesian product.
 */
export function deduplicateTable(
    table: SparqlTableResult,
    idColKey?: string | number,
): MulticardinalRow[] {
    // NOTE: prop values are temporarily stored in a set, so that duplicate values are eliminated.
    interface TmpRow {
        subject: string,
        props: { [key: string]: Set<string> }
    }

    const cols = table.head.vars;
    if (cols.length === 0) return [];


    const idCol = (() => {
        if (idColKey === undefined) {
            return cols[0];
        }

        switch (typeof idColKey) {
            case "string":
                if (!cols.includes(idColKey)) {
                    throw new Error(`key '${idColKey}' does not exist`);
                } else {
                    return idColKey;
                }
            case "number":
                const maybeRes = cols[idColKey];
                if (maybeRes === undefined) {
                    throw new Error(`key ${idColKey} out of bounds`);
                }
                return maybeRes;
        }
    })();

    const collectingMap = new Map<string, TmpRow>();

    const getOrCreate = (subject: string): TmpRow => {
        const maybeEntry = collectingMap.get(subject);
        if (maybeEntry) return maybeEntry;

        const entry: TmpRow = {
            subject,
            props: {},
        };

        collectingMap.set(subject, entry);
        return entry;
    }

    const pushProp = (row: TmpRow, prop: string, value: string) => {
        let valueToModify: Set<string>;

        if (prop in row.props) {
            valueToModify = row.props[prop];
        } else {
            valueToModify = new Set();
            row.props[prop] = valueToModify;
        }

        valueToModify.add(value);
    };

    for (const tableRow of table.results.bindings) {
        const row = getOrCreate(tableRow[idCol].value);

        Object.entries(tableRow).forEach(([k, { value }]) => {
            if (k === idCol) return;
            pushProp(row, k, value);
        });
    }

    return [...collectingMap.values()].map(({ props: oldProps, ...rest }) => {
        const propsEntries = Object.entries(oldProps)
                                   .map(([k, v]) => [k, [...v.values()]] satisfies [unknown, unknown]);
        const props = Object.fromEntries(propsEntries);
        return {
            props,
            ...rest,
        };
    });
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
