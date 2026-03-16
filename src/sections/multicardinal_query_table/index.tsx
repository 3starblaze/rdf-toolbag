import ExamineSparql from "@/components/examine_sparql";
import MultiCardinalTable from "@/components/multi-cardinal-table";
import { PropertySelector } from "@/components/property_selector";
import StateGuard from "@/components/state_guard";
import { Button } from "@/components/ui/button";
import { tableToRows } from "@/multi-cardinal-table-util";
import { multiCardinalTableAsSelectQuery, typePropertiesQuery } from "@/sparql_queries";
import { useStore } from "@/store";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

function isArrayEqual(a: unknown[], b: unknown[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export default function SampleMulticardinalQuery({
    url,
}: {
    url: URL,
}) {
    const pinnedRdfType = useStore((store) => store.pinnedRdfType);
    const rdfType = `<${pinnedRdfType}>`;
    const idLimit = 10;

    const [uncommittedProperties, setUncommittedProperties] = useState<string[]>([]);
    const [properties, setProperties] = useState<string[]>([]);

    const areUncomittedPropertiesDifferent = isArrayEqual(uncommittedProperties, properties);

    const {
        tanstackQueryOptions,
        queryString,
    } = multiCardinalTableAsSelectQuery(url, rdfType, properties, idLimit);
    const queryRes = useQuery(tanstackQueryOptions);

    const {
        tanstackQueryOptions: typePropertiesQueryOptions,
    } = typePropertiesQuery(url, rdfType);

    const typePropertiesQueryRes = useQuery(typePropertiesQueryOptions);
    const suggestionData = typePropertiesQueryRes.data || [];

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Sample multicardinal query</h1>
                <ExamineSparql query={queryString} />
            </div>
            <div className="flex flex-col gap-2">
                <p>Select properties</p>
                <PropertySelector
                    value={uncommittedProperties}
                    onValueChange={setUncommittedProperties}
                    suggestions={suggestionData.map((item) => ({
                        label: item,
                        value: item,
                    }))}
                />
                <div className="flex gap-2">
                    <Button
                        className="w-fit"
                        variant="outline"
                        onClick={() => setProperties(uncommittedProperties)}
                        disabled={areUncomittedPropertiesDifferent}
                    >
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setUncommittedProperties(properties)}
                        disabled={areUncomittedPropertiesDifferent}
                    >
                        Revert
                    </Button>
                </div>
            </div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <MultiCardinalTable rows={tableToRows(data)} />
                )}
            />
        </div>
    );
}
