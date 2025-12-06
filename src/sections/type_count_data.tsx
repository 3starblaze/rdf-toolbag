import GuardedTableView from "@/components/guarded_table_view";
import { createTypeCountQuery } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";

export default function TypeCountInfo({
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
