import ExamineSparql from "@/components/examine_sparql";
import PaginatedTable from "@/components/paginated_table";
import StateGuard from "@/components/state_guard";
import { multicardinalTableQuery } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import N3 from "n3";

interface MulticardinalRow {
    subject: string,
    props: {[key: string]: string[]},
}

function quadsToRows(data: N3.Quad[]): MulticardinalRow[] {
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

    for (const quad of data) {
        const subject = quad.subject.value;
        const predicate = quad.predicate.value;
        const object = quad.object.value;

        const entry = getOrCreate(subject);
        pushProp(entry, predicate, object);
    }

    return [...collectingMap.values()];
}

function AggregatedTable({
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
            const val = getValue<string[]>();

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

export default function SampleMulticardinalQuery({
    url,
}: {
    url: URL,
}) {
    const rdfType = "<http://ldf.fi/schema/yoma/ReferencedPerson>";
    const properties = [
        "http://ldf.fi/schema/yoma/in_bio",
        "http://ldf.fi/schema/bioc/has_family_relation",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
    ];
    const idLimit = 10;

    const {
        tanstackQueryOptions,
        queryString,
    } = multicardinalTableQuery(url, rdfType, properties, idLimit);
    const queryRes = useQuery(tanstackQueryOptions);

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Sample multicardinal query</h1>
                <ExamineSparql query={queryString} />
            </div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <AggregatedTable
                        properties={properties}
                        rows={quadsToRows(data)}
                    />
                )}
            />
        </div>
    );
}
