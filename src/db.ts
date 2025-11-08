import initSqlJs from "sql.js";
import sqlJsWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

import dbPath from "../public/yoma-100k-archetypes.db?url";

const sqlPromise = await initSqlJs({
    locateFile: (_file) => sqlJsWasmUrl,
});
const dataPromise = fetch(dbPath).then(res => res.arrayBuffer());

const [SQL, dbData] = await Promise.all([sqlPromise, dataPromise]);

export const db = new SQL.Database(new Uint8Array(dbData));
