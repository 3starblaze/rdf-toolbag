import {
    useEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
    typeCountQuery,
    typePropertiesQuery,
} from "@/sparql_queries";
import { useStore } from "@/store";
import StateGuard from "@/components/state_guard";
import ArchetypeInfo from "./archetype_info";
import DataByArchetype from "./data_by_archetype";
import { Combobox } from "@/components/ui/combobox";
import PaginatedTable from "@/components/paginated_table";
import ExamineSparql from "@/components/examine_sparql";

function PinnedRdfTypeCombobox({ url }: {
    url: URL,
}) {
    const { tanstackQueryOptions } = typeCountQuery(url);
    const typeCountQueryRes = useQuery(tanstackQueryOptions);

    const options = (typeCountQueryRes.data) ? (
        typeCountQueryRes.data.map((item) => {
            const typeOption = item.type
            return {
                label: typeOption,
                value: typeOption,
            };
        })
    ) : [];

    const value = useStore((store) => store.pinnedRdfType) ?? "";
    const setValue = useStore((store) => store.setPinnedRdfType);

    return (
        <Combobox
            options={options}
            unselectedLabel="Select type..."
            emptyLabel="No type found..."
            searchPlaceholder="Search type..."
            value={value}
            onValueChange={setValue}
        />
    );
}

export default function PropInfo({
    url,
}: {
    url: URL,
}) {
    const rdfType = useStore((store) => store.pinnedRdfType);
    const setRdfType = useStore((store) => store.setPinnedRdfType);

    const { tanstackQueryOptions: typeCountQueryOptions } = typeCountQuery(url);
    const typeCountqueryRes = useQuery(typeCountQueryOptions);

    // NOTE: Set initial rdfType effect
    useEffect(() => {
        const {data} = typeCountqueryRes;
        if (!data) return;
        if (rdfType !== null) return; // NOTE: If the value is set, don't override it

        const firstType = data[0].type;

        setRdfType(firstType);
    }, [typeCountqueryRes.data]);

    const { queryString, tanstackQueryOptions } = typePropertiesQuery(url, `<${rdfType}>`);

    const queryRes = useQuery({
        ...tanstackQueryOptions,
        enabled: rdfType !== null,
    });

    const pinnedArchetype = useStore((store) => store.pinnedArchetype);

    return (
        <div className="flex flex-col gap-2">
            <p className="font-bold">RDF type</p>

            <PinnedRdfTypeCombobox url={url} />

            <div className="flex flex-row gap-2 items-center">
                <p className="font-bold">Available properties</p>
                <ExamineSparql query={queryString} />
            </div>

            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <PaginatedTable
                        data={data}
                        columns={[
                            {
                                id: "prop",
                                accessorFn: (val) => val,
                            },
                        ]}
                    />
                )}
            />

            {(rdfType !== null) && (
                <>
                    {/* HACK: adding angled brackets to type */}
                    <ArchetypeInfo url={url} rdfType={`<${rdfType}>`} properties={queryRes.data} />
                    {pinnedArchetype ? (
                        <>
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
