import type { UseQueryResult } from "@tanstack/react-query";
import StateGuard from "./state_guard";
import type { SparqlTableResult } from "@/sparql_queries";
import SparqlTableResultTable from "./sparql_table_result_table";

export default function GuardedTableView<E extends Error>({
    queryRes,
    ...props
}: {
    queryRes: UseQueryResult<SparqlTableResult, E>,
} & Omit<React.ComponentProps<typeof SparqlTableResultTable>, "data">) {
    return (
        <StateGuard
            queryRes={queryRes}
            successComponent={(data) => (
                <SparqlTableResultTable
                    data={data}
                    {...props}
                />)
            }
        />
    );
}
