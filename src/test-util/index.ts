import type { SparqlTableResult } from "@/sparql_queries";
import { Store, parse } from "oxigraph";

export function ttlStringToStore(ttlString: string): Store {
  const items = parse(ttlString, { format: "text/turtle" });
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
