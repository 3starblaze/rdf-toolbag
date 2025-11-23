import { useEffect, useState } from "react";
import { db } from "../db";
import {
    getTopArchetypes,
    getTypeArchetypeCounts,
    type TypeArchetypeCountRow,
} from "../dbUtil";
import type { Database } from "sql.js";
import {
    Bar,
    BarChart,
    YAxis,
    XAxis,
    Tooltip,
} from "recharts";

function aggregrateTypeCounts({
    typeCounts,
}: {
    typeCounts: TypeArchetypeCountRow[],
}) {
    type AggregatedItem = {
        type: string,
        totalCount: number,
        sortedArchetypes: {
            archetypeId: number,
            count: number,
        }[],
    };

    const groupedItems: Map<string, TypeArchetypeCountRow[]> = new Map();

    for (const countInfo of typeCounts) {
        const key = countInfo.type;
        const maybeItem = groupedItems.get(key);
        let item: TypeArchetypeCountRow[];

        if (maybeItem) {
            item = maybeItem;
        } else {
            item = [];
            groupedItems.set(key, item);
        }

        item.push(countInfo);
    }

    let aggregatedInfo = new Map<string, AggregatedItem>();

    for (const [key, value] of groupedItems.entries()) {
        const sortedArchetypes = value.map((val) => {
            return {
                archetypeId: val.archetype_id,
                count: val.count,
            };
        });

        sortedArchetypes.sort((a, b) => -(a.count - b.count));

        const newItem: AggregatedItem = {
            type: key,
            totalCount: value.map((val) => val.count).reduce((a, b) => a + b, 0),
            sortedArchetypes,
        };

        aggregatedInfo.set(key, newItem);
    }

    return aggregatedInfo;
}

function getIdToArchetypeMap(db: Database): Map<number, string[]> {
    const topArchetypes = getTopArchetypes(db, -1);
    return new Map(topArchetypes.map((row) => [
        row.archetype_id,
        row.archetype,
    ]));
}

function joinArchetype(
    idToArchetypeMap: Map<number, string[]>,
    ids: number[],
): string[][] {
    return ids.map((id) => idToArchetypeMap.get(id)).filter((val) => val !== undefined);
}

function TopInfo({
    typeCounts,
}: {
    typeCounts: TypeArchetypeCountRow[],
}): React.ReactNode {
    const agg = aggregrateTypeCounts({ typeCounts });
    let aggValues = [...agg.values()];
    aggValues.sort((a, b) => -(a.totalCount - b.totalCount));
    aggValues = aggValues.slice(0, 10);

    const idToArchetype = getIdToArchetypeMap(db);

    const maxArchetypesPerType = 10;

    return (
        <div>
            <div className="text-red-500">TODO</div>
            <div className="flex flex-col gap-4 w-fit">
                {aggValues.map(({ type, totalCount, sortedArchetypes }) => (
                    <div
                        key={type}
                        className="bg-gray-200 px-4 py-8 rounded-lg w-full"
                    >
                        <div className="text-lg font-bold">{type}</div>
                        <div>Count: {totalCount}</div>
                        <div>Unique archetype count: {sortedArchetypes.length}</div>

                        <BarChart
                            className="max-w-160 min-h-80"
                            width={"100%"}
                            height={"100%"}
                            responsive
                            data={sortedArchetypes.slice(0, maxArchetypesPerType)}
                            margin={{
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <XAxis dataKey="archetypeId" />
                            <YAxis />
                            <Bar dataKey="count" className="fill-green-600" />
                        </BarChart>

                        <div className="flex flex-col gap-4">
                            {joinArchetype(
                                idToArchetype,
                                sortedArchetypes
                                    .slice(0, maxArchetypesPerType)
                                    .map(({ archetypeId }) => archetypeId),
                            ).map((item, i) => (
                                <div className="bg-blue-200 rounded-xl p-4">
                                    <pre className="">
                                        {JSON.stringify(item, undefined, 4)}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function TypeToArchetypeInformation() {
    const [typeCounts, setTypeCounts] = useState<TypeArchetypeCountRow[] | null>(null);

    useEffect(() => {
        setTypeCounts(getTypeArchetypeCounts(db));
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold">
                Type and archetype information
            </h2>
            {(typeCounts === null) ? (
                <p>Waiting for data...</p>
            ) : (
                <TopInfo typeCounts={typeCounts} />
            )}
        </div>
    );
}
