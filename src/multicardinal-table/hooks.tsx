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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { valueEqual } from "@/func-util";

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
            pendingCellRequests: cellRequests.filter((_, i) => queries[i].isPending),
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
    increaseLimit: (cellRequest: CellRequest) => void,
    loadingCellRequests: CellRequest[],
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

            // NOTE: A cell whose limit was just increased shows its spinner in place of its values
            if (maybeCellRequest && loadingCellRequests.includes(maybeCellRequest)) {
              return <Spinner role="status" />;
            }

            const suggestIncreasingLimit = maybeCellRequest && maybeCellRequest.limit === val.length;

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
                      <Button
                        className="w-fit"
                        onClick={() => maybeCellRequest && increaseLimit(maybeCellRequest)}
                      >
                        +
                      </Button>
                    )}
                </ul>
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
        groupLimit: pagination.pageSize,
        groupOffset: pagination.pageIndex * pagination.pageSize,
        idVars,
        queryCallback,
        queryToWrap,
    });

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
                keys: keyValuesQuery.data,
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

    const keys = keyValuesQuery.data ?? [];
    const cellRows = cellsToMulticardinalTable(cellsQuery.data, keys);

    // NOTE: Every key is shown, even when its rest values have not arrived yet
    const data: Row[] = keys.map((idValues) => (
        cellRows.find((row) => valueEqual(row.idValues, idValues)) ?? { idValues, restValues: {} }
    ));

    // NOTE: Every value column is requested, so hide the ones that have no value in any shown row.
    // A column whose cell is loading after a limit increase stays, so its spinner is still shown.
    const restCols = [...new Set([
        ...cellsQuery.data.map((it) => it.column),
        ...loadingIncreasedCellRequests.map((it) => it.column),
    ])]
        .filter((column) => (
            loadingIncreasedCellRequests.some((it) => it.column === column)
            || data.some((row) => (row.restValues[column] ?? []).length > 0)
        ));
    const columns = keyValuesQuery.data
        ? [
            ...getColumns(idVars, restCols, cellRequests, increaseLimit, loadingIncreasedCellRequests, renderHeader),
            ...(restValuesLoading ? [restValuesPlaceholderColumn] : []),
        ]
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
    });
}
