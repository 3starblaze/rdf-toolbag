import {
    type RdfTerm,
} from "@/sparql_queries";

// NOTE: This closely resembles official sparql json for familiarity
export interface MulticardinalTableData {
    /**
     * Column names that are marked as id.
     */
    idCols: string[],
    /**
     * Remaining column names.
     */
    restCols: string[],
    rows: {
        /**
         * Id column values.
         *
         * If the value is null, it's unbound.
         */
        idValues: { [name: string]: RdfTerm | null },
        /**
         * Remaining column values.
         */
        restValues: { [name: string]: RdfTerm[] },
    }[],
}
