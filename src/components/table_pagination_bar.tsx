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
