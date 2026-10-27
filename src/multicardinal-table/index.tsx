import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
    flexRender,
    type PaginationState,
    type Table as TableData,
} from "@tanstack/react-table";
import {
    Table,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { useState } from "react";
import { defaultPagination } from "@/components/table_pagination_bar";
import { cn } from "@/lib/utils";
import { ColumnResizer } from "@/components/column_resizer";
import { MulticardinalTableBody } from "./MulticardinalTableBody";
import { TableFooter } from "./TableFooter";
import { useTable } from "./hooks";
import { type Props, type Row } from "./shared";

function MainHeader({
    table,
    idVars,
}: {
    table: TableData<Row>,
    pagination: NonNullable<Props["pagination"]>,
} & Pick<Props, "baseQuery" | "idVars" | "queryCallback" | "rawRowLimit">) {
    return (
        <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, i) => {
                        return (
                            <TableHead
                                className={cn(
                                    "font-bold p-0",
                                    idVars?.includes(header.column.id) && "bg-gray-100"
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
    );
}

function MainComponent(props: Props): React.ReactNode {
    const {
        idVars,
        baseQuery,
        queryCallback,
        rawRowLimit,
        pagination: providedPagination,
        onPaginationChange,
        renderHeader,
    } = props;

    const [pagination, setPagination] = useControllableState<PaginationState>({
        prop: providedPagination,
        defaultProp: defaultPagination,
        onChange: onPaginationChange,
    });

    const { table, hasNextPage } = useTable({
        idVars,
        pagination,
        renderHeader,
        setPagination,
        queryCallback,
        queryToWrap: baseQuery,
    });

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
                <MainHeader
                    {...{ table, baseQuery, idVars, queryCallback, pagination, rawRowLimit }}
                />
                <MulticardinalTableBody
                    {...{ table, baseQuery, idVars, queryCallback, pagination, rawRowLimit }}
                />
            </Table>
            <TableFooter
                pagination={pagination}
                onPaginationChange={setPagination}
                hasNextPage={hasNextPage}
            />
        </div>
    );
}

export function MultiCardinalTableServer(props: Props) {
    // NOTE: Do not recreate QueryClient on prop change
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <MainComponent {...props} />
        </QueryClientProvider>
    );
}
