import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
    flexRender,
    type Table as TableData,
} from "@tanstack/react-table";
import {
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table";
import type { Props, Row } from "./shared";
import { useKeyValues } from "./hooks";
import { cn } from "@/lib/utils";

export function MulticardinalTableBody({
    table,
    baseQuery,
    idVars,
    queryCallback,
    pagination,
}: {
    table: TableData<Row>,
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

    // NOTE: keyValuesQuery is a subset of rowsQuery -- if you have rows, you will have keys
    const keyValuesQuery = useKeyValues({
      queryCallback,
      groupLimit: pagination.pageSize,
      groupOffset: pagination.pageIndex * pagination.pageSize,
      idVars,
      queryToWrap: baseQuery,
    });

    return (
        <TableBody>
            {keyValuesQuery.isLoading && (
                <SingletonCell>
                    <Spinner role="status" />
                </SingletonCell>
            )}
            {keyValuesQuery.isError && (
                <SingletonCell className="flex flex-col gap-1">
                    <p>Unexpected error while getting rows</p>
                    <Button
                        className="cursor-pointer"
                        onClick={() => keyValuesQuery.refetch()}
                    >
                        Retry
                    </Button>
                </SingletonCell>
            )}
            {keyValuesQuery.isSuccess && (table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                    <TableRow
                        className="group"
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell
                                className={cn(
                                    idVars.includes(cell.column.id) && "bg-gray-100 group-hover:bg-gray-200"
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
