import { useEffect, useState } from "react";
import { db } from "../db";
import { getAvailableTypes } from "../dbUtil";

import {
    type ColumnDef,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table"

function rangeArray(n: number) {
    return [...Array(n).keys()];
}

function TableButton({
    children,
    ...props
}: {
    children: React.ReactNode,
} & React.JSX.IntrinsicElements["button"]) {
    return (
        <button
            className={[
                "bg-blue-200 cursor-pointer px-4 py-2 rounded-lg text-black",
                "hover:bg-blue-300",
                "disabled:bg-gray-200 disabled:cursor-not-allowed",
            ].join(" ")}
            {...props}
        >
            {children}
        </button>
    );
}

function AvailableTableView({
    availableTypes,
}: {
    availableTypes: {type: string}[],
}) {
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    type TData = { type: string };

    const columnHelper = createColumnHelper<TData>();

    const data = availableTypes;
    const columns: ColumnDef<TData> = [
        columnHelper.accessor("type", {
            header: () => "Type",
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        state: {
            pagination,
        },
    });

    const cellClassName = "px-4 py-2";

    return (
        <div className="w-fit">
            <table className="w-full">
                <thead className="bg-gray-300">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr
                            key={headerGroup.id}
                        >
                            {headerGroup.headers.map(header => (
                                <th
                                    key={header.id}
                                    className={cellClassName}
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="even:bg-gray-100">
                            {row.getVisibleCells().map(cell => (
                                <td
                                    key={cell.id}
                                    className={`${cellClassName}`}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex flex-row gap-2 p-2 pt-4 items-center">
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
        </div>
    );
}

export default function ClassTypeInformation() {
    const [availableTypes, setAvailableTypes] = useState<{type: string}[] | null>(null);

    useEffect(() => {
        setAvailableTypes(getAvailableTypes(db, -1));
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Class/type information</h2>
            {(availableTypes === null) ? (
                <p>Awaiting type info</p>
            ) : (
                <>
                    <p>Type count: {availableTypes.length}</p>
                    <AvailableTableView availableTypes={availableTypes} />
                </>
            )}
        </div>
    );
}
