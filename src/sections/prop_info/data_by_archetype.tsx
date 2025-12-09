import { useQuery } from "@tanstack/react-query";
import {
    createFindByArchetypeQuery,
} from "@/sparql_queries";
import GuardedTableView from "@/components/guarded_table_view";

export default function DataByArchetype({
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
