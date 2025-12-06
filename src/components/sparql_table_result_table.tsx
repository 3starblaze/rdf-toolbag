import type { SparqlTableResult } from "@/sparql_queries";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Button } from "./ui/button";

function TableButton({
    children,
    ...props
}: {
    children: React.ReactNode,
} & React.JSX.IntrinsicElements["button"]) {

    return (
        <Button
            variant="outline"
            className="cursor-pointer"
            {...props}
        >
            {children}
        </Button>
    );
}

export default function SparqlTableResultTable({
    data,
}: {
    data: SparqlTableResult
}) {
    const cols = data.head.vars;
    const rows = data.results.bindings;

    const pageSize = 10;

    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize,
    });

    type TData = (typeof rows)[number];

    const columns: ColumnDef<TData>[] = cols.map((colName) => ({
        accessorFn: (row) => row[colName].value,
        header: colName,
    }));

    const table = useReactTable<TData>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        state: {
            pagination,
        },
    });

    return (
        <div>
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead
                                        className="font-bold"
                                        key={header.id}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
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
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
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
            <div className="flex flex-row items-center gap-4 bg-gray-50">
                <div className="flex flex-row gap-2 p-2 items-center">
                    <TableButton
                        onClick={() => table.firstPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {"<<"}
                    </TableButton>
                    <TableButton
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {"<"}
                    </TableButton>
                    <p className="p-1">
                        {pagination.pageIndex + 1} / {table.getPageCount()}
                    </p>
                    <TableButton
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {">"}
                    </TableButton>
                    <TableButton
                        onClick={() => table.lastPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {">>"}
                    </TableButton>
                </div>
                <div className="flex gap-1 text-gray-500">
                    <p className="">Page size</p>
                    <p>{pageSize}</p>
                </div>
            </div>
        </div>
    );
}
