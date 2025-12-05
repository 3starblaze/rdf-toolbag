import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input"
import { createArchetypesForTypeQuery, createDefaultQuery, createFindByArchetypeQuery, createTypeCountQuery, createTypePropertiesQuery, type SparqlTableResult } from "@/sparql_queries";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

function StateGuard<T, E extends Error>({
    queryRes,
    successComponent,
}: {
    queryRes: UseQueryResult<T, E>,
    successComponent: (val: T) => React.ReactNode,
}) {
    const { isPending, isError, data, error } = queryRes;

    if (isPending) {
        return (
            <p>Pending...</p>
        );
    }

    if (isError) {
        return <p>Error: {error.message}</p>
    }

    return successComponent(data);
}

function GuardedTableView<E extends Error>({
    queryRes,
}: {
    queryRes: UseQueryResult<SparqlTableResult, E>,
}) {
    return (
        <StateGuard
            queryRes={queryRes}
            successComponent={(data) => (<SparqlTableResultTable data={data} />)}
        />
    );
}

function DefaultSampleData({
    url,
}: {
    url: URL,
}) {
    const queryRes = useQuery({
        queryKey: ["defaultQuery"],
        queryFn: createDefaultQuery({ sparqlURL: url }),
    });

    return (
        <GuardedTableView queryRes={queryRes} />
    );
}

function TypeCountInfo({
    url,
}: {
    url: URL,
}) {
    const queryRes = useQuery({
        queryKey: ["typeCount"],
        queryFn: createTypeCountQuery({ sparqlURL: url }),
    });

    return (
        <GuardedTableView queryRes={queryRes} />
    );
}

function DistinctPropInfo({
    url,
}: {
    url: URL,
}) {
    const rdfType = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement>";

    const queryRes = useQuery({
        queryKey: ["typeCount", rdfType],
        queryFn: createTypePropertiesQuery({ sparqlURL: url}),
    });

    const exampleArchetype = [
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://ldf.fi/schema/yoma/event_no",
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#object",
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate",
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject",
    ];

    return (
        <div className="flex flex-col gap-2">
            <p>For property <span className="text-gray-500">{rdfType}</span></p>
            <ArchetypeInfo url={url} rdfType={rdfType} properties={queryRes.data} />

            <p className="font-bold">Data for archetype:</p>
            <pre className="text-sm">{JSON.stringify(exampleArchetype, undefined, 4)}</pre>
            <DataByArchetype url={url} properties={exampleArchetype} rdfType={rdfType} />

            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <ul>
                        {data.map((val) => (
                            <li
                                key={val}
                                className="text-sm"
                            >{val}</li>
                        ))}
                    </ul>
                )}
            />
        </div>
    );
}

function ArchetypeInfo({
    url,
    rdfType,
    properties,
}: {
    url: URL,
    rdfType: string | undefined,
    properties: string[] | undefined,
}) {
    const enabled = (rdfType !== undefined) && (properties !== undefined);

    const queryRes = useQuery({
        // NOTE: we cast away undefined because undefined is not going to appear on enabled: true
        queryKey: ["typeCount", rdfType as string, properties as string[]],
        queryFn: createArchetypesForTypeQuery({ sparqlURL: url }),
        enabled,
    });

    return (
        <GuardedTableView queryRes={queryRes} />
    );
}

function DataByArchetype({
    url,
    rdfType,
    properties,
}: {
    url: URL,
    rdfType: string | undefined,
    properties: string[] | undefined,
}) {
    const limit = 10;

    const enabled = (rdfType !== undefined) && (properties !== undefined);

    const queryRes = useQuery({
        queryKey: ["findByArchetypeQuery", rdfType as string, properties as string[], limit],
        queryFn: createFindByArchetypeQuery({ sparqlURL: url}),
        enabled,
    });

    return (
        <GuardedTableView queryRes={queryRes} />
    );
}

/**
 * Show potentially interesting information when URL is established.
 */
function TemporaryStatistics({
    url,
}: {
    url: URL,
}) {
    return (
        <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Prop info</h2>
            <DistinctPropInfo url={url} />
            <h2 className="text-lg font-bold">Sample data</h2>
            <DefaultSampleData url={url} />
            <h2 className="text-lg font-bold">Type-count data</h2>
            <TypeCountInfo url={url} />
        </div>
    );
}

interface SectionInfo {
    title: string,
    value: string,
    content: React.ReactNode,
}

function ContentSection({
    url,
}:{
    url: URL,
}) {
    const sectionInfos: SectionInfo[] = [
        {
            title: "Type-count data",
            value: "typeCountData",
            content: (<TypeCountInfo url={url} />),
        },
        {
            title: "Sample data",
            value: "sample-data",
            content: (<DefaultSampleData url={url} />),
        },
        {
            title: "Prop info",
            value: "prop-info",
            content: (<DistinctPropInfo url={url} />),
        }
    ];


    return (
        <div>
            <Tabs defaultValue={sectionInfos[0].value}>
                <TabsList>
                    {sectionInfos.map(({ value, title }) => (
                        <TabsTrigger key="value" value={value}>{title}</TabsTrigger>
                    ))}
                </TabsList>
                {sectionInfos.map(({ value, content}) => (
                    <TabsContent key={value} value={value}>{content}</TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

export default function SparqlEndpoint() {
    const endpointInputId = "app-sparql-endpoint";

    const [endpointUrlString, setEndpointUrlString] = useState("");

    const maybeUrl = tryMakingUrl(endpointUrlString);

    const [pinnedUrl, setPinnedUrl] = useState<URL | null>(null);

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
                    onClick={() => {
                        if (maybeUrl) {
                            setPinnedUrl(maybeUrl);
                        }
                    }}
                >
                    Query
                </button>
            </div>

            {(pinnedUrl === null) ? (
                <p className="text-gray-500 max-w-prose">
                    No data to show. Find a SparQL endpoint and press "Query" to get sample results!
                </p>
            ) : (
                <ContentSection url={pinnedUrl} />
            ) }
        </div>
    );
}
