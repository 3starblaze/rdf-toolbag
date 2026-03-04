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
    type Header,
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
import { GripVerticalIcon } from "lucide-react";

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

export function ColumnResizer<TData, TValue>({
    header,
}: {
    header: Header<TData, TValue>,
}) {
    if (header.column.getCanResize() === false) return <></>;

    // NOTE: Style is similar to shadcn's "Collapsible" component's handle
    return (
        <div
            className="relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90"
            // NOTE: these styles ensure that text selection (and other) behavior won't kick in
            // while dragging is in progress.
            style={{
                userSelect: "none",
                touchAction: "none",
            }}
        >
            <div
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                className="cursor-col-resize z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border"
            >
                <GripVerticalIcon className="size-2.5" />
            </div>
        </div >
    );
};

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
                                        className="font-bold"
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
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
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
