import { useEffect, useState } from "react";
import { db } from "./db";
import { getTopArchetypes, getUniqueArchetypeCount, type TopArchetype } from "./dbUtil";
import {
    type ColumnDef,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"


function TopArchetypeInfo({
    topArchetypes,
}: {
    topArchetypes: TopArchetype[]
}) {
    type TData = TopArchetype;

    const columnHelper = createColumnHelper<TData>();

    const data = topArchetypes;
    const columns: ColumnDef<TData> = [
        columnHelper.accessor("archetype_id", {
            header: () => "Archetype id",
        }),
        columnHelper.accessor("cnt", {
            header: () => "Count",
        }),
        columnHelper.accessor("archetype", {
            header: () => "Archetype",
            cell: (valuesContext) => {
                const components = valuesContext.getValue();

                return (
                    <div className="flex flex-col">
                        <p className="font-bold">Size = {components.length}</p>
                        <ul className="text-sm">
                            {components.map((val) => (<li>{val}</li>))}
                        </ul>
                    </div>
                )
            },
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const cellClassName= "px-4 py-2";

    return (
        <div>
            <p>Showing info for {topArchetypes.length} archetypes.</p>

            <table>
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
        </div>
    );
}

function App() {
    const [uniqueArchetypeCount, setUniqueArchetypeCount] = useState<null | number>(null);
    const [topArchetypes, setTopArchetypes] = useState<null | TopArchetype[]>(null);

    // NOTE: Archetype info retrieval effect
    useEffect(() => {
        const count = getUniqueArchetypeCount(db);
        setUniqueArchetypeCount(count);

        const limit = 50;

        setTopArchetypes(getTopArchetypes(db, limit));
    });

    return (
        <>
            <div className="">
                <div className="p-4 bg-blue-100">
                    <h1>Archetype information</h1>
                </div>
                <div className="p-4">
                    {(uniqueArchetypeCount === null) ? (
                        <p>Count is being retrieved...</p>
                    ) : (
                        <p>Unique archtype count: {uniqueArchetypeCount}</p>
                    )}

                    {(topArchetypes === null) ? (
                        <p>Top archetypes are being retrieved</p>
                    ) : (
                        <TopArchetypeInfo topArchetypes={topArchetypes} />
                    )}
                </div>
            </div>
        </>
    )
}

export default App
