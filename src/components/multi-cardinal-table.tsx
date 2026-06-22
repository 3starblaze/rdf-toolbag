import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    type ColumnDef,
    type PaginationState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { MulticardinalRow } from "@/multi-cardinal-table-util";
import { defaultPagination, PaginationBar, ServerSidePaginationBar } from "./table_pagination_bar";
import PaginatedTable from "./paginated_table";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { ColumnResizer } from "./column_resizer";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Spinner } from "./ui/spinner";
import { Button } from "./ui/button";

// NOTE: Exported, just in case this data is needed
export const defaultColumn = {
    size: 150,
    // NOTE: Going below 40px will mess the styling quite a bit, even with text overflow ellipsis
    // and at this point it's easier to just not allow going beyond that.
    minSize: 40,
    maxSize: Number.MAX_SAFE_INTEGER,
} as const;

function getColumns(
    idCols: string[],
    restCols: string[],
    renderHeader?: (colName: string) => ReactNode,
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

/**
 * Table component specialized in displaying multicardinal rows.
 */
export default function MultiCardinalTable({
    rows,
    pagination: providedPagination,
    onPaginationChange,
    renderHeader,
}: {
    rows: MulticardinalRow[],
    pagination?: PaginationState,
    onPaginationChange?: (state: PaginationState) => void,
    renderHeader?: (colName: string) => ReactNode,
}) {
    // FIXME: We need a more sophisticated way to handle 0 rows, perhaps we need a type for whole
    // table, not just rows.
    if (rows.length === 0) {
        return (<PaginatedTable data={[]} columns={[]} />)
    }

    const firstRow = rows[0];
    const { idCols, restCols } = firstRow;

    const columns = getColumns(idCols, restCols, renderHeader);

    const [pagination, setPagination] = useControllableState<PaginationState>({
        prop: providedPagination,
        defaultProp: defaultPagination,
        onChange: onPaginationChange,
    });

    const table = useReactTable<MulticardinalRow>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        state: {
            pagination,
        },
        defaultColumn,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    return (
        <div>
            <Table
                className="table-fixed"
                style={{
                    width: table.getCenterTotalSize()
                }}
            >
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header, i) => {
                                return (
                                    <TableHead
                                        className={cn(
                                            "font-bold",
                                            idCols.includes(header.column.id) && "bg-gray-100"
                                        )}
                                        key={header.id}
                                        style={{
                                            width: header.getSize(),
                                        }}
                                    >
                                        <div className="flex flex-row justify-between gap-4 h-full">
                                            <div>
                                                {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                            </div>
                                            <ColumnResizer header={header} />
                                        </div>
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                className="group"
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        className={cn(
                                            idCols.includes(cell.column.id) && "bg-gray-100 group-hover:bg-gray-200"
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
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <PaginationBar
                table={table}
                pagination={pagination}
                onPaginationChange={setPagination}
            />
        </div>
    );
}

export interface CountPayload {
    globalCount: number,
    groupedCount: number,
}

interface MultiCardinalTableServerProps {
    /** Row fetcher that is called whenever new rows are required. */
    fetchRows: ({}: {
        pagination: PaginationState,
    }) => Promise<MulticardinalRow[]>,
    /** Current pagination state */
    pagination?: PaginationState,
    /** Callback invoked during pagination change. */
    onPaginationChange?: (state: PaginationState) => void,
    /** Row count information. */
    countPayload?: CountPayload,
    /** Limit that was used to obtain `countPayload`. */
    rowCountLimit?: number,
    /** Component for overriding header cell render. */
    renderHeader?: (colName: string) => ReactNode,
}

// FIXME: A lot of duplication with MultiCardinalTable
/**
 * Render server-side paginated multi-cardinal rows into table.
 */
function MultiCardinalTableServerMain({
    fetchRows,
    pagination: providedPagination,
    onPaginationChange,
    countPayload,
    rowCountLimit,
    renderHeader,
}: MultiCardinalTableServerProps) {
    const [pagination, setPagination] = useControllableState<PaginationState>({
        prop: providedPagination,
        defaultProp: defaultPagination,
        onChange: onPaginationChange,
    });

    const rowsQuery = useQuery({
        queryKey: ["MultiCardinalTableServer", pagination],
        queryFn: () => fetchRows({ pagination }),
        retry: false,
    });

    const rows = rowsQuery.data || [];

    const firstRow = rows[0] as MulticardinalRow | undefined;

    const columns = firstRow ? getColumns(firstRow.idCols, firstRow.restCols, renderHeader) : [];

    const table = useReactTable<MulticardinalRow>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        rowCount: countPayload?.groupedCount ?? -1,
        manualPagination: true,
        state: {
            pagination,
        },
        defaultColumn,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    const idCols = firstRow?.idCols;

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
            </Table>
            <ServerSidePaginationBar
                table={table}
                pagination={pagination}
                onPaginationChange={setPagination}
                countPayload={countPayload}
                rowCountLimit={rowCountLimit}
            />
        </div>
    );
}

export function MultiCardinalTableServer(props: MultiCardinalTableServerProps) {
    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <MultiCardinalTableServerMain {...props} />
        </QueryClientProvider>
    );
}
