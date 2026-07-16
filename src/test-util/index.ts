import type { SparqlTableResult } from "@/sparql_queries";
import fs from "node:fs/promises";
import path from "node:path";
import { Store, parse } from "oxigraph";

// NOTE: in "./SWAPI-WD-data.ttl" file renamed @zh-classical to @zh-cls because oxigraph didn't
// want to accept that long language tag.

export async function loadSWAPIStore() {
  const filename = path.join(__dirname, "./SWAPI-WD-data.ttl");
  const ttlStream = await fs.readFile(filename);
  const items = parse(ttlStream, { format: "text/turtle" });
  const store = new Store(items);
  return store;
}

export function queryStore(store: Store, query: string): SparqlTableResult {
  const res = store.query(query, { results_format: "application/sparql-results+json" });

  // NOTE: With json results_format specified, we shouldn't be able to get anything else.
  if (typeof res !== "string") throw "unexpected";

  // NOTE: Maybe validate after parsing?
  return JSON.parse(res);
}
