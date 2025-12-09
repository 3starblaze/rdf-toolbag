import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input"
import { createArchetypesForTypeQuery, createDefaultQuery, createFindByArchetypeQuery, createTypeCountQuery, createTypePropertiesQuery, type SparqlTableResult } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import StateGuard from "@/components/state_guard";
import GuardedTableView from "@/components/guarded_table_view";
import TypeCountInfo from "./type_count_data";
import PaginatedChart from "@/components/paginated_chart";
import { createColumnHelper, type PaginationState } from "@tanstack/react-table";
import { defaultPagination } from "@/components/paginated_table";
import PaginatedTable from "@/components/paginated_table";
import ArchetypeMatrix from "./archetype_matrix";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";

function tryMakingUrl(urlName: string): URL | null {
    try {
        return new URL(urlName);
    } catch (e) {
        return null;
    }
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

function DistinctPropInfo({
    url,
}: {
    url: URL,
}) {
    const [rdfType, setRdfType] = useState<string | null>(null);

    const typeCountqueryRes = useQuery({
        queryKey: ["typeCount"],
        queryFn: createTypeCountQuery({ sparqlURL: url }),
    });

    // NOTE: Set initial rdfType effect
    useEffect(() => {
        const {data} = typeCountqueryRes;
        if (!data) return;
        if (rdfType !== null) return; // NOTE: If the value is set, don't override it

        // FIXME: You are assuming the data shape. Fix the query to give results properly.
        const firstType = data.results.bindings[0]["obj"].value;
        setRdfType(firstType);
    }, [typeCountqueryRes.data]);

    const queryRes = useQuery({
        queryKey: ["typeCount", `<${rdfType}>`],
        queryFn: createTypePropertiesQuery({ sparqlURL: url }),
        enabled: rdfType !== null,
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
            <p className="font-bold">RDF type</p>
            <select
                className="border-2 p-2 w-fit"
                defaultValue={rdfType || ""}
                onChange={(e) => setRdfType(e.target.value)}
            >
                {(typeCountqueryRes.data && typeCountqueryRes.data.results.bindings.map((item) => {
                    const typeOption = item["obj"].value;
                    return (
                        <option
                            value={typeOption}
                        >
                            {typeOption}
                        </option>
                    );
                }))}
            </select>

            <p className="font-bold">Available properties</p>

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

            {(rdfType !== null) && (
                <>
                    <p className="font-bold">Available archetypes</p>
                    {/* HACK: adding angled brackets to type */}
                    <ArchetypeInfo url={url} rdfType={`<${rdfType}>`} properties={queryRes.data} />
                    <p className="font-bold">Data for archetype:</p>
                    <pre className="text-sm">{JSON.stringify(exampleArchetype, undefined, 4)}</pre>
                    {/* HACK: adding angled brackets to type */}
                    <DataByArchetype url={url} properties={exampleArchetype} rdfType={`<${rdfType}>`} />
                </>
            )}
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

    const [pagination, setPagination] = useState<PaginationState>(defaultPagination);

    type TData = Exclude<(typeof queryRes.data), undefined>[number];

    const columnHelper = createColumnHelper<TData>();

    const matrixView = (data: TData[]) => properties ? (
        <ArchetypeMatrix
            data={data}
            allProperties={properties}
            pagination={pagination}
            onPaginationChange={setPagination}
        />
    ): (<></>);

    const sparseView = (data: TData[]) => (
        <PaginatedTable
            data={data}
            pagination={pagination}
            onPaginationChange={setPagination}
            columns={[
                columnHelper.accessor("archetype", {
                    header: "Archetype",
                    cell: ({ getValue }) => (
                        <pre>
                            {JSON.stringify([...getValue().values()], undefined, 4)}
                        </pre>
                    ),
                }),
                columnHelper.accessor("count", {
                    header: "Count",
                    cell: ({ getValue }) => (
                        <div>{getValue()}</div>
                    ),
                }),
            ]}
        />
    );

    const [isMatrixView, setIsMatrixView] = useState(true);

    return (
        <div className="flex flex-col gap-2">
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <>
                        <PaginatedChart
                            data={data}
                            pagination={pagination}
                            valueDataKey="count"
                        />
                        {/* NOTE: This probably should have been a tab but this will do */}
                        <div className="flex gap-2">
                            <Button
                                variant={isMatrixView ? "default" : "outline"}
                                onClick={(() => setIsMatrixView(true))}
                            >
                                Matrix view
                            </Button>
                            <Button
                                variant={!isMatrixView ? "default" : "outline"}
                                onClick={() => setIsMatrixView(false)}
                            >
                                Sparse view
                            </Button>
                        </div>
                        {isMatrixView ? matrixView(data) : sparseView(data)}
                    </>
                )}
            />
        </div>
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
        queryFn: createFindByArchetypeQuery({ sparqlURL: url }),
        enabled,
    });

    return (
        <GuardedTableView queryRes={queryRes} />
    );
}

interface SectionInfo {
    title: string,
    value: string,
    content: React.ReactNode,
}

function ContentSection({
    url,
}: {
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

    const pinnedUrl = useStore((store) => store.pinnedUrl);
    const setPinnedUrl = useStore((store) => store.setPinnedUrl);

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
                    Pin
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
