import {
  type SparqlTableResult,
} from "@/sparql_queries";
import {
    formatPaginatedCounterQuery,
    formatPaginatedQuery,
    tableToCountPayload,
    tableToMulticardinalRow,
} from "@/compact-pagination";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    type ColumnDef,
    type PaginationState,
    type Table as TableData,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { defaultPagination, ServerSidePaginationBar } from "./table_pagination_bar";
import { type MulticardinalRow } from "@/multi-cardinal-table-util";
import { cn } from "@/lib/utils";
import { ColumnResizer } from "./column_resizer";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";
import { useEffect } from "react";

interface CountPayload {
    globalCount: number,
    groupedCount: number,
}

// NOTE: Exported, just in case this data is needed
export const defaultColumn = {
    size: 150,
    // NOTE: Going below 40px will mess the styling quite a bit, even with text overflow ellipsis
    // and at this point it's easier to just not allow going beyond that.
    minSize: 40,
    maxSize: Number.MAX_SAFE_INTEGER,
} as const;

interface Props {
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

function getColumns(
    idCols: string[],
    restCols: string[],
    renderHeader?: (colName: string) => React.ReactNode,
) {
    const idColumns: ColumnDef<MulticardinalRow>[] = idCols.map((idCol) => ({
        id: idCol,
        accessorFn: (row) => row.idValues[idCol],
        ...(renderHeader && { header: () => renderHeader(idCol) }),
        cell: ({ getValue }) => {
            return (
                <div className="text-ellipsis overflow-hidden">{getValue<string>()}</div>
            )
        },
    }));

    const valueColumns: ColumnDef<MulticardinalRow>[] = restCols.map((restCol) => ({
        id: restCol,
        accessorFn: (row) => row.restValues[restCol],
        ...(renderHeader && { header: () => renderHeader(restCol) }),
        cell: ({ getValue }) => {
            const val = getValue<string[] | undefined>() ?? [];

            if (val.length === 1) {
                return <p className="text-ellipsis overflow-hidden">{val[0]}</p>
            }

            return (
                <ul className="flex flex-col gap-2 overflow-hidden">
                    {val.map((item, i) => (
                        <li
                            key={i}
                            className="list-disc ml-4"
                        >
                            <p className="text-ellipsis overflow-hidden">{item}</p>
                        </li>
                    ))}
                </ul>
            )
        },
    }));

    return [...idColumns, ...valueColumns];
}

function useRows(args: Pick<Props, "queryCallback" | "baseQuery" | "idVars" | "rawRowLimit"> & {
    pagination: NonNullable<Props["pagination"]>,
}) {
    const {
        pagination,
        queryCallback,
        baseQuery,
        idVars,
        rawRowLimit,
    } = args;

    const propNameVar = "__propName";
    const propValVar = "__propVal";

    return useQuery({
        queryKey: ["rows", args],
        queryFn: async () => {
            const query = formatPaginatedQuery({
                propNameVar,
                propValVar,
                globalLimit: rawRowLimit,
                groupLimit: pagination.pageSize,
                groupOffset: pagination.pageSize * pagination.pageIndex,
                idVars,
                queryToWrap: baseQuery,
            });
            const resultingTable = await queryCallback({ query });

            const res = tableToMulticardinalRow({ resultingTable, propNameVar, propValVar });
            return res;
        },
        retry: false,
    });
}

function useCount(args: Pick<Props, "queryCallback" | "baseQuery" | "idVars" | "counterLimit">) {
    const {
        queryCallback,
        baseQuery,
        counterLimit,
        idVars,
    } = args;

    const globalRowCountVar = "__global_count";
    const groupedRowCountVar = "__grouped_count";
    const propNameVar = "__propName";
    const propValVar = "__propVal";

    return useQuery({
        queryKey: ["count", args],
        queryFn: async (): Promise<CountPayload> => {
            const query = formatPaginatedCounterQuery({
                queryToWrap: baseQuery,
                globalLimit: counterLimit,
                globalRowCountVar,
                groupedRowCountVar,
                idVars,
                propNameVar,
                propValVar,
            });
            const resultingTable = await queryCallback({ query });
            return tableToCountPayload({
                resultingTable,
                globalRowCountVar,
                groupedRowCountVar
            });
        },
        retry: false,
    });
}

function MainHeader({
    table,
    baseQuery,
    idVars,
    queryCallback,
    pagination,
    rawRowLimit,
}: {
    table: TableData<MulticardinalRow>,
    pagination: NonNullable<Props["pagination"]>,
} & Pick<Props, "baseQuery" | "idVars" | "queryCallback" | "rawRowLimit">) {
    const rowsQuery = useRows({ baseQuery, idVars, queryCallback, pagination, rawRowLimit });
    const idCols = rowsQuery.data?.at(0)?.idCols;

    return (
        <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, i) => {
                        return (
                            <TableHead
                                className={cn(
                                    "font-bold p-0",
                                    idCols?.includes(header.column.id) && "bg-gray-100"
                                )}
                                key={header.id}
                                style={{
                                    width: header.getSize(),
                                }}
                            >
                                <div className="flex flex-row justify-between gap-4 h-full">
                                    <div className="text-ellipsis overflow-hidden px-2">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </div>
                                    <ColumnResizer
                                        header={header}
                                        data-column-index={i}
                                    />
                                </div>
                            </TableHead>
                        )
                    })}
                </TableRow>
            ))}
        </TableHeader>
    );
}

function MainBody({
    table,
    baseQuery,
    idVars,
    queryCallback,
    pagination,
    rawRowLimit,
}: {
    table: TableData<MulticardinalRow>,
    pagination: NonNullable<Props["pagination"]>,
} & Pick<Props, "baseQuery" | "idVars" | "queryCallback" | "rawRowLimit">) {
    const columns = table.getAllColumns();

    function SingletonCell({
        className,
        ...props
    }: React.ComponentProps<typeof TableCell>) {
        return (
            <TableRow>
                <TableCell
                    colSpan={columns.length}
                    className={cn(
                        "flex justify-center items-center p-4",
                        className,
                    )}
                    {...props}
                />
            </TableRow>
        )
    }

    const rowsQuery = useRows({ baseQuery, idVars, queryCallback, pagination, rawRowLimit });
    const idCols = rowsQuery.data?.at(0)?.idCols;

    return (
        <TableBody>
            {rowsQuery.isLoading && (
                <SingletonCell>
                    <Spinner role="status" />
                </SingletonCell>
            )}
            {rowsQuery.isError && (
                <SingletonCell className="flex flex-col gap-1">
                    <p>Unexpected error while getting rows</p>
                    <Button
                        className="cursor-pointer"
                        onClick={() => rowsQuery.refetch()}
                    >
                        Retry
                    </Button>
                </SingletonCell>
            )}
            {rowsQuery.isSuccess && (table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <TableRow
                        className="group"
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell
                                className={cn(
                                    idCols?.includes(cell.column.id) && "bg-gray-100 group-hover:bg-gray-200"
                                )}
                                key={cell.id}
                                style={{
                                    width: cell.column.getSize(),
                                }}
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))
            ) : (
                <SingletonCell>
                    No results.
                </SingletonCell>
            ))}
        </TableBody>
    );
}

function useLogErrors({
    baseQuery,
    idVars,
    pagination,
    queryCallback,
    rawRowLimit,
    counterLimit,
}: Props & { pagination: NonNullable<Props["pagination"]> }) {
    const rowsQuery = useRows({ baseQuery, idVars, pagination, queryCallback, rawRowLimit });
    const countQuery = useCount({ baseQuery, counterLimit, idVars, queryCallback });

    useEffect(() => {
        if (!rowsQuery.error) return;
        console.error(`[MultiCardinalTableServer] [rowsQuery] ${rowsQuery.error}`);
    }, [rowsQuery.error]);

    useEffect(() => {
        if (!countQuery.error) return;
        console.error(`[MultiCardinalTableServer] [countQuery] ${rowsQuery.error}`);
    }, [countQuery.error]);
}

function MainComponent(props: Props): React.ReactNode {
    const {
        idVars,
        baseQuery,
        queryCallback,
        counterLimit,
        rawRowLimit,
        pagination: providedPagination,
        onPaginationChange,
        renderHeader,
    } = props;

    const [pagination, setPagination] = useControllableState<PaginationState>({
        prop: providedPagination,
        defaultProp: defaultPagination,
        onChange: onPaginationChange,
    });

    useLogErrors({ ...props, pagination, onPaginationChange: setPagination });

    const rowsQuery = useRows({ baseQuery, idVars, queryCallback, pagination, rawRowLimit });

    const countQuery = useCount({ baseQuery, counterLimit, idVars, queryCallback });

    const rows = rowsQuery.data || [];

    const firstRow = rows[0] as MulticardinalRow | undefined;

    const columns = firstRow ? getColumns(firstRow.idCols, firstRow.restCols, renderHeader) : [];

    const table = useReactTable<MulticardinalRow>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        rowCount: countQuery.data?.groupedCount ?? -1,
        manualPagination: true,
        state: {
            pagination,
        },
        defaultColumn,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    // NOTE: If table width is 0px then there are no columns and we should not set the size
    // explicitly in order to show status messages.
    const tableStyle = (table.getCenterTotalSize() === 0) ? {} : {
        width: table.getCenterTotalSize(),
    };

    return (
        <div>
            <Table
                className="table-fixed"
                style={tableStyle}
            >
                <MainHeader
                    {...{ table, baseQuery, idVars, queryCallback, pagination, rawRowLimit }}
                />
                <MainBody
                    {...{ table, baseQuery, idVars, queryCallback, pagination, rawRowLimit }}
                />
            </Table>
            <ServerSidePaginationBar
                table={table}
                pagination={pagination}
                onPaginationChange={setPagination}
                countPayload={countQuery.data}
                rowCountLimit={counterLimit}
            />
        </div>
    );
}

export function MultiCardinalTableServer(props: Props) {
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <MainComponent {...props} />
        </QueryClientProvider>
    );
}
