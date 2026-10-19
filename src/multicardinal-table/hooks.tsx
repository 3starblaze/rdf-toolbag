import {
    useQueries,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    type OnChangeFn,
    type ColumnDef,
    type PaginationState,
} from "@tanstack/react-table";
import {
  defaultColumn,
  type Props,
  type Row,
} from "./shared";
import {
  formatKeyQuery,
  parseKeyQueryResults,
} from "@/compact-pagination/granular-compact-pagination";
import { cellsToMulticardinalTable, initialCellRequests, type CellRequest } from "@/compact-pagination/cell";
import { createCellBatcher, defaultBatchingStrategy, type BatchingStrategy } from "./cell-batcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CountPayload {
    globalCount: number,
    groupedCount: number,
}

type QueryCallback = Props["queryCallback"];


export function useKeyValues({
  queryCallback,
  groupLimit,
  groupOffset,
  idVars,
  queryToWrap,
}: {
  queryCallback: QueryCallback,
  queryToWrap: string,
  idVars: string[],
  groupLimit: number,
  groupOffset: number,
}) {
    return useQuery({
        queryKey: ["useKeyValues", { queryToWrap, idVars, groupLimit, groupOffset }],
        queryFn: async (): Promise<ReturnType<typeof parseKeyQueryResults>> => {
            const query = formatKeyQuery({
                queryToWrap,
                idVars,
                groupLimit,
                groupOffset,
            });

            const table = await queryCallback({ query });
            const res = parseKeyQueryResults({ table, idVars });

            return res;
        },
    })
}

export function useCells(args: {
  baseQuery: string,
  idVars: string[],
  cellRequests: CellRequest[],
  queryCallback: QueryCallback,
  batchingStrategy?: BatchingStrategy,
}) {
    const {
        baseQuery,
        idVars,
        cellRequests,
        queryCallback,
        batchingStrategy = defaultBatchingStrategy,
    } = args;

    const batcher = useMemo(
        () => createCellBatcher({ baseQuery, idVars, queryCallback, batchingStrategy }),
        [baseQuery, idVars, queryCallback, batchingStrategy],
    );

    return useQueries({
        // NOTE: Every cell has its own cache entry. The batcher only changes how the requests
        // are sent, so a changed cell (e.g. after increasing its limit) refetches only itself.
        queries: cellRequests.map((cellRequest) => ({
            queryKey: ["useCell", { baseQuery, idVars, cellRequest }],
            queryFn: () => batcher.load(cellRequest),
            retry: false,
        })),
        combine: (queries) => ({
            data: queries.flatMap((it) => it.data ? [it.data] : []),
            isPending: queries.some((it) => it.isPending),
            isError: queries.some((it) => it.isError),
        }),
    });
}

// FIXME
export function useCount(
  args: Pick<Props, "queryCallback" | "baseQuery" | "idVars" | "counterLimit">,
) {
    return useQuery({
        queryKey: ["count", args],
        queryFn: async (): Promise<CountPayload> => {
          throw "TODO";
        },
        retry: false,
    });
}

function getColumns(
    idCols: string[],
    restCols: string[],
    cellRequests: CellRequest[],
    setCellRequests: (newValue: CellRequest[]) => void,
    renderHeader?: (colName: string) => React.ReactNode,
) {
    const idColumns: ColumnDef<Row>[] = idCols.map((idCol) => ({
        id: idCol,
        accessorFn: (row) => row.idValues[idCol],
        ...(renderHeader && { header: () => renderHeader(idCol) }),
        cell: ({ getValue }) => {
            const val = getValue<Row["idValues"][string]>();
            return (
                <div className="text-ellipsis overflow-hidden">{val?.value || ""}</div>
            )
        },
    }));

    const valueColumns: ColumnDef<Row>[] = restCols.map((restCol) => ({
        id: restCol,
        accessorFn: (row) => row,
        ...(renderHeader && { header: () => renderHeader(restCol) }),
        cell: ({ getValue }) => {
            const row = getValue<Row>();
            const val = row.restValues[restCol] ?? [];

            // TODO: cleaner equality check
            function isSameCell(it: CellRequest) {
              return it.column === restCol && JSON.stringify(it.key) === JSON.stringify(row.idValues);
            }

            const maybeCellRequest = cellRequests.find((it) => isSameCell(it));

            const suggestIncreasingLimit = maybeCellRequest && maybeCellRequest.limit === val.length;

            function increaseLimit() {
              if (!maybeCellRequest) return;
              const newCellRequest = {
                ...maybeCellRequest,
                limit: maybeCellRequest.limit * 2,
              } satisfies CellRequest;
              setCellRequests([
                ...cellRequests.filter((it) => !isSameCell(it)),
                newCellRequest,
              ]);
            }

            return (
                <ul className="flex flex-col gap-2 overflow-hidden">
                    {val.map((item, i) => (
                        <li
                            key={i}
                            className="list-disc ml-4"
                        >
                            <p className="text-ellipsis overflow-hidden">{item?.value || ""}</p>

                        </li>
                    ))}
                    {suggestIncreasingLimit && (
                      <Button className="w-fit" onClick={increaseLimit}>+</Button>
                    )}
                </ul>
            )
        },
    }));

    return [...idColumns, ...valueColumns];
}

export function useTable({
  idVars,
  pagination,
  renderHeader,
  setPagination,
  queryCallback,
  queryToWrap,
}: {
  idVars: Props["idVars"],
  pagination: PaginationState,
  setPagination: OnChangeFn<PaginationState>,
  renderHeader: Props["renderHeader"],
  queryCallback: QueryCallback,
  queryToWrap: string,
}) {
    const keyValuesQuery = useKeyValues({
        groupLimit: pagination.pageSize,
        groupOffset: pagination.pageIndex * pagination.pageSize,
        idVars,
        queryCallback,
        queryToWrap,
    });

    const [cellRequests, setCellRequests] = useState<CellRequest[]>([]);

    // NOTE: Initialize cell requests on first time
    useEffect(() => {
        const limit = 5; // FIXME: fix initial limit

        if (!(cellRequests.length === 0 && keyValuesQuery.data)) return;
        setCellRequests(
            initialCellRequests({
                idVars,
                keys: keyValuesQuery.data,
                queryToWrap,
                limit,
            })
        );
    }, [cellRequests, keyValuesQuery.data]);

    const cellsQuery = useCells({
        baseQuery: queryToWrap,
        idVars,
        queryCallback,
        cellRequests,
    });

    let data: Row[];

    if (cellsQuery.data && keyValuesQuery.data) {
      data = cellsToMulticardinalTable(cellsQuery.data, keyValuesQuery.data);
    } else {
      data = []
        data = keyValuesQuery
            .data
            ?.map((idValues) => ({ idValues, restValues: {} }))
            ?? [];
    }

    const restCols = [...new Set(cellsQuery.data.map((it) => it.column))];
    const columns = keyValuesQuery.data
        ? getColumns(idVars, restCols, cellRequests, setCellRequests, renderHeader)
        : [];

    return useReactTable<Row>({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        // FIXME
        rowCount: -1,
        manualPagination: true,
        state: {
            pagination,
        },
        defaultColumn,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    })
}
