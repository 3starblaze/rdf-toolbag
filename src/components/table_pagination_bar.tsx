import {
    Button,
} from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    type Table,
    type PaginationState,
} from "@tanstack/react-table";
import { Match } from "effect";


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

export function PaginationBar<T>({
    table,
    pagination,
    onPaginationChange,
}: {
    table: Table<T>,
    pagination: PaginationState,
    onPaginationChange: (state: PaginationState) => void,
}) {
    const pageSizeOptions = [
        10,
        20,
        50,
        100,
        200,
    ];

    return (
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
                    onValueChange={(value) => onPaginationChange({
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
    );
}

interface CountPayload {
    globalCount: number,
    groupedCount: number,
}

// FIXME: A lot of duplication with PaginationBar
export function ServerSidePaginationBar<T>({
    table,
    pagination,
    onPaginationChange,
    countPayload,
    rowCountLimit,
}: {
    table: Table<T>,
    pagination: PaginationState,
    onPaginationChange: (state: PaginationState) => void,
    countPayload?: CountPayload,
    rowCountLimit?: number,
}) {
    const isRowCountExact = Match.value([countPayload?.globalCount, rowCountLimit]).pipe(
        // NOTE: Doesn't really make sense to match here but we'll leave it
        Match.when([undefined, Match.any], () => false),
        Match.when([Match.any, undefined], () => true),
        Match.when([Match.number, Match.number], ([a, b]) => a !== b),
        Match.exhaustive,
    );

    const pageSizeOptions = [
        10,
        20,
        50,
        100,
        200,
    ];

    // NOTE: How pageCount should be displayed
    const pageCountNode = Match.value([isRowCountExact, table.getPageCount()]).pipe(
        // NOTE: non-positive page size should mean that page count is unknown
        Match.when((([_, count]) => count <= 0), () => "?"),
        Match.when([true, Match.any], ([_, count]) => `${count}`),
        Match.when([false, Match.any], ([_, count]) => `${count}+`),
        Match.exhaustive,
    );

    return (
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
                    {pagination.pageIndex + 1} / {pageCountNode}
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
                    onValueChange={(value) => onPaginationChange({
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
    );
}
