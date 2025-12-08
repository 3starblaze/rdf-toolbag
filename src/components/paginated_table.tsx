import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
    type ColumnDef,
    type OnChangeFn,
    type PaginationState,
} from "@tanstack/react-table";
import {
    useState,
} from "react";
import {
    Button,
} from "./ui/button";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

export const defaultPagination: PaginationState = {
    pageIndex: 0,
    pageSize: 10,
};

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

export default function PaginatedTable<TData>({
    data,
    columns,
    pagination: providedPagination,
    onPaginationChange,
}: {
    data: TData[],
    columns: ColumnDef<TData>[],
    pagination?: PaginationState,
    onPaginationChange?: (state: PaginationState) => void,
}) {
    const pageSizeOptions = [
        10,
        20,
        50,
        100,
        200,
    ];

    const [internalPagination, setInternalPagination] = useState(defaultPagination);

    const pagination = providedPagination ?? internalPagination;
    const setPagination = onPaginationChange ?? setInternalPagination;

    const table = useReactTable<TData>({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination as OnChangeFn<PaginationState>,
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
                <div className="flex gap-2 items-center text-gray-600">
                    <p className="">Page size</p>
                    <Select
                        value={pagination.pageSize.toString()}
                        onValueChange={(value) => setPagination({
                            ...pagination,
                            pageSize: Number(value),
                        })}
                    >
                        <SelectTrigger className="">
                            <SelectValue placeholder="Select page size" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {pageSizeOptions.map((pageSize) => (
                                    <SelectItem value={pageSize.toString()}>{pageSize}</SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
