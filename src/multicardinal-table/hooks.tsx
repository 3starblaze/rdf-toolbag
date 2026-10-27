import {
    useQueries,
  useQuery,
  useQueryClient,
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
  restValuesPlaceholderId,
  type Props,
  type Row,
} from "./shared";
import {
  formatKeyQuery,
  parseKeyQueryResults,
} from "@/compact-pagination/granular-compact-pagination";
import { cellsToMulticardinalTable, initialCellRequests, type CellRequest } from "@/compact-pagination/cell";
import { createCellBatcher, defaultBatchingStrategy, type BatchingStrategy } from "./cell-batcher";
import { valueEqual } from "@/func-util";
import { TermDisplay } from "./TermDisplay";
import { ValueCell } from "./ValueCell";

type QueryCallback = Props["queryCallback"];


/** One key more than a page, so that a full result means there is a next page. */
export function lookaheadKeyLimit(pagination: PaginationState) {
    return pagination.pageSize + 1;
}

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
        queryFn: async ({ signal }): Promise<ReturnType<typeof parseKeyQueryResults>> => {
            const query = formatKeyQuery({
                queryToWrap,
                idVars,
                groupLimit,
                groupOffset,
            });

            const table = await queryCallback({ query, signal });
            const res = parseKeyQueryResults({ table, idVars });

            return res;
        },
    })
}

function cellQueryKey({
  baseQuery,
  idVars,
  cellRequest,
}: {
  baseQuery: string,
  idVars: string[],
  cellRequest: CellRequest,
}) {
    return ["useCell", { baseQuery, idVars, cellRequest }] as const;
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

    const queryClient = useQueryClient();

    const batcher = useMemo(
        () => createCellBatcher({ baseQuery, idVars, queryCallback, batchingStrategy }),
        [baseQuery, idVars, queryCallback, batchingStrategy],
    );

    const cellsQuery = useQueries({
        // NOTE: Every cell has its own cache entry. The batcher only changes how the requests
        // are sent, so a changed cell (e.g. after increasing its limit) refetches only itself.
        queries: cellRequests.map((cellRequest) => ({
            queryKey: cellQueryKey({ baseQuery, idVars, cellRequest }),
            queryFn: ({ signal }) => batcher.load(cellRequest, signal),
            retry: false,
        })),
        combine: (queries) => ({
            data: queries.flatMap((it) => it.data ? [it.data] : []),
            isPending: queries.some((it) => it.isPending),
            pendingCellRequests: cellRequests.filter((_, i) => queries[i].isPending),
            isError: queries.some((it) => it.isError),
            erroredCellRequests: cellRequests.filter((_, i) => queries[i].isError),
            // NOTE: A failed cell that is being refetched keeps its error until the refetch settles
            retryingCellRequests: cellRequests.filter((_, i) => queries[i].isError && queries[i].isFetching),
        }),
    });

    // NOTE: Refetches only the given cell, the other cells keep their state
    function retryCell(cellRequest: CellRequest) {
        return queryClient.refetchQueries({
            queryKey: cellQueryKey({ baseQuery, idVars, cellRequest }),
            exact: true,
        });
    }

    return { ...cellsQuery, retryCell };
}

// NOTE: Query results are structurally shared, so a cell request may come back as an equal object
// that is not the same one. Cells are therefore matched by their value.
function isSameCellRequest(a: CellRequest, b: CellRequest) {
    return a.column === b.column
        && a.limit === b.limit
        && JSON.stringify(a.key) === JSON.stringify(b.key);
}

function getColumns(
    idCols: string[],
    restCols: string[],
    cellRequests: CellRequest[],
    increaseLimit: (cellRequest: CellRequest) => void,
    loadingCellRequests: CellRequest[],
    erroredCellRequests: CellRequest[],
    retryCell: (cellRequest: CellRequest) => void,
    renderHeader?: (colName: string) => React.ReactNode,
) {
    const idColumns: ColumnDef<Row>[] = idCols.map((idCol) => ({
        id: idCol,
        accessorFn: (row) => row.idValues[idCol],
        ...(renderHeader && { header: () => renderHeader(idCol) }),
        cell: ({ getValue }) => {
            const val = getValue<Row["idValues"][string]>();
            return (
                val ? <TermDisplay term={val} /> : <div></div>
            );
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
            const isPending = !!maybeCellRequest
                && loadingCellRequests.some((it) => isSameCellRequest(it, maybeCellRequest));
            const isError = !!maybeCellRequest
                && erroredCellRequests.some((it) => isSameCellRequest(it, maybeCellRequest));

            return (
                <ValueCell
                    value={{
                        data: val,
                        isPending,
                        isError,
                    }}
                    onIncreaseLimit={
                        maybeCellRequest && suggestIncreasingLimit
                            ? () => increaseLimit(maybeCellRequest)
                            : undefined
                    }
                    onRetry={
                        maybeCellRequest && isError
                            ? () => retryCell(maybeCellRequest)
                            : undefined
                    }
                />
            )
        },
    }));

    return [...idColumns, ...valueColumns];
}

// NOTE: Takes the place of the value columns, so that the spinner has a width and a header slot
const restValuesPlaceholderColumn: ColumnDef<Row> = {
    id: restValuesPlaceholderId,
    header: () => null,
    cell: () => null,
};

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
        groupLimit: lookaheadKeyLimit(pagination),
        groupOffset: pagination.pageIndex * pagination.pageSize,
        idVars,
        queryCallback,
        queryToWrap,
    });

    // NOTE: The extra key is only used to know whether there is a next page, so it gets no cells
    const lookaheadKeys = keyValuesQuery.data ?? [];
    const keys = lookaheadKeys.slice(0, pagination.pageSize);
    const hasNextPage = lookaheadKeys.length === lookaheadKeyLimit(pagination);

    const [cellRequests, setCellRequests] = useState<CellRequest[]>([]);
    const [cellRequestsPagination, setCellRequestsPagination] = useState<PaginationState | null>(null);
    // NOTE: Cell requests made by increasing a limit, so their spinner is shown in the cell itself
    const [increasedCellRequests, setIncreasedCellRequests] = useState<CellRequest[]>([]);

    // NOTE: Change cell requests whenever pagination changes
    useEffect(() => {
        const limit = 5; // FIXME: fix initial limit

        if (!keyValuesQuery.data) return;
        if (valueEqual(cellRequestsPagination, pagination)) return;

        setCellRequests(
            initialCellRequests({
                idVars,
                keys: keyValuesQuery.data.slice(0, pagination.pageSize),
                queryToWrap,
                limit,
            })
        );
        setIncreasedCellRequests([]);
        setCellRequestsPagination(pagination);
    }, [cellRequests, keyValuesQuery.data, pagination, cellRequestsPagination]);

    const cellsQuery = useCells({
        baseQuery: queryToWrap,
        idVars,
        queryCallback,
        cellRequests,
    });
    const erroredCellRequests = cellsQuery.erroredCellRequests;

    function increaseLimit(cellRequest: CellRequest) {
        const newCellRequest = {
            ...cellRequest,
            limit: cellRequest.limit * 2,
        } satisfies CellRequest;
        setCellRequests([
            ...cellRequests.filter((it) => it !== cellRequest),
            newCellRequest,
        ]);
        setIncreasedCellRequests((prev) => [...prev, newCellRequest]);
    }

    // NOTE: Cell requests are only set in an effect, so right after keys arrive they are not ready yet
    const cellRequestsReady = valueEqual(cellRequestsPagination, pagination);
    const loadingIncreasedCellRequests = cellsQuery.pendingCellRequests
        .filter((it) => increasedCellRequests.includes(it));
    // NOTE: Only the initial load of the rest values uses the placeholder column
    const restValuesLoading = keyValuesQuery.isSuccess && (
        !cellRequestsReady || cellsQuery.pendingCellRequests.length > loadingIncreasedCellRequests.length
    );

    const cellRows = cellsToMulticardinalTable(cellsQuery.data, keys);

    // NOTE: Every key is shown, even when its rest values have not arrived yet
    const data: Row[] = keys.map((idValues) => (
        cellRows.find((row) => valueEqual(row.idValues, idValues)) ?? { idValues, restValues: {} }
    ));

    // NOTE: Every value column is requested, so hide the ones that have no value in any shown row.
    // A column whose cell is loading after a limit increase or has failed stays, so its spinner or
    // error is still shown.
    const restCols = [...new Set([
        ...cellsQuery.data.map((it) => it.column),
        ...loadingIncreasedCellRequests.map((it) => it.column),
        ...erroredCellRequests.map((it) => it.column),
    ])]
        .filter((column) => (
            loadingIncreasedCellRequests.some((it) => it.column === column)
            || erroredCellRequests.some((it) => it.column === column)
            || data.some((row) => (row.restValues[column] ?? []).length > 0)
        ));
    const columns = keyValuesQuery.data
        ? [
            ...getColumns(
                idVars,
                restCols,
                cellRequests,
                increaseLimit,
                [...loadingIncreasedCellRequests, ...cellsQuery.retryingCellRequests],
                erroredCellRequests,
                cellsQuery.retryCell,
                renderHeader,
            ),
            ...(restValuesLoading ? [restValuesPlaceholderColumn] : []),
        ]
        : [];

    const table = useReactTable<Row>({
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
    });

    return { table, hasNextPage };
}
