import {
    type PaginationState,
} from "@tanstack/react-table";
import {
  type SparqlTableResult,
} from "@/sparql_queries";
import {
  type MulticardinalTableData
} from "@/multi-cardinal-table-util";

export interface Props {
    queryCallback: ({ query }: { query: string }) => Promise<SparqlTableResult>,
    baseQuery: string,
    idVars: string[],
    rawRowLimit: number,
    counterLimit: number,
    /** Current pagination state */
    pagination?: PaginationState,
    /** Callback invoked during pagination change. */
    onPaginationChange?: (state: PaginationState) => void,
    /** Component for overriding header cell render. */
    renderHeader?: (colName: string) => React.ReactNode,
}

export type Row = MulticardinalTableData["rows"][number];

export const defaultColumn = {
    size: 150,
    // NOTE: Going below 40px will mess the styling quite a bit, even with text overflow ellipsis
    // and at this point it's easier to just not allow going beyond that.
    minSize: 40,
    maxSize: Number.MAX_SAFE_INTEGER,
} as const;
