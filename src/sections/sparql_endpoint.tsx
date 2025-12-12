import { useState } from "react";
import { Input } from "@/components/ui/input"
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GuardedTableView from "@/components/guarded_table_view";
import TypeCountInfo from "./type_count_data";
import { useStore } from "@/store";
import PropInfo from "./prop_info/index";
import { defaultQuery } from "@/sparql_queries";

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
    const queryRes = useQuery(defaultQuery(url));

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
            content: (<PropInfo url={url} />),
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
