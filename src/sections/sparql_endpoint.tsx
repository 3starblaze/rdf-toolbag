import { useState } from "react";
import { Input } from "@/components/ui/input"
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GuardedTableView from "@/components/guarded_table_view";
import TypeCountInfo from "./type_count_data";
import { useStore } from "@/store";
import PropInfo from "./prop_info/index";
import { defaultQuery } from "@/sparql_queries";
import { Button } from "@/components/ui/button";
import ExamineSparql from "@/components/examine_sparql";
import DefaultConstructQuery from "./default_construct_query";
import SampleMulticardinalQuery from "./multicardinal_query_table/index";

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
    const { tanstackQueryOptions, queryString } = defaultQuery(url);
    const queryRes = useQuery(tanstackQueryOptions);

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Sample data</h1>
                <ExamineSparql query={queryString} />
            </div>
            <GuardedTableView queryRes={queryRes} />
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
            content: (<PropInfo url={url} />),
        },
        {
            title: "Sample construct query",
            value: "sample-construct-query",
            content: (<DefaultConstructQuery url={url} />),
        },
        {
            title: "Sample multicardinal query",
            value: "sample-multicardinal-query",
            content: (<SampleMulticardinalQuery url={url} />),
        },
    ];


    return (
        <div>
            <Tabs defaultValue={sectionInfos[0].value}>
                <TabsList>
                    {sectionInfos.map(({ value, title }) => (
                        <TabsTrigger key="value" value={value}>{title}</TabsTrigger>
                    ))}
                </TabsList>
                {sectionInfos.map(({ value, content }) => (
                    <TabsContent key={value} value={value}>{content}</TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

/**
 * Section responsible for SparQL endpoint URL pinning.
 */
function EndpointInputSection() {
    const endpointInputId = "app-sparql-endpoint";

    const [endpointUrlString, setEndpointUrlString] = useState("");

    const maybeUrl = tryMakingUrl(endpointUrlString);

    const pinnedUrl = useStore((store) => store.pinnedUrl);
    const setPinnedUrl = useStore((store) => store.setPinnedUrl);

    const urlMatches = pinnedUrl?.toString() === endpointUrlString;

    return (
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

            <Button
                variant="outline"
                onClick={() => {
                    if (maybeUrl) {
                        setPinnedUrl(maybeUrl);
                    }
                }}
            >
                Pin
            </Button>

            <div className="flex flex-col gap-1 text-sm">
                {(maybeUrl === null) && (
                    <p className="text-red-500">
                        Entered URL is not valid!
                    </p>
                )}

                {!urlMatches && (
                    <div className="flex gap-2 items-center">
                        <p className="text-yellow-500">
                            Entered URL is not pinned!
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => setEndpointUrlString(
                                pinnedUrl ? pinnedUrl.toString() : ""
                            )}
                        >
                            Revert URL
                        </Button>
                    </div>
                )}

                {!pinnedUrl && (
                    <p className="text-gray-500">
                        Pin a URL in order to get more information about the endpoint!
                    </p>
                )}
            </div>
        </div>
    );
}

export default function SparqlEndpoint() {
    const pinnedUrl = useStore((store) => store.pinnedUrl);

    return (
        <div className="flex flex-col gap-4">
            <EndpointInputSection />

            {pinnedUrl && (
                <ContentSection url={pinnedUrl} />
            )}
        </div>
    );
}
