import {
    type TopArchetype,
} from "../dbUtil";
import {
    Bar,
    BarChart,
    YAxis,
    XAxis,
    Tooltip,
} from "recharts";

function countHistogramData(topArchetypes: TopArchetype[]): number[] {
    const maxCount = topArchetypes.reduce(
        (acc, currentArchetype) => Math.max(acc, currentArchetype.archetype.length),
        0,
    );

    const res: number[] = Array(maxCount + 1).fill(0);

    for (const item of topArchetypes) {
        const key = item.archetype.length;
        res[key] += 1;
    }

    return res;
}

function countWeightedHistogramData(topArchetypes: TopArchetype[]): number[] {
    const maxCount = topArchetypes.reduce(
        (acc, currentArchetype) => Math.max(acc, currentArchetype.archetype.length),
        0,
    );

    const res: number[] = Array(maxCount + 1).fill(0);

    for (const item of topArchetypes) {
        const key = item.archetype.length;
        res[key] += item.cnt;
    }

    return res;
}

function UnweightedStatistics({
    archetypes,
}: {
    archetypes: TopArchetype[],
}) {
    const histogramData = countHistogramData(archetypes);

    const CustomTooltip = (obj: any) => {
        const maybeItem: undefined | number = obj.payload[0]?.payload;
        const maybeLabel: undefined | string = obj.label;

        const isVisible = (maybeItem !== undefined) && (maybeLabel !== undefined);

        return (
            <div
                className="custom-tooltip bg-gray-100 p-4"
                style={{ visibility: isVisible ? 'visible' : 'hidden' }}
            >
                {isVisible && (
                    <>
                        <p><span className="font-bold">Archetype size:</span> {maybeLabel}</p>
                        <p><span className="font-bold">Unique archetype count:</span> {maybeItem}</p>
                    </>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="mt-4 mb-2">
                <h2 className="text-xl font-bold">Unweighted statistics</h2>
                <p className="text-gray-600 max-w-prose w-full">
                    This chart displays unique archetype distribution and does <i>not</i> consider
                    the entity count for which the archetypes appear.
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-gray-800">Count</p>
                <BarChart
                    className="max-w-160 min-h-80"
                    width={"100%"}
                    height={"100%"}
                    responsive
                    data={histogramData}
                    margin={{
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <XAxis />
                    <YAxis />
                    <Bar dataKey={(x) => x} className="fill-green-600" />
                    <Tooltip content={CustomTooltip} />
                </BarChart>
            </div>
        </div>
    );
}

function WeightedStatistics({
    archetypes,
}: {
    archetypes: TopArchetype[],
}) {
    const weightedHistogramData = countWeightedHistogramData(archetypes);

    const CustomTooltip = (obj: any) => {
        const maybeItem: undefined | number = obj.payload[0]?.payload;
        const maybeLabel: undefined | string = obj.label;

        const isVisible = (maybeItem !== undefined) && (maybeLabel !== undefined);

        return (
            <div
                className="custom-tooltip bg-gray-100 p-4"
                style={{ visibility: isVisible ? 'visible' : 'hidden' }}
            >
                {isVisible && (
                    <>
                        <p><span className="font-bold">Archetype size:</span> {maybeLabel}</p>
                        <p>
                            <span className="font-bold">
                                Archetype occurrence count:
                            </span> {maybeItem}
                        </p>
                    </>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="mt-4 mb-2">
                <h2 className="text-xl font-bold">Weighted statistics</h2>
                <p className="text-gray-600 max-w-prose w-full">
                    Similar to previous chart but archetype occurence count is used as weight.
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-gray-800">Count</p>
                <BarChart
                    className="max-w-160 min-h-80"
                    width={"100%"}
                    height={"100%"}
                    responsive
                    data={weightedHistogramData}
                    margin={{
                        left: 5,
                        bottom: 0,
                    }}
                >
                    <XAxis />
                    <YAxis />
                    <Bar dataKey={(x) => x} className="fill-green-600" />
                    <Tooltip content={CustomTooltip} />
                </BarChart>
            </div>
        </div>
    );
}

export function ArchetypeDistributionStatistics({
    topArchetypes,
}: {
    topArchetypes: TopArchetype[],
}) {
    return (
        <div className="flex flex-col gap-0 mb-8">
            <div className="flex gap-2 items-end">
                <p className="text-2xl font-bold">Archetype size distribution</p>
                <p className="text-sm">{topArchetypes.length} archetypes</p>
            </div>
            <UnweightedStatistics
                archetypes={topArchetypes}
            />
            <WeightedStatistics
                archetypes={topArchetypes}
            />
        </div>
    );
}
