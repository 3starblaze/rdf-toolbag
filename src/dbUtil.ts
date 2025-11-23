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

function parseArchetype(
    archetypeString: string,
): string[] {
    // HACK: archetype should have been a proper JSON array but it's not because it lacks quotes
    return archetypeString.slice(1, -1).split(",");
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
        return {
            ...rest,
            archetype: parseArchetype(archetype as string),
        };
    });

    return parsedRes as unknown as TopArchetype[];
}

export function getAvailableTypes(
    db: Database,
    limit: number,
): {type: string}[] {
    const tableName = "entity_type_cache";

    const stmtString = `SELECT DISTINCT type
FROM ${tableName}
LIMIT ?`;

    const stmt = db.prepare(stmtString);
    stmt.bind([limit]);
    const res = resToObjectArray(stmt) as {type: string}[];

    return res;
}

export type TypeArchetypeCountRow = {
    archetype_id: number,
    type: string,
    count: number,
};

export function getTypeArchetypeCounts(
    db: Database,
): TypeArchetypeCountRow[] {
    const typeCacheTableName = "entity_type_cache";
    const entityToArchetypeTableName = defaultSerializationConfig.entityToArchetypeIdTable;

    const stmtString = `
SELECT
  archetype_id,
  type,
  COUNT(*) as count
FROM
  ${typeCacheTableName}
JOIN
  ${entityToArchetypeTableName}
  ON ${typeCacheTableName}.entity=${entityToArchetypeTableName}.entity
GROUP BY
  archetype_id, type
ORDER BY
  type,
  archetype_id,
  count DESC
`;

    const stmt = db.prepare(stmtString);
    stmt.bind();

    const res = resToObjectArray(stmt) as TypeArchetypeCountRow[];

    return res;
}
