import MultiCardinalTable from "@/components/multi-cardinal-table";
import { PropertySelector } from "@/components/property_selector";
import SparqlTableResultTable from "@/components/sparql_table_result_table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { deduplicateTable } from "@/multi-cardinal-table-util";
import { requestAsSparqlTableResult, RequestError } from "@/sparql_queries";
import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Match } from "effect";
import { Suspense, use, useMemo, useState, type ReactNode } from "react";


type ErrorDisplayMessage = null | { type: "unknownError" } | { type: "validationError", msg: string }

function DisplayErrorResponse({
    messagePromise
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

export default function DeduplicationView({
    url,
}: {
    url: URL,
}) {
    const [draftQueryString, setDraftQueryString] = useState("");
    const [queryString, setQueryString] = useState<string | null>(null);

    const [deduplicationEnabled, setDeduplicationEnabled] = useState(false);
    const [deduplicationIdCols, setDeduplicationIdCols] = useState<string[]>([]);


    const { data, isLoading, error } = useQuery({
        queryKey: ["DeduplicationView", queryString],
        queryFn: (queryString === null)
               ? skipToken
               : () => requestAsSparqlTableResult(url, queryString),
        retry: (failureCount, error) => {
            console.log({ failureCount, error });
            // NOTE: Mimick default behavior
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

    const deduplicatedData = deduplicationEnabled
                          && data
                          && deduplicateTable(data, deduplicationIdCols);

    const suggestionsQueryResult = {
        ...deduplicatedData,
        data: data?.head.vars.map((s) => ({ label: s, value: s })),
    } as UseQueryResult<{label: string, value: string}[], Error>;

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Deduplication view</h1>
            </div>
            <p className="mb-4">
                Write your query and apply deduplication to the results.
            </p>

            <Field orientation="horizontal" className="mb-4">
                <Checkbox
                    id="deduplication-enabled"
                    checked={deduplicationEnabled}
                    onCheckedChange={
                        (checkedState) => setDeduplicationEnabled(checkedState === true)
                    }
                />
                <FieldLabel htmlFor="deduplication-enabled">
                    Enable deduplication
                </FieldLabel>
            </Field>

            <PropertySelector
                suggestionsQueryResult={suggestionsQueryResult}
                value={deduplicationIdCols}
                onValueChange={setDeduplicationIdCols}
            />

            <div className="">
                <p className="mb-2 text-sm font-bold">Query</p>
                <Textarea
                    rows={15}
                    value={draftQueryString}
                    onChange={(e) => setDraftQueryString(e.target.value)}
                    className="font-mono resize"
                />
            </div>

            <div className="flex flex-col gap-2 mt-4">
                <Button
                    className="mt-5 w-fit"
                    disabled={draftQueryString === queryString}
                    onClick={() => setQueryString(draftQueryString)}
                >
                    Query {isLoading && <Spinner />}
                </Button>

                <ErrorResponse error={error} />

                {deduplicatedData && (
                    <MultiCardinalTable rows={deduplicatedData} />
                )}
                {data && !deduplicatedData && (
                    <SparqlTableResultTable data={data} />
                )}
            </div>
        </div>
    );
}
