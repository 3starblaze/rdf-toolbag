import { formatPaginatedQuery } from "@/compact-pagination/granular-compact-pagination";
import { multicardinalTableToCells, type CellRequest, type MCTCell } from "@/compact-pagination/cell";
import { tableToMulticardinalTable } from "@/compact-pagination";
import type { Props } from "./shared";

type QueryCallback = Props["queryCallback"];

/**
 * Splits cell requests into batches. Each batch is fetched with a single query. Every request
 * must appear in exactly one batch.
 */
export type BatchingStrategy = (cellRequests: CellRequest[]) => CellRequest[][];

/**
 * One batch per column.
 */
export const batchByColumn: BatchingStrategy = (cellRequests) => {
  const batches = new Map<string, CellRequest[]>();
  cellRequests.forEach((it) => {
    batches.set(it.column, [...(batches.get(it.column) ?? []), it]);
  });
  return [...batches.values()];
};

// NOTE: Change this to switch the batching strategy for every `useCells` call.
export const defaultBatchingStrategy: BatchingStrategy = batchByColumn;

function cellId(cell: Pick<CellRequest, "column" | "key">, idVars: string[]): string {
  return JSON.stringify([cell.column, idVars.map((idVar) => cell.key[idVar] ?? null)]);
}

/**
 * Runs one query for all `cellRequests`. The returned cells are in the same order as the requests.
 */
async function fetchCellBatch({
  baseQuery,
  idVars,
  cellRequests,
  queryCallback,
}: {
  baseQuery: string,
  idVars: string[],
  cellRequests: CellRequest[],
  queryCallback: QueryCallback,
}): Promise<MCTCell[]> {
  const propNameVar = "__propName";
  const propValVar = "__propVal";

  // NOTE: Each cell keeps its own LIMIT inside the UNION, so values are limited per cell.
  const query = formatPaginatedQuery({
    queryToWrap: baseQuery,
    idVars,
    propNameVar,
    propValVar,
    cellRequests,
  });

  const resultingTable = await queryCallback({ query });
  const tableData = tableToMulticardinalTable({ propNameVar, propValVar, resultingTable });
  // NOTE: The limit passed here is only used to build the cells and is overwritten below.
  const maxLimit = Math.max(...cellRequests.map((it) => it.limit));
  const cells = multicardinalTableToCells(tableData, maxLimit);

  const cellsById = new Map(cells.map((it) => [cellId(it, idVars), it]));

  return cellRequests.map((cellRequest) => ({
    column: cellRequest.column,
    key: cellRequest.key,
    limit: cellRequest.limit,
    values: cellsById.get(cellId(cellRequest, idVars))?.values ?? [],
  }));
}

interface PendingLoad {
  cellRequest: CellRequest,
  resolve: (cell: MCTCell) => void,
  reject: (error: unknown) => void,
}

/**
 * Collects cell requests made within the same tick, batches them with `batchingStrategy`, runs
 * one query per batch and resolves each request with its own cell.
 */
export function createCellBatcher({
  baseQuery,
  idVars,
  queryCallback,
  batchingStrategy,
}: {
  baseQuery: string,
  idVars: string[],
  queryCallback: QueryCallback,
  batchingStrategy: BatchingStrategy,
}) {
  let pending: PendingLoad[] = [];
  let scheduled = false;

  function flush() {
    const current = pending;
    pending = [];
    scheduled = false;

    const pendingByRequest = new Map(current.map((it) => [it.cellRequest, it]));
    const batches = batchingStrategy(current.map((it) => it.cellRequest));

    batches.forEach((batch) => {
      const entries = batch.map((cellRequest) => {
        const entry = pendingByRequest.get(cellRequest);
        if (!entry) throw new Error("Batching strategy returned an unknown cell request");
        return entry;
      });

      fetchCellBatch({ baseQuery, idVars, cellRequests: batch, queryCallback })
        .then((cells) => entries.forEach((entry, i) => entry.resolve(cells[i])))
        .catch((error: unknown) => entries.forEach((entry) => entry.reject(error)));
    });
  }

  return {
    load(cellRequest: CellRequest): Promise<MCTCell> {
      return new Promise<MCTCell>((resolve, reject) => {
        pending.push({ cellRequest, resolve, reject });
        if (scheduled) return;
        scheduled = true;
        setTimeout(flush, 0);
      });
    },
  };
}
