import { fmtVars, injectOrderBy, lineAwareIndent } from "@/compact-pagination/util";
import type { MulticardinalTableData } from "@/multi-cardinal-table-util";
import { splitQueryPreamble } from "@/query-util";
import type { SparqlTableResult } from "@/sparql_queries";
import { formatCellQuery, type CellRequest } from "./cell";

/**
 * Format query that only retrieves grouped result keys.
 */
export function formatKeyQuery({
  queryToWrap,
  idVars,
  groupOffset,
  groupLimit,
}: {
  queryToWrap: string,
  idVars: string[],
  groupOffset: number,
  groupLimit: number,
}) {
  const { preamble, main } = splitQueryPreamble(queryToWrap);

  const initialConstraint = `SELECT DISTINCT ${fmtVars(idVars)}
WHERE {
${lineAwareIndent(main)}
}
LIMIT ${groupLimit}
OFFSET ${groupOffset}`;

  const orderedWithPrefix = injectOrderBy({
    queryToWrap,
    // NOTE: We need to inject preamble so that parser can recognize prefixes
    newQuery: preamble.concat(initialConstraint),
  });

  // NOTE: And then remove prefixes so that we can use this as subquery
  return orderedWithPrefix;
}

export function parseKeyQueryResults({
  table,
  idVars,
}: {
  table: SparqlTableResult,
  idVars: string[],
}): MulticardinalTableData["rows"][number]["idValues"][] {
  // NOTE: There might be more vars but as long as we have the required ones, it is fine.
  if (!idVars.every((varName) => table.head.vars.includes(varName))) {
    throw new Error("Results do not include all vars!");
  }

  return table.results.bindings.map((it) => {
    const entries = idVars.map((varName) => [varName, it[varName] ?? null] as const);
    return Object.fromEntries(entries);
  });
}

export function formatPaginatedQuery({
  cellRequests,
  queryToWrap,
  idVars,
  propNameVar,
  propValVar,
}: {
  cellRequests: CellRequest[],
  queryToWrap: string,
  idVars: string[],
  propNameVar: string,
  propValVar: string,
}): string {
  const { preamble, main } = splitQueryPreamble(queryToWrap);

  const cellQueries = cellRequests.map((cellRequest) => formatCellQuery({
    baseQuery: main,
    cellRequest,
    idVars,
    propNameVar,
    propValVar,
  }));

  const finalQuery = `${preamble}
  SELECT ${fmtVars([...idVars, propNameVar, propValVar])} WHERE {
    ${cellQueries.map((it) => `{${it}}`).join(" UNION ")}
  }`;

  return finalQuery;
}
