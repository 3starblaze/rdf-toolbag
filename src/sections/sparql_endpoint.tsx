import { useState } from "react";
import { Input } from "@/components/ui/input"

interface SparqlTableResult {
    head: {
        vars: string[],
    },
    results: {
        bindings: {
            [key: string]: {
                type: string,
                value: string,
            }
        }[],
    },
}

function SparqlTableResultTable({
    data
}: {
    data: SparqlTableResult
}) {
    const cols = data.head.vars;
    const rows = data.results.bindings;

    return (
        <table>
            <tr className="bg-gray-200">
                {cols.map((col) => (<th key={col}>{col}</th>))}
            </tr>
            {rows.map((row, i) => (
                <tr
                    key={i}
                    className="even:bg-gray-100"
                >
                    {cols.map((col) => (
                        <td key={col} className="px-4 py-2">
                            {row[col].value}
                        </td>
                    ))}
                </tr>
            ))}
        </table>
    );
}

function tryMakingUrl(urlName: string): URL | null {
    try {
        return new URL(urlName);
    } catch (e) {
        return null;
    }
}

export default function SparqlEndpoint() {
    const endpointInputId = "app-sparql-endpoint";

    const [endpointUrlString, setEndpointUrlString] = useState("");

    const maybeUrl = tryMakingUrl(endpointUrlString);

    const [queryRes, setQueryRes] = useState<null | SparqlTableResult>(null);

    const defaultQuery = `SELECT *
WHERE {
  ?s ?p ?o .
} LIMIT 10`;

    const tryQueryingEndpoint = async () => {
        if (!maybeUrl) return;

        maybeUrl.searchParams.set("query", defaultQuery);

        const req = new Request(maybeUrl);

        // FIXME: Validate data shape
        const data = await fetch(req).then((res) => res.json()) as SparqlTableResult;
        setQueryRes(data);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="max-w-prose flex flex-col gap-2">
                <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
                    <label
                        className="w-max text-gray-800"
                        htmlFor={endpointInputId}
                    >
                        SparQL endpoint
                    </label>
                    <Input
                        className="border-2"
                        name={endpointInputId}
                        value={endpointUrlString}
                        onChange={(e) => setEndpointUrlString(e.target.value)}
                    />
                </div>

                {(maybeUrl === null) && (
                    <p className="text-red-500 text-sm">
                        Entered URL is not valid!
                    </p>
                )}

                <button
                    className="bg-gray-200 px-2 py-1 rounded-md border-gray-500 border cursor-pointer"
                    onClick={tryQueryingEndpoint}
                >
                    Query
                </button>
            </div>

            {(queryRes === null) ? (
                <p className="text-gray-500 max-w-prose">
                    No data to show. Find a SparQL endpoint and press "Query" to get sample results!
                </p>
            ) : (
                <div className="flex flex-col gap-1">
                    <h2 className="text-md font-bold">Query result</h2>
                    <SparqlTableResultTable data={queryRes} />
                </div>
            )}
            <div>

            </div>
        </div>
    );
}
