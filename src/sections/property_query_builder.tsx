import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from "@/components/complex_property_selector";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatQuery } from "@/misc/complex_property_query_builder";
import { requestAsSparqlTableResult, typeCountQuery } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
                {formatQuery(selection)}
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

function useRdfTypesQuery({
    url,
}: {
    url: URL,
}) {
    const { tanstackQueryOptions } = typeCountQuery(url);
    const queryRes = useQuery(tanstackQueryOptions);
    return {
        ...queryRes,
        data: queryRes.data?.map((item) => ({ label: item.type, value: item.type })),
    };
}

async function getTypeSuggestions(url: URL, rdfType: string): Promise<string[]> {
    const limit = 100;
    const queryString = `SELECT DISTINCT ?p WHERE { ?s ?p ?o . ?s a <${rdfType}> } LIMIT ${limit}`;

    const res = await requestAsSparqlTableResult(url, queryString);
    return res.results.bindings.map((row) => row["p"].value);
}

export default function PropertyQueryBuilder({
    url,
}: {
    url: URL,
}) {
    const [selection, setSelection] = useState(makeDefaultSelection);

    const rdfTypesQuery = useRdfTypesQuery({url});

    const specialRdfType = "foobar";

    return (
        <div className="flex flex-col gap-4">
            <p>
                {"Enter type "}
                <span className="bg-blue-100">{specialRdfType}</span>
                {" for extra property suggestions."}
            </p>
            <SelectionDisplay selection={selection} />
            <QueryDisplay selection={selection} />
            <ComplexPropertySelector
                selection={selection}
                onSelectionChange={setSelection}
                rdfTypeFetcher={async () => rdfTypesQuery.data ?? []}
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
        </div>
    );
}
