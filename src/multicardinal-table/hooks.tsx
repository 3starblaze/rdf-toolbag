import {
  useQuery,
} from "@tanstack/react-query";
import { useEffect } from "react";
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
import type { MulticardinalTableData } from "@/multi-cardinal-table-util";

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

export function useRowsTableData(args: Pick<Props, "queryCallback" | "baseQuery" | "idVars"> & {
    pagination: NonNullable<Props["pagination"]>,
  },
) {
  const { pagination, idVars, queryCallback, baseQuery} = args;

    const keyValuesQuery = useKeyValues({
        groupLimit: pagination.pageSize,
        groupOffset: pagination.pageIndex * pagination.pageSize,
        idVars,
        queryCallback,
        queryToWrap: baseQuery,
    });

    const propNameVar = "__propName";
    const propValVar = "__propVal";

    return useQuery({
        queryKey: ["rows", args],
        queryFn: async (): Promise<MulticardinalTableData> => {
          if (!keyValuesQuery.data) throw "unexpected";

          const query = formatPaginatedQuery({
            queryToWrap: baseQuery,
            idVars,
            propNameVar,
            propValVar,
            keyValues: keyValuesQuery.data,
          });

          const resultingTable = await queryCallback({ query });
          return tableToMulticardinalTable({ propNameVar, propValVar, resultingTable });
        },
        enabled: !!keyValuesQuery.data,
        retry: false,
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

export function useLogErrors({
    baseQuery,
    idVars,
    pagination,
    queryCallback,
    counterLimit,
}: Props & { pagination: NonNullable<Props["pagination"]> }) {
    const rowsQuery = useRowsTableData({ baseQuery, idVars, pagination, queryCallback });
    const countQuery = useCount({ baseQuery, counterLimit, idVars, queryCallback });

    useEffect(() => {
        if (!rowsQuery.error) return;
        console.error(`[MultiCardinalTableServer] [useRowsTableData] ${rowsQuery.error}`);
    }, [rowsQuery.error]);

    useEffect(() => {
        if (!countQuery.error) return;
        console.error(`[MultiCardinalTableServer] [countQuery] ${rowsQuery.error}`);
    }, [countQuery.error]);
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

    const maybeFullRows = useRowsTableData({
        baseQuery: queryToWrap,
        idVars,
        pagination,
        queryCallback,
    });

    let data: Row[];

    if (maybeFullRows.data) {
      data = maybeFullRows.data.rows;
    } else {
        data = keyValuesQuery
            .data
            ?.map((idValues) => ({ idValues, restValues: {} }))
            ?? [];
    }

    const columns = keyValuesQuery.data
        ? getColumns(idVars, maybeFullRows.data?.restCols ?? [], renderHeader)
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
