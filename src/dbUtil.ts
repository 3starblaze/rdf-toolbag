/**
 * Various helpers for extracting data from the archetype database.
 */

import {
    type Database,
} from "sql.js";

const defaultSerializationConfig = {
    entityToArchetypeIdTable: "entity_to_archetype",
    idToArchetypeTable: "id_to_archetype",
} as const;


export function getUniqueArchetypeCount(
    db: Database,
): number {
    const tableName = defaultSerializationConfig.entityToArchetypeIdTable;
    const queryRes = db.exec(`select count(distinct archetype_id) from ${tableName};`);
    const res = queryRes[0].values[0][0];
    if (typeof res !== "number") {
        throw new Error(`Unexpected type for value ${res} (${typeof res}) !`);
    }
    return res;
}
