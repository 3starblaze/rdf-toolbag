import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from "@/components/complex_property_selector";
import { MultiCardinalTableServer } from "@/components/MultiCardinalTableServer";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SyncPropertySelector } from "@/lib_index";
import { formatQuery, sparqlVarRe } from "@/misc/complex_property_query_builder";
import { formatUniversalPaginatorQuery, formatUniversalPaginatorQueryCounter, requestAsSparqlTableResult, type SparqlTableResult } from "@/sparql_queries";
import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
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
                {formatQuery(selection).query}
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
    const formattedQuery = formatQuery(selection).query;
    const matches = formattedQuery.match(sparqlVarRe);
    // NOTE: Keep unique values and remove the leading "?" in matched var name
    return [...new Set(matches)].map((match) => match.slice(1));
}

function LimitSection({
    selection,
    paginationData,
    onPaginationDataChange: onPaginationDataChange,
}: {
    selection: ComplexPropertySelection,
    paginationData: PaginationData | null,
    onPaginationDataChange: (newValue: PaginationData | null) => void,
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
            label: value,
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

type QuerySelection = Parameters<typeof formatUniversalPaginatorQuery>[0];

function QueryResult({
    querySelection,
    onQuerySelectionChange,
    url,
}: {
    querySelection: QuerySelection,
    onQuerySelectionChange: (newValue: QuerySelection) => void,
    url: URL,
}) {
    const pageSize = querySelection.groupLimit;
    const pagination = {
        pageIndex: querySelection.groupOffset / pageSize,
        pageSize,
    };

    const {
        queryToWrap: baseQuery,
        globalLimit,
        idVars,
    } = querySelection;

    return (
        <MultiCardinalTableServer
            queryCallback={({ query }) => requestAsSparqlTableResult(url, query)}
            baseQuery={baseQuery}
            counterLimit={globalLimit}
            rawRowLimit={globalLimit}
            idVars={idVars}
            pagination={pagination}
            renderHeader={(colName) => {
                const parts = colName.split(">");
                return (
                    <div className="font-bold flex flex-col gap-1">
                        {parts.map((part, i) => (
                            <div className="flex items-start">
                                <span className="font-normal">
                                    {(i !== 0) && <ChevronRight className="size-4" />}
                                </span>
                                <span className="font-bold">{part}</span>
                            </div>
                        ))}
                    </div>
                );
            }}
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
    queryResult,
}: {
    selection: ComplexPropertySelection,
    querySelection: QuerySelection | null,
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

    const [paginationData, setPaginationData] = useState<PaginationData | null>(null);

    function updateQuerySelection() {
        if (!paginationData) return;
        setQuerySelection({
            ...paginationData,
            queryToWrap: formatQuery(selection).query,
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <H1>Debug information</H1>
            <DebugInformation
                {...{ selection, querySelection, queryResult }}
            />

            <H1>Query results</H1>

        <Button
            variant="outline"
            onClick={updateQuerySelection}
            disabled={!paginationData}
        >
            Query
        </Button>

            {
        querySelection && (
            /* NOTE: Subtracting a healthy margin so that users can scroll past query content
             * without explicitly dragging a root scrollbar */
            <div className="h-[calc(100vh-8rem)] overflow-y-auto">
                <QueryResult
                    url={url}
                    querySelection={querySelection}
                    onQuerySelectionChange={setQuerySelection}
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
            />
        </div>
    );
}
