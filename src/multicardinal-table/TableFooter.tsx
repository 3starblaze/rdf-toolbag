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
    type PaginationState,
} from "@tanstack/react-table";

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

/**
 * Multicardinal table footer that includes pagination control.
 */
export function TableFooter({
    pagination,
    onPaginationChange,
    hasNextPage,
}: {
    /** Current pagination. */
    pagination: PaginationState,
    /** Callback to change current pagination. */
    onPaginationChange: (state: PaginationState) => void,
    /** True if there are more pages. */
    hasNextPage: boolean,
}) {
    const pageSizeOptions = [
        10,
        20,
        50,
        100,
        200,
    ];

    const hasPreviousPage = pagination.pageIndex > 0;

    return (
        <div className="flex flex-row items-center gap-4 bg-gray-50">
            <div className="flex flex-row gap-2 p-2 items-center">
                <TableButton
                    onClick={() => onPaginationChange({ ...pagination, pageIndex: 0 })}
                    disabled={!hasPreviousPage}
                >
                    {"<<"}
                </TableButton>
                <TableButton
                    onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex - 1 })}
                    disabled={!hasPreviousPage}
                >
                    {"<"}
                </TableButton>
                <p className="p-1">
                    <span data-current-page>
                        {pagination.pageIndex + 1}
                    </span>
                </p>
                <TableButton
                    onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex + 1 })}
                    disabled={!hasNextPage}
                >
                    {">"}
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
                                <SelectItem
                                    key={pageSize}
                                    value={pageSize.toString()}
                                >{pageSize}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
