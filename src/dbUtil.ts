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
    const tableName = defaultSerializationConfig.entityToArchetypeIdTable;
    const queryRes = db.exec(`select count(distinct archetype_id) from ${tableName};`);
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
    const table0 = defaultSerializationConfig.entityToArchetypeIdTable;
    const table1 = defaultSerializationConfig.idToArchetypeTable;

    const stmtString = `
select archetype_id, count(*) as cnt, archetype
from ${table0}
left join ${table1} on archetype_id=${table1}.id
group by archetype_id
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
