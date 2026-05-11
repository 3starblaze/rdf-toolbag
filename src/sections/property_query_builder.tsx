import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from "@/components/complex_property_selector";
import { MultiCardinalTableServer, type CountPayload } from "@/components/multi-cardinal-table";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { deduplicateTable, SyncPropertySelector, type MulticardinalRow } from "@/lib_index";
import { demangleVarName, formatQuery } from "@/misc/complex_property_query_builder";
import { formatUniversalPaginatorQuery, formatUniversalPaginatorQueryCounter, requestAsSparqlTableResult, type SparqlTableResult } from "@/sparql_queries";
import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, Info } from "lucide-react";
import { useEffect, useId, useState } from "react";

function CollapsedInfo({
    title,
    children
}: {
    title: string,
    children: React.ReactNode,
}) {
    return (
        <Collapsible className="group flex flex-col gap-2">
            <CollapsibleTrigger
                className="flex flex-row gap-1 items-center bg-gray-100 px-4 py-2 rounded-lg w-fit cursor-pointer"
            >
                <p>{title}</p>
                <ChevronDown
                    className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="bg-gray-100">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}

function QueryDisplay({
    selection,
}: {
    selection: ComplexPropertySelection,
}) {
    return (
        <CollapsedInfo title="Query">
            <pre>
                {formatQuery(selection)}
            </pre>
        </CollapsedInfo>
    );
}

function SelectionDisplay({
    selection,
}: {
    selection: ComplexPropertySelection,
}) {
    return (
        <CollapsedInfo title="JSON">
            <pre>
                {JSON.stringify(selection, undefined, 2)}
            </pre>
        </CollapsedInfo>
    );
}

async function getRdfTypes(url: URL): Promise<{ label: string, value: string }[]> {
    const limit = 100;

    const queryString = `
SELECT DISTINCT ?obj
WHERE {
  ?sub a ?obj
}
LIMIT ${limit}
`;

    const table = await requestAsSparqlTableResult(url, queryString);
    const res = table.results.bindings
                     .map((row) => row["obj"].value)
                     .map((value) => ({ value, label: value}));
    return res;
}

async function getTypeSuggestions(url: URL, rdfType: string | null): Promise<string[]> {
    const limit = 100;
    const whereBlock = ["?s ?p ?o .", (rdfType !== null) && `?s a <${rdfType}> .`]
        .filter((x) => x)
        .join(" ");

    const queryString = `SELECT DISTINCT ?p WHERE { ${whereBlock} } LIMIT ${limit}`;

    const res = await requestAsSparqlTableResult(url, queryString);
    return res.results.bindings.map((row) => row["p"].value);
}

function H1({ className, ...props }: React.ComponentProps<"h1">) {
    return (
        <h1
            className={cn("text-2xl font-bold", className)}
            {...props}
        />
    );
}

function NumericInput({
    value,
    onValueChange,
    ...props
}: {
    value: number | null,
    onValueChange: (newValue: number | null) => void,
} & Omit<React.ComponentProps<typeof Input>, "value">) {
    const [rawInput, setRawInput] = useState(value?.toString() || "");

    // NOTE: number converter
    useEffect(() => {
        if (rawInput === "") onValueChange(null);
        else {
            const maybeNumber = Number(rawInput);
            onValueChange(isNaN(maybeNumber) ? null : maybeNumber);
        }
    }, [rawInput]);

    return (
        <Input
            type="number"
            value={rawInput}
            onChange={(ev) => setRawInput(ev.currentTarget.value)}
            {...props}
        />
    );
}

function NumericField({
    fieldLabelContent,
    value,
    onValueChange,
}: {
    fieldLabelContent: React.ReactNode,
    value: number | null,
    onValueChange: (newValue: number | null) => void,
}) {
    const id = useId();

    return (
        <Field>
            <FieldLabel htmlFor={id}>
                {fieldLabelContent}
            </FieldLabel>
            <NumericInput {...{id, value, onValueChange}} />
        </Field>
    )
}

interface PaginationData {
    globalLimit: number,
    groupLimit: number,
    groupOffset: number,
    idVars: string[],
}

function selectionToIdVarSuggestions(selection: ComplexPropertySelection): string[] {
    // NOTE: A pretty rough method to do this but it does work
    const formattedQuery = formatQuery(selection);
    const matches = formattedQuery.match(/\?\w+/g);
    // NOTE: Keep unique values and remove the leading "?" in matched var name
    return [...new Set(matches)].map((match) => match.slice(1));
}

function LimitSection({
    selection,
    paginationData,
    onPaginationDataChange: onPaginationDataChange,
    labelMaker,
}: {
    selection: ComplexPropertySelection,
    paginationData: PaginationData | null,
    onPaginationDataChange: (newValue: PaginationData | null) => void,
    labelMaker: (value: string) => string,
}) {
    const [globalLimit, setGlobalLimit] = useState<number | null>(paginationData?.globalLimit ?? null);
    const [groupLimit, setGroupLimit] = useState<number | null>(paginationData?.groupLimit ?? null);
    const [groupOffset, setGroupOffset] = useState<number | null>(paginationData?.groupOffset ?? null);

    const [idVars, setIdVars] = useState(paginationData?.idVars ?? []);

    useEffect(() => {
        if (globalLimit === null || groupLimit === null || groupOffset === null) {
            onPaginationDataChange(null);
        } else {
            onPaginationDataChange({
                globalLimit,
                groupLimit,
                groupOffset,
                idVars,
            });
        }
    }, [globalLimit, groupLimit, groupOffset, idVars]);

    const suggestions: { label: string, value: string }[] = selectionToIdVarSuggestions(selection)
        .map((value) => ({
            label: labelMaker(value),
            value,
        }));

    return (
        <>
            <div className="flex flex-col gap-4">
                {!paginationData && (<p className="text-red-500">Limit info incomplete!</p>)}
                <NumericField
                    fieldLabelContent="Global limit"
                    value={globalLimit}
                    onValueChange={setGlobalLimit}
                />
                <NumericField
                    fieldLabelContent="Group limit"
                    value={groupLimit}
                    onValueChange={setGroupLimit}
                />
                <NumericField
                    fieldLabelContent="Group offset"
                    value={groupOffset}
                    onValueChange={setGroupOffset}
                />
                <p>Id properties</p>
                <SyncPropertySelector
                    suggestions={suggestions}
                    value={idVars}
                    onValueChange={setIdVars}
                />
            </div>
        </>
    );
}

async function tryGettingCount({
    url,
    formattedQuery,
    globalRowCountVar,
    groupedRowCountVar,
}: {
    url: URL,
    formattedQuery: string,
    globalRowCountVar: string,
    groupedRowCountVar: string,
}): Promise<CountPayload> {
    const res = await requestAsSparqlTableResult(url, formattedQuery);

    const firstRow = res.results.bindings[0];
    if (!firstRow) throw new Error("No rows!");

    const maybeGlobalCount = firstRow[globalRowCountVar];
    if (!maybeGlobalCount) throw new Error("global count does not exist!");

    const globalCount = Number(maybeGlobalCount.value);

    const maybeGroupedCount = firstRow[groupedRowCountVar];
    if (!maybeGroupedCount) throw new Error("grouped count does not exist!");

    const groupedCount = Number(maybeGroupedCount.value);
    return { globalCount, groupedCount };
}

function querySelectionToCountQueryString({
    queryToWrap,
    globalLimit,
    idVars,
}: QuerySelection) {
    return formatUniversalPaginatorQueryCounter({
        queryToWrap,
        globalLimit,
        idVars,
        globalRowCountVar: "__global_count",
        groupedRowCountVar: "__grouped_count",
    });
}

function makeCountPayloadFetcher({
    queryToWrap,
    url,
    idVars,
    globalLimit,
}: {
    queryToWrap: string,
    url: URL,
    idVars: string[],
    globalLimit: number,
}): () => Promise<CountPayload> {
    const globalRowCountVar = "__global_count";
    const groupedRowCountVar = "__grouped_count";

    const formattedQuery = queryToWrap && formatUniversalPaginatorQueryCounter({
        queryToWrap,
        globalRowCountVar,
        groupedRowCountVar,
        idVars,
        globalLimit,
    });

    return () => tryGettingCount({
        url,
        formattedQuery,
        globalRowCountVar,
        groupedRowCountVar,
    });
}

type QuerySelection = Parameters<typeof formatUniversalPaginatorQuery>[0];

function QueryResult({
    tableData,
    querySelection,
    onQuerySelectionChange,
    columnRenamer,
    countPayload,
}: {
    tableData: SparqlTableResult,
    querySelection: QuerySelection,
    onQuerySelectionChange: (newValue: QuerySelection) => void,
    columnRenamer: (oldName: string) => string,
    countPayload?: CountPayload,
}) {
    const pageSize = querySelection.groupLimit;
    const pagination = {
        pageIndex: querySelection.groupOffset / pageSize,
        pageSize,
    };

    function renameCols(row: MulticardinalRow): MulticardinalRow {
        function renameObj<T>(item: {[k:string]: T}): {[k: string]: T} {
            return Object.fromEntries(
                Object.entries(item).map(([k, v]) => [columnRenamer(k), v])
            );
        }

        return {
            idCols: row.idCols.map(columnRenamer),
            restCols: row.restCols.map(columnRenamer),
            idValues: renameObj(row.idValues),
            restValues: renameObj(row.restValues),
        };
    }

    const rows = deduplicateTable(tableData, querySelection.idVars).map(renameCols);

    return (
        <MultiCardinalTableServer
            rows={rows}
            countPayload={countPayload}
            pagination={pagination}
            onPaginationChange={({ pageIndex, pageSize }) => onQuerySelectionChange({
                ...querySelection,
                groupOffset: pageIndex * pageSize,
                groupLimit: pageSize,
            })}
        />
    );
}

function DebugInformation({
    selection,
    querySelection,
    counterQueryResult,
    queryResult,
}: {
    selection: ComplexPropertySelection,
    querySelection: QuerySelection | null,
    counterQueryResult: UseQueryResult<CountPayload>,
    queryResult: UseQueryResult<SparqlTableResult>,
}) {
    function QueryDropdown({ title, value}: { title: string, value: string }) {
        return (
            <CollapsedInfo title={title}>
                <pre>
                    {value}
                </pre>
            </CollapsedInfo>
        )
    };

    return (
        <>
            <SelectionDisplay selection={selection} />
            <QueryDisplay selection={selection} />
            {querySelection ? (
                <>
                    <QueryDropdown
                        title="Paginated query"
                        value={formatUniversalPaginatorQuery(querySelection)}
                    />
                    <QueryDropdown
                        title="Paginated count query"
                        value={querySelectionToCountQueryString(querySelection)}
                    />
                </>
            ) : (
                <div className="text-gray-500 flex gap-1 items-center">
                    <Info className="size-4" />
                    <p>Make query selection to get additional info</p>
                </div>

            )}
            <div className="grid grid-cols-[auto_1fr] w-fit gap-x-2 gap-y-1">
                <p className="font-bold">Query count result</p>
                <pre>{JSON.stringify(counterQueryResult.data)}</pre>
                <div className="col-span-2 text-gray-500 flex gap-1 items-center ml-2">
                    <Info className="size-4" />
                    <p>
                        If globalCount equals globalLimit, the groupedCount is a minimum value,
                        not exact value.
                    </p>
                </div>

                <p className="font-bold">Query raw row count</p>
                <p>{queryResult.data ? queryResult.data.results.bindings.length : "no result"}</p>
                <div className="col-span-2 text-gray-500 flex gap-1 items-center ml-2">
                    <Info className="size-4" />
                    <p>
                        If raw count equals globalLimit, the rows are unreliable and should not be used.
                    </p>
                </div>
            </div>
        </>
    );
}

export default function PropertyQueryBuilder({
    url,
}: {
    url: URL,
}) {
    const [selection, setSelection] = useState(makeDefaultSelection);

    const [querySelection, setQuerySelection] = useState<QuerySelection | null>(null);

    const queryResult = useQuery({
        queryKey: ["PropertyQueryBuilder", "query", url, querySelection],
        queryFn: querySelection
               ? (() => requestAsSparqlTableResult(url, formatUniversalPaginatorQuery(querySelection)))
               : skipToken,
    });

    // NOTE: demangleVarName should always succeed in this case but we are adding a fallback just
    // in case.
    const labelMaker = (oldName: string): string => demangleVarName(oldName, selection) ?? oldName;

    const counterQueryResult = useQuery({
        queryKey: ["PropertyQueryBuilder", "queryCounter", url, querySelection],
        queryFn: querySelection
            ? (makeCountPayloadFetcher({
                url: url,
                queryToWrap: querySelection.queryToWrap,
                globalLimit: querySelection.globalLimit,
                idVars: querySelection.idVars,
            })) : skipToken,
    });

    const [paginationData, setPaginationData] = useState<PaginationData | null>(null);

    function updateQuerySelection() {
        if (!paginationData) return;
        setQuerySelection({
            ...paginationData,
            queryToWrap: formatQuery(selection),
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <H1>Debug information</H1>
            <DebugInformation
                {...{selection, querySelection, queryResult, counterQueryResult}}
            />

            <H1>Query results</H1>

            <Button
                variant="outline"
                onClick={updateQuerySelection}
                disabled={!paginationData}
            >
                Query {queryResult.isLoading && <Spinner />}
            </Button>

            {queryResult.data && querySelection && (
                /* NOTE: Subtracting a healthy margin so that users can scroll past query content
                 * without explicitly dragging a root scrollbar */
                <div className="h-[calc(100vh-8rem)] overflow-y-auto">
                    <QueryResult
                        querySelection={querySelection}
                        onQuerySelectionChange={setQuerySelection}
                        tableData={queryResult.data}
                        countPayload={counterQueryResult.data}
                        columnRenamer={labelMaker}
                    />
                </div>
            )}

            <H1>Property selection</H1>
            <ComplexPropertySelector
                selection={selection}
                onSelectionChange={setSelection}
                rdfTypeFetcher={() => getRdfTypes(url)}
                dataPropFetcher={async (rdfType) => {
                    const types = await getTypeSuggestions(url, rdfType);
                    return types.map((val) => ({
                        value: val,
                        label: `(as data) ${val}`,
                    }));
                }}
                objectPropFetcher={async (rdfType) => {
                    const types = await getTypeSuggestions(url, rdfType);
                    return types.map((val) => ({
                        value: val,
                        label: `(as obj) ${val}`,
                    }));
                }}
            />
            <H1>Limiting</H1>
            <LimitSection
                selection={selection}
                paginationData={paginationData}
                onPaginationDataChange={setPaginationData}
                labelMaker={labelMaker}
            />
        </div>
    );
}
