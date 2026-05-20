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

function getColumns(
    idCols: string[],
    restCols: string[],
    renderHeader?: (colName: string) => ReactNode,
) {
    const idColumns: ColumnDef<MulticardinalRow>[] = idCols.map((idCol) => ({
        id: idCol,
        accessorFn: (row) => row.idValues[idCol],
        ...(renderHeader && { header: () => renderHeader(idCol) }),
    }));

    const valueColumns: ColumnDef<MulticardinalRow>[] = restCols.map((restCol) => ({
        id: restCol,
        accessorFn: (row) => row.restValues[restCol],
        ...(renderHeader && { header: () => renderHeader(restCol) }),
        cell: ({ getValue }) => {
            const val = getValue<string[] | undefined>() ?? [];

            if (val.length === 1) {
                return <p>{val[0]}</p>
            }

            return (
                <ul className="flex flex-col gap-2">
                    {val.map((item, i) => (
                        <li
                            key={i}
                            className="list-disc ml-4"
                        >
                            {item}
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
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    return (
        <div>
            <Table
                style={{
                    width: table.getCenterTotalSize()
                }}
            >
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
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

// FIXME: A lot of duplication with MultiCardinalTable
export function MultiCardinalTableServer({
    rows,
    pagination: providedPagination,
    onPaginationChange,
    countPayload,
    rowCountLimit,
    renderHeader,
}: {
    rows: MulticardinalRow[],
    pagination?: PaginationState,
    onPaginationChange?: (state: PaginationState) => void,
    countPayload?: CountPayload,
    rowCountLimit?: number,
    renderHeader?: (colName: string) => ReactNode,
}) {
    const firstRow = rows[0] as MulticardinalRow | undefined;

    const columns = firstRow ? getColumns(firstRow.idCols, firstRow.restCols, renderHeader) : [];

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
        rowCount: countPayload?.groupedCount ?? -1,
        manualPagination: true,
        state: {
            pagination,
        },
        enableColumnResizing: true,
        columnResizeMode: "onChange",
    });

    const idCols = firstRow?.idCols;

    // TODO: Support server-side pagination
    // reuse the visual style, just swap some settings

    return (
        <div>
            <Table
                style={{
                    width: table.getCenterTotalSize()
                }}
            >
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead
                                        className={cn(
                                            "font-bold",
                                            idCols?.includes(header.column.id) && "bg-gray-100"
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
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
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
