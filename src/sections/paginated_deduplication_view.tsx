import { MultiCardinalTableServer } from "@/components/MultiCardinalTableServer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SyncPropertySelector } from "@/lib_index";
import { formatUniversalPaginatorQuery, requestAsSparqlTableResult } from "@/sparql_queries";
import { useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import { defaultPagination } from "@/components/table_pagination_bar";

// NOTE: Naive way of finding suggestions by matching everything that starts with question mark
// Maybe won't be correct all the time but for the most cases this will be helpful.
function findSuggestions(query: string): {value: string, label: string}[] {
    const matches = query.match(/\?\w+/g);
    if (!matches) return [];

    return matches
        // NOTE: Remove leading question mark
        .map((item) => item.slice(1))
        .map((item) => ({
            value: item,
            label: item,
        }));
}

function isArrayEqual(a: unknown[], b: unknown[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export default function PaginatedDeduplicationView({
    url,
}: {
    url: URL,
}) {
    const [draftQueryString, setDraftQueryString] = useState("");
    const [queryString, setQueryString] = useState<string|null>(null);

    const [draftIdCols, setDraftIdCols] = useState<string[]>([]);
    const [idCols, setIdCols] = useState<string[]>([]);

    const suggestions = findSuggestions(draftQueryString);

    const validQueryState = idCols.length !== 0 && queryString;

    const [pagination, setPagination] = useState<PaginationState>(defaultPagination);

    const groupLimit = pagination.pageSize;
    const groupOffset = pagination.pageSize * pagination.pageIndex;

    // TODO: Add globalLimit warning
    const globalLimit = 10000;

    const formattedQuery = validQueryState ? formatUniversalPaginatorQuery({
        queryToWrap: queryString,
        idVars: idCols,
        globalLimit,
        groupLimit,
        groupOffset,
    }) : undefined;

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Select properties</p>
            <SyncPropertySelector
                suggestions={suggestions}
                value={draftIdCols}
                onValueChange={setDraftIdCols}
            />
            <Button
                className="mt-5 w-fit"
                disabled={isArrayEqual(idCols, draftIdCols)}
                onClick={() => setIdCols(draftIdCols)}
            >
                Save properties
            </Button>

            <p className="text-sm font-bold">Query</p>

            <Textarea
                rows={15}
                value={draftQueryString}
                onChange={(e) => setDraftQueryString(e.target.value)}
                className="font-mono resize"
            />

            <p className="font-bold">Formatted query</p>
            <pre>
                {formattedQuery ?? "No query to format"}
            </pre>

            <Button
                className="w-fit"
                disabled={draftQueryString === queryString}
                onClick={() => draftQueryString && setQueryString(draftQueryString)}
            >
                Save query
            </Button>

            <p>Results</p>

            {queryString ? (
                <MultiCardinalTableServer
                    queryCallback={({ query }) => requestAsSparqlTableResult(url, query)}
                    baseQuery={queryString}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    rawRowLimit={globalLimit}
                    counterLimit={globalLimit}
                    idVars={idCols}
                />
            ) : (
                <p>No query is set!</p>
            )}
        </div>
    );
}
