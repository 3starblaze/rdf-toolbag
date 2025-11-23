import { useEffect, useState } from "react";
import { db } from "./db";
import {
    getTopArchetypes,
    getUniqueArchetypeCount,
    type TopArchetype,
    getAvailableTypes,
    getTypeArchetypeCounts,
} from "./dbUtil";
import {
    type ColumnDef,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import {
    Bar,
    BarChart,
    LineChart,
    Line,
    YAxis,
    XAxis,
    Label,
    Tooltip,
} from "recharts";
import { ArchetypeDistributionStatistics } from "./sections/archetype_size_distribution";
import ClassTypeInformation from "./sections/class_type_information";
import TypeToArchetypeInformation from "./sections/type_to_archetype_information";

function ArchetypeInfoList({
    archetype,
}: {
    archetype: TopArchetype,
}) {
    const components = archetype.archetype;

    return (
        <div className="flex flex-col">
            <p className="font-bold">Size = {components.length}</p>
            <ul className="text-sm">
                {components.map((val) => (<li>{val}</li>))}
            </ul>
        </div>
    );
}

function TopArchetypeChart({
    topArchetypes,
}: {
    topArchetypes: TopArchetype[],
}) {
    const CustomTooltip = (obj) => {
        const maybeArchetype: undefined | TopArchetype = obj.payload[0]?.payload;

        const isVisible = maybeArchetype !== undefined;

        return (
            <div
                className="custom-tooltip bg-gray-100 p-4"
                style={{ visibility: isVisible ? 'visible' : 'hidden' }}
            >
                {isVisible && (
                    <>
                        <p className="font-bold">Count: {maybeArchetype.cnt}</p>
                        <ArchetypeInfoList archetype={maybeArchetype} />
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="w-full flex justify-between max-w-160">
                <p className="text-gray-800">Archetype occurence count</p>
                <p className="text-gray-500">Archetype size</p>
            </div>
            <BarChart
                className="max-w-160 min-h-80"
                width={"100%"}
                height={"100%"}
                responsive
                data={topArchetypes}
                margin={{
                    left: 0,
                    bottom: 0,
                }}
                barGap={0}
            >
                <Bar dataKey="cnt" className="fill-green-600" />
                <YAxis width="auto" />
                <Tooltip content={CustomTooltip} />
                <Bar
                    yAxisId="lengthAxis"
                    dataKey={(x: TopArchetype) => x.archetype.length}
                    className="fill-gray-500 opacity-60"
                />
                <YAxis
                    className="opacity-70"
                    orientation="right"
                    yAxisId="lengthAxis"
                />
            </BarChart>
        </div>
    );
}

function TopArchetypeTable({
    topArchetypes,
}: {
    topArchetypes: TopArchetype[],
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

    const cellClassName = "px-4 py-2";

    return (
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
    );
}

function TopArchetypeInfo({
    topArchetypes,
}: {
    topArchetypes: TopArchetype[]
}) {

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-end">
                <h2 className="text-xl font-bold">
                    Archetype occurrence distribution
                </h2>

                <p className="text-sm">{topArchetypes.length} archetypes</p>
            </div>

            <div className="flex flex-col gap-4 w-fit">
                <TopArchetypeChart topArchetypes={topArchetypes} />

                <TopArchetypeTable topArchetypes={topArchetypes} />
            </div>
        </div>
    );
}

function App() {
    const limit = 100000;
    const graphLimit = 50;

    const [uniqueArchetypeCount, setUniqueArchetypeCount] = useState<null | number>(null);
    const [topArchetypes, setTopArchetypes] = useState<null | TopArchetype[]>(null);

    const graphTopArchetypes = topArchetypes?.slice(0, graphLimit);

    // NOTE: Archetype info retrieval effect
    useEffect(() => {
        const count = getUniqueArchetypeCount(db);
        setUniqueArchetypeCount(count);

        setTopArchetypes(getTopArchetypes(db, limit));
    }, []);

    return (
        <>
            <div className="">
                <div className="p-4 bg-blue-100">
                    <h1>Archetype information</h1>
                </div>
                <div className="p-4 flex flex-col gap-8">
                    <ClassTypeInformation />
                    <TypeToArchetypeInformation />

                    <h2 className="text-2xl font-bold">Misc. information</h2>
                    {(uniqueArchetypeCount === null) ? (
                        <p>Count is being retrieved...</p>
                    ) : (
                        <p>Unique archetype count: {uniqueArchetypeCount}</p>
                    )}

                    {(topArchetypes === null) ? (
                        <p>Top archetypes are being retrieved</p>
                    ) : (
                        <>
                            <ArchetypeDistributionStatistics topArchetypes={topArchetypes} />
                            <TopArchetypeInfo topArchetypes={graphTopArchetypes} />
                        </>
                    )}
                </div >
            </div >
        </>
    )
}

export default App
