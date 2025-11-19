/**
 * Various helpers for extracting data from the archetype database.
 */

import {
    ParamsObject,
    Statement,
    type Database,
} from "sql.js";

const defaultSerializationConfig = {
    entityToArchetypeIdTable: "entity_to_archetype",
    idToArchetypeTable: "id_to_archetype",
} as const;


function resToObjectArray(
    stmt: Statement,
): ParamsObject[] {
    let res: ParamsObject[] = [];

    while (stmt.step()) {
        const val = stmt.getAsObject();
        res.push(val);
    }

    return res;
}


export function getUniqueArchetypeCount(
    db: Database,
): number {
    const tableName = defaultSerializationConfig.idToArchetypeTable;
    const queryRes = db.exec(`
select count(*)
from ${tableName}
WHERE cached_entity_count > 0
;`
    );
    const res = queryRes[0].values[0][0];
    if (typeof res !== "number") {
        throw new Error(`Unexpected type for value ${res} (${typeof res}) !`);
    }
    return res;
}


export interface TopArchetype {
    archetype_id: number,
    cnt: number,
    archetype: string[],
}

export function getTopArchetypes(
    db: Database,
    limit: number,
): TopArchetype[] {
    const table0 = defaultSerializationConfig.idToArchetypeTable;

    const stmtString = `
select id as archetype_id, cached_entity_count as cnt, archetype
from ${table0}
where cached_entity_count > 0
order by cnt desc
limit ?;`

    const stmt = db.prepare(stmtString);

    stmt.bind([limit]);
    const res = resToObjectArray(stmt);
    const parsedRes = res.map(({ archetype, ...rest}) => {
        // HACK: archetype should have been a proper JSON array but it's not because it lacks quotes
        return {
            ...rest,
            archetype: (archetype as string).slice(1, -1).split(","),
        };
    });

    return parsedRes as unknown as TopArchetype[];
}
