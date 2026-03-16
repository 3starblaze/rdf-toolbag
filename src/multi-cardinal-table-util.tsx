import {
    type SparqlTableResult,
} from "@/sparql_queries";
import { Data, Option, MutableHashMap, MutableHashSet } from "effect";

export interface MulticardinalRow {
    /**
     * Column names that are marked as id.
     */
    idCols: string[],
    /**
     * Id column values.
     */
    idValues: { [idCol: string]: string },
    /**
     * Remaining column names.
    */
    restCols: string[],
    /**
     * Remaining column values.
     */
    restValues: { [restCol: string]: string[] },
}

/**
 * Remove duplicates that could happen when results have cartesian product.
 */
export function deduplicateTable(
    table: SparqlTableResult,
    specifiedIdCols: string[],
): MulticardinalRow[] {
    // NOTE: restvalues are temporarily stored in a set, so that duplicate values are eliminated.
    interface TmpRow {
        idCols: string[],
        idValues: MutableHashMap.MutableHashMap<string, string>,
        restCols: string[],
        restValues: MutableHashMap.MutableHashMap<string, MutableHashSet.MutableHashSet<string>>
    }

    // NOTE: Non-existent columns get ignored and should not affect the deduplication.
    const idCols = specifiedIdCols.filter((col) => table.head.vars.includes(col));

    const cols = table.head.vars;
    if (cols.length === 0) return [];

    const restCols = table.head.vars.filter((col) => !idCols.includes(col));

    const collectingMap = MutableHashMap.fromIterable<readonly string[], TmpRow>([]);

    const getOrCreate = (idValues: TmpRow["idValues"]): TmpRow => {
        const key: readonly string[] = Data.array(idCols.map((col) => idValues.pipe(
            MutableHashMap.get(col),
            Option.getOrThrow,
        )));

        return Option.getOrElse(
            collectingMap.pipe(MutableHashMap.get(key)),
            () => {
                const newValue: TmpRow = {
                    idCols,
                    idValues,
                    restCols,
                    restValues: MutableHashMap.fromIterable([]),
                };
                collectingMap.pipe(MutableHashMap.set(key, newValue));
                return newValue;
            }
        );
    }

    const pushRestValue = (row: TmpRow, restCol: string, restValue: string) => {
        let valueToModify: MutableHashSet.MutableHashSet<string>;

        if (row.restValues.pipe(MutableHashMap.has(restCol))) {
            valueToModify = row.restValues.pipe(MutableHashMap.get(restCol), Option.getOrThrow);
        } else {
            valueToModify = MutableHashSet.fromIterable([]);
            row.restValues.pipe(MutableHashMap.set(restCol, valueToModify))
        }

        valueToModify.pipe(MutableHashSet.add(restValue));
    };

    for (const tableRow of table.results.bindings) {
        const idValues = MutableHashMap.fromIterable(
            idCols.map((col) => [col, tableRow[col].value])
        );

        const tmpRow = getOrCreate(idValues);

        Object.entries(tableRow).forEach(([k, { value }]) => {
            if (idCols.includes(k)) return;
            pushRestValue(tmpRow, k, value);
        });
    }

    const mutableHashMapToEntries = <K, V>(
        map: MutableHashMap.MutableHashMap<K, V>,
    ): [K, V][] => {
        const keys = map.pipe(MutableHashMap.keys);
        // NOTE: Using `Option.getOrThrow` because the keys must exist
        return keys.map((k) => [k, map.pipe(MutableHashMap.get(k), Option.getOrThrow)]);
    }

    return collectingMap
        .pipe(MutableHashMap.values)
        .map(({
            idValues: oldIdValues,
            restValues: oldRestValues,
            ...other
        }) => {
            const idValues = Object.fromEntries(mutableHashMapToEntries(oldIdValues));
            const restValues = Object.fromEntries(
                mutableHashMapToEntries(oldRestValues)
                    .map(([k, v]) => [k, [...v]])
            );

            return {
                idValues,
                restValues,
                ...other,
            };
        });
}

export function tableToRows(table: SparqlTableResult) {
    const cols = table.head.vars;
    if (cols.length !== 3) {
        throw new Error(`Expected 3 columns for table, got ${cols.length}`);
    }

    const collectingMap = new Map<string, MulticardinalRow>();

    const getOrCreate = (subject: string): MulticardinalRow => {
        const maybeEntry = collectingMap.get(subject);
        if (maybeEntry) return maybeEntry;

        const entry: MulticardinalRow = {
            idCols: ["id"],
            idValues: { id: subject },
            restCols: [],
            restValues: {},
        };

        collectingMap.set(subject, entry);
        return entry;
    }

    const pushRestValue = (row: MulticardinalRow, restCol: string, restValue: string) => {
        let arr: string[];

        if (restCol in row.restValues) {
            arr = row.restValues[restCol];
        } else {
            arr = [];
            // NOTE: if restCol wasn't in map then it shouldn't be in array and we need to push it.
            row.restCols.push(restCol);
            row.restValues[restCol] = arr;
        }

        arr.push(restValue);
    };

    for (const item of table.results.bindings) {
        const subject = item[cols[0]].value;
        const predicate = item[cols[1]].value;
        const object = item[cols[2]].value;

        const entry = getOrCreate(subject);
        pushRestValue(entry, predicate, object);
    }

    return [...collectingMap.values()];
}
