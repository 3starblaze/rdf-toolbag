import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    createTypeCountQuery,
    createTypePropertiesQuery,
} from "@/sparql_queries";
import { useStore } from "@/store";
import StateGuard from "@/components/state_guard";
import ArchetypeInfo from "./archetype_info";
import DataByArchetype from "./data_by_archetype";

export default function PropInfo({
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

    const pinnedArchetype = useStore((store) => store.pinnedArchetype);

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
                    <p className="font-bold">Data for archetype</p>
                    {pinnedArchetype ? (
                        <>
                            <pre className="text-sm">
                                {JSON.stringify([...pinnedArchetype], undefined, 4)}
                            </pre>
                            {/* HACK: adding angled brackets to type */}
                            <DataByArchetype
                                url={url}
                                properties={[...pinnedArchetype]}
                                rdfType={`<${rdfType}>`}
                            />
                        </>
                    ) : (
                        <>
                            <p className="text-gray-500">No archetype selected!</p>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
