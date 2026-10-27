// Dev-only playground for iterating on MultiCardinalTableServer versions.
// Served by `playground.html` via `npm run dev` (open /playground.html). Not part of the lib build.
import { StrictMode, memo, useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { requestAsSparqlTableResult } from "@/sparql_queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiCardinalTableServer as MulticardinalTableV2 } from "./index";
import { MultiCardinalTableServer as MulticardinalTableLegacy } from "@/components/MultiCardinalTableServer";
import { findVars, optimize } from "@/query-util";

const VERSION_NAMES = [
    "optimized v2 (multicardinal-table/index.tsx)",
    "v2 (multicardinal-table/index.tsx)",
    "legacy (components/MultiCardinalTableServer.tsx)",
] as const;
type VersionName = typeof VERSION_NAMES[number];

const DEFAULT_ENDPOINT = "http://localhost:3030/ds/sparql";
const DEFAULT_QUERY = `SELECT ?s ?p ?o WHERE {
  ?s ?p ?o
}
LIMIT 100`;

interface FormState {
    version: VersionName,
    endpoint: string,
    query: string,
    rawRowLimit: number,
    counterLimit: number,
}

// NOTE: Naive extraction of projected variables from the SELECT clause. Doesn't handle `SELECT *`
// or nested subqueries, which is fine for a playground.
function extractSelectVars(query: string): string[] {
    try {
        return findVars({ query });
    } catch (e) {
        return [];
    }
}

interface TableHostProps {
    version: VersionName,
    endpoint: string,
    baseQuery: string,
    idVars: string[],
    rawRowLimit: number,
    counterLimit: number,
}

// NOTE: Memoized so that typing in the draft inputs doesn't re-render the table, which would
// recreate its QueryClient (see the version components) and refetch on every keystroke.
const TableHost = memo(function TableHost({
    version,
    endpoint,
    baseQuery,
    idVars,
    rawRowLimit,
    counterLimit,
}: TableHostProps) {
    const queryCallback = useCallback(
        ({ query, signal }: { query: string, signal?: AbortSignal }) => requestAsSparqlTableResult(
            new URL(endpoint),
            query,
            signal,
        ),
        [endpoint],
    );

    const optimizedQueryCallback = useCallback(
        ({ query, signal }: { query: string, signal?: AbortSignal }) => {
            const optimizedQuery = optimize(query);

            return requestAsSparqlTableResult(new URL(endpoint), optimizedQuery, signal);
        },
        [endpoint],
    );

    const isOptimized = version === "optimized v2 (multicardinal-table/index.tsx)";
    const isLegacy = version === "legacy (components/MultiCardinalTableServer.tsx)";

    // NOTE: Only the legacy table still takes a counter limit
    if (isLegacy) {
        return (
            <MulticardinalTableLegacy
                queryCallback={queryCallback}
                baseQuery={baseQuery}
                idVars={idVars}
                rawRowLimit={rawRowLimit}
                counterLimit={counterLimit}
            />
        );
    }

    return (
        <MulticardinalTableV2
            queryCallback={isOptimized ? optimizedQueryCallback : queryCallback}
            baseQuery={baseQuery}
            idVars={idVars}
            rawRowLimit={rawRowLimit}
        />
    );
});

function Playground() {
    const [form, setForm] = useState<FormState>({
        version: "optimized v2 (multicardinal-table/index.tsx)",
        endpoint: DEFAULT_ENDPOINT,
        query: DEFAULT_QUERY,
        rawRowLimit: 1000,
        counterLimit: 10000,
    });
    const [applied, setApplied] = useState<FormState>(form);
    const [idVars, setIdVars] = useState<string[]>([]);

    const detectedVars = useMemo(() => extractSelectVars(form.query), [form.query]);

    function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function toggleIdVar(name: string, checked: boolean) {
        setIdVars((prev) => {
            if (checked) return prev.includes(name) ? prev : [...prev, name];
            return prev.filter((v) => v !== name);
        });
    }

    function run() {
        // Drop idVars that no longer exist in the query being run.
        const vars = extractSelectVars(form.query);
        setIdVars((prev) => prev.filter((v) => vars.includes(v)));
        setApplied({ ...form });
    }

    function onQueryKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            run();
        }
    }

    return (
        <div className="min-h-screen p-4 flex flex-col gap-4">
            <header className="flex items-center justify-between border-b border-gray-500 pb-2">
                <h1 className="text-lg font-bold">MulticardinalTable playground</h1>
                <span className="text-xs text-gray-500">Dev only · Ctrl/Cmd+Enter to run</span>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
                <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-sm">
                        Version
                        <select
                            className="border rounded-md p-2 bg-white"
                            value={form.version}
                            onChange={(e) => {
                                const version = e.target.value as VersionName;
                                updateForm("version", version);
                                setApplied((prev) => ({ ...prev, version }));
                            }}
                        >
                            {VERSION_NAMES.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                        Endpoint URL
                        <Input
                            value={form.endpoint}
                            onChange={(e) => updateForm("endpoint", e.target.value)}
                            placeholder="https://example.org/sparql"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                        Query
                        <Textarea
                            className="font-mono text-xs min-h-48"
                            value={form.query}
                            onChange={(e) => updateForm("query", e.target.value)}
                            onKeyDown={onQueryKeyDown}
                            spellCheck={false}
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1 text-sm">
                            rawRowLimit
                            <Input
                                type="number"
                                value={form.rawRowLimit}
                                onChange={(e) => updateForm("rawRowLimit", Number(e.target.value))}
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                            counterLimit
                            <Input
                                type="number"
                                value={form.counterLimit}
                                onChange={(e) => updateForm("counterLimit", Number(e.target.value))}
                            />
                        </label>
                    </div>

                    <Button className="cursor-pointer self-start" onClick={run}>
                        Run
                    </Button>
                </div>

                <div className="flex flex-col gap-2 text-sm">
                    <span className="font-semibold">idVars</span>
                    {detectedVars.length === 0 ? (
                        <p className="text-gray-500">
                            No projected variables detected in the query (SELECT * is not supported).
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {detectedVars.map((name) => (
                                <label key={name} className="flex items-center gap-1 font-mono">
                                    <input
                                        type="checkbox"
                                        checked={idVars.includes(name)}
                                        onChange={(e) => toggleIdVar(name, e.target.checked)}
                                    />
                                    ?{name}
                                </label>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-500">
                        Selected: {idVars.length ? idVars.map((v) => `?${v}`).join(", ") : "none"}
                    </p>
                </div>
            </section>

            <section className="border-t border-gray-500 pt-4 overflow-x-auto">
                <TableHost
                    version={applied.version}
                    endpoint={applied.endpoint}
                    baseQuery={applied.query}
                    idVars={idVars}
                    rawRowLimit={applied.rawRowLimit}
                    counterLimit={applied.counterLimit}
                />
            </section>
        </div>
    );
}

if (import.meta.env.DEV) {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <Playground />
        </StrictMode>,
    );
}
