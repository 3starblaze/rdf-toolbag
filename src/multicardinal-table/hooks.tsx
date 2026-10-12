import {
    useQueries,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  formatPaginatedQuery,
  parseKeyQueryResults,
} from "@/compact-pagination/granular-compact-pagination";
import { tableToMulticardinalTable } from "@/compact-pagination";
import { cellsToMulticardinalTable, initialCellRequests, multicardinalTableToCells, type CellRequest, type MCTCell } from "@/compact-pagination/cell";

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

function useCellQueryArgs(args: {
  baseQuery: string,
  idVars: string[],
  cellRequest: CellRequest,
  queryCallback: QueryCallback,
}) {
    const {
        baseQuery,
        idVars,
        cellRequest,
        queryCallback,
    } = args;

    const propNameVar = "__propName";
    const propValVar = "__propVal";

    return {
        queryKey: ["useCell", args],
        queryFn: async (): Promise<MCTCell> => {
            const query = formatPaginatedQuery({
                queryToWrap: baseQuery,
                idVars,
                propNameVar,
                propValVar,
                cellRequests: [cellRequest],
            });

            const resultingTable = await queryCallback({ query });
            const tableData = tableToMulticardinalTable({ propNameVar, propValVar, resultingTable });
            const cells = multicardinalTableToCells(tableData, cellRequest.limit);
            if (cells.length === 0) {
                return {
                    column: cellRequest.column,
                    key: cellRequest.key,
                    limit: cellRequest.limit,
                    values: [],
                };
            }
            if (cells.length === 1) return cells[0];
            else throw "unexpected";
        },
        retry: false,
    } satisfies Parameters<typeof useQuery>[0];
}

export function useCells(args: {
  baseQuery: string,
  idVars: string[],
  cellRequests: CellRequest[],
  queryCallback: QueryCallback,
}) {
    const {
        baseQuery,
        idVars,
        cellRequests,
        queryCallback,
    } = args;

    return useQueries({
        queries: cellRequests
            .map((cellRequest) => useCellQueryArgs({ baseQuery, cellRequest, idVars, queryCallback })),
        combine: (queries) => ({
            data: queries.map((it) => it.data).filter((it) => it !== undefined),
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
        accessorFn: (row) => row.restValues[restCol],
        ...(renderHeader && { header: () => renderHeader(restCol) }),
        cell: ({ getValue }) => {
            const val = getValue<any[] | undefined>() ?? [];

            if (val.length === 1) {
                return <p className="text-ellipsis overflow-hidden">{val[0]?.value || ""}</p>
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

    if (cellsQuery.data) {
      data = cellsToMulticardinalTable(cellsQuery.data);
    } else {
      data = []
        data = keyValuesQuery
            .data
            ?.map((idValues) => ({ idValues, restValues: {} }))
            ?? [];
    }

    const restCols = [...new Set(cellsQuery.data.map((it) => it.column))];
    const columns = keyValuesQuery.data
        ? getColumns(idVars, restCols, renderHeader)
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
