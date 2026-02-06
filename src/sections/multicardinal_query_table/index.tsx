import ExamineSparql from "@/components/examine_sparql";
import PaginatedTable from "@/components/paginated_table";
import { PropertySelector } from "@/components/property_selector";
import StateGuard from "@/components/state_guard";
import { Button } from "@/components/ui/button";
import { multiCardinalTableAsSelectQuery, typePropertiesQuery, type SparqlTableResult } from "@/sparql_queries";
import { useStore } from "@/store";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import N3 from "n3";
import { useState } from "react";

interface MulticardinalRow {
    subject: string,
    props: {[key: string]: string[]},
}

function tableToRows(table: SparqlTableResult) {
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

function isArrayEqual(a: unknown[], b: unknown[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export default function SampleMulticardinalQuery({
    url,
}: {
    url: URL,
}) {
    const pinnedRdfType = useStore((store) => store.pinnedRdfType);
    const rdfType = `<${pinnedRdfType}>`;
    const idLimit = 10;

    const [uncommittedProperties, setUncommittedProperties] = useState<string[]>([]);
    const [properties, setProperties] = useState<string[]>([]);

    const areUncomittedPropertiesDifferent = isArrayEqual(uncommittedProperties, properties);

    const {
        tanstackQueryOptions,
        queryString,
    } = multiCardinalTableAsSelectQuery(url, rdfType, properties, idLimit);
    const queryRes = useQuery(tanstackQueryOptions);

    const {
        tanstackQueryOptions: typePropertiesQueryOptions,
    } = typePropertiesQuery(url, rdfType);

    const typePropertiesQueryRes = useQuery(typePropertiesQueryOptions);
    const suggestionData = typePropertiesQueryRes.data || [];

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Sample multicardinal query</h1>
                <ExamineSparql query={queryString} />
            </div>
            <div className="flex flex-col gap-2">
                <p>Select properties</p>
                <PropertySelector
                    value={uncommittedProperties}
                    onValueChange={setUncommittedProperties}
                    suggestions={suggestionData.map((item) => ({
                        label: item,
                        value: item,
                    }))}
                />
                <div className="flex gap-2">
                    <Button
                        className="w-fit"
                        variant="outline"
                        onClick={() => setProperties(uncommittedProperties)}
                        disabled={areUncomittedPropertiesDifferent}
                    >
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setUncommittedProperties(properties)}
                        disabled={areUncomittedPropertiesDifferent}
                    >
                        Revert
                    </Button>
                </div>
            </div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <AggregatedTable
                        properties={properties}
                        rows={tableToRows(data)}
                    />
                )}
            />
        </div>
    );
}
