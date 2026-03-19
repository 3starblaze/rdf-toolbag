import MultiCardinalTable from "@/components/multi-cardinal-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deduplicateTable, PropertySelector } from "@/lib_index";
import { formatUniversalPaginatorQuery, requestAsSparqlTableResult, RequestError } from "@/sparql_queries";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Suspense, use, useMemo, useState, type ReactNode } from "react";
import { Match } from "effect";

type ErrorDisplayMessage = null | { type: "unknownError" } | { type: "validationError", msg: string }

function DisplayErrorResponse({
    messagePromise,
}: {
    messagePromise: Promise<ErrorDisplayMessage>,
}): ReactNode {
    return Match.value(use(messagePromise)).pipe(
        Match.when(null, () => <></>),
        Match.when({ type: "validationError" }, ({ msg }) => (
            <p>
                Received validation error:<br />
                {msg}
            </p>
        )),
        Match.orElse(() => <p>Received unexpected error!</p>)
    );
}

function ErrorResponse({
    error,
}: {
    error: Error | null,
}): ReactNode {
    const messagePromise: Promise<ErrorDisplayMessage> = useMemo(async () => {
        return Match.value(error).pipe(
            Match.withReturnType<Promise<ErrorDisplayMessage>>(),
            Match.when(null, () => Promise.resolve(null)),
            Match.when(Match.instanceOf(RequestError), ({ response }) => (
                (response.status === 400)
                    ? response.clone().text().then((msg) => ({ type: "validationError", msg }))
                    : Promise.resolve(null)
            )),
            Match.orElse(() => Promise.resolve({ type: "unknownError" })),
        );
    }, [error]);

    return (
        <Suspense fallback={<p>Preparing error...</p>}>
            <DisplayErrorResponse messagePromise={messagePromise} />
        </Suspense>
    );
}

function FormattedQuery({
    queryString,
    idVars,
    className,
}: {
    queryString?: string,
    idVars: string[],
} & React.ComponentProps<"div">) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <p className="font-bold">Formatted query</p>
            <pre>
                {queryString
                    ? formatUniversalPaginatorQuery({
                        queryToWrap: queryString,
                        idVars,
                        globalLimit: 1000,
                        groupLimit: 10,
                        groupOffset: 0,
                    })
                    : (<p>No query to format</p>)}
            </pre>
        </div>
    );
}

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

    const formattedQuery = validQueryState ? formatUniversalPaginatorQuery({
        queryToWrap: queryString,
        idVars: idCols,
        globalLimit: 1000,
        groupLimit: 10,
        groupOffset: 0,
    }) : undefined;

    const { data, isLoading, error } = useQuery({
        queryKey: ["PaginatedDeduplicationView", formattedQuery],
        queryFn: formattedQuery ? () => requestAsSparqlTableResult(url, formattedQuery) : skipToken,
        retry: (failureCount, error) => {
            // NOTE: Mimic default behavior
            if (failureCount === 3) return false;

            if (error instanceof RequestError) {
                const { response } = error;
                // NOTE: This is validation error, the request will never be successful and we
                // must stop trying
                if (response.status === 400) {
                    return false;
                }
            }

            return true;
        }
     });

    const deduplicatedData = data && deduplicateTable(data, idCols);

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Select properties</p>
            <PropertySelector
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

            <FormattedQuery idVars={idCols} queryString={draftQueryString} />

            <Button
                className="w-fit"
                disabled={draftQueryString === queryString}
                onClick={() => draftQueryString && setQueryString(draftQueryString)}
            >
                Save query
            </Button>

            <p>Results {isLoading && <Spinner />}</p>

            {deduplicatedData && (<MultiCardinalTable rows={deduplicatedData} />)}

            {error && <ErrorResponse error={error} />}
        </div>
    );
}
