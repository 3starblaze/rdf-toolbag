import ExamineSparql from "@/components/examine_sparql";
import SparqlGraphResultTable from "@/components/sparql_graph_result_table";
import StateGuard from "@/components/state_guard";
import { defaultConstructQuery } from "@/sparql_queries";
import { useQuery } from "@tanstack/react-query";

export default function DefaultConstructQuery({
    url,
}: {
    url: URL,
}) {
    const { tanstackQueryOptions, queryString } = defaultConstructQuery(url);

    const queryRes = useQuery(tanstackQueryOptions);

    return (
        <div>
            <div className="flex flex-row gap-2 items-center">
                <h1 className="text-lg mt-2 mb-4 font-bold">Sample data</h1>
                <ExamineSparql query={queryString} />
            </div>
            <StateGuard
                queryRes={queryRes}
                successComponent={(data) => (
                    <SparqlGraphResultTable
                         data={data}
                    />
                )}
            />
        </div>
    );
}
