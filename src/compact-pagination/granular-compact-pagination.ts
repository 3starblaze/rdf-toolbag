import { fmtVars, injectOrderBy, lineAwareIndent } from "@/compact-pagination/util";
import type { MulticardinalTableData } from "@/multi-cardinal-table-util";
import { findVars, splitQueryPreamble } from "@/query-util";
import type { RdfTerm, SparqlTableResult } from "@/sparql_queries";

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
  queryToWrap,
  idVars,
  propNameVar,
  propValVar,
  keyValues,
}: {
  queryToWrap: string,
  idVars: string[],
  propNameVar: string,
  propValVar: string,
  keyValues: MulticardinalTableData["rows"][number]["idValues"][],
}): string {
  const defaultCellLimit = 5;
  const { preamble, main } = splitQueryPreamble(queryToWrap);

  function formatTermAsLiteral(item: RdfTerm): string {
    if (item.type === "uri") return `<${item.value}>`;
    if (item.type === "literal") {
      // NOTE: If lang is defined, the item should be a string and thus we don't need to check
      // its datatype.
      if (item["xml:lang"]) return `"${item.value}"@${item["xml:lang"]}`;
      // NOTE: We are assuming that if datatype is defined, it's a URI (and thus is wrapped
      // in angle brackets).
      if (item.datatype) return `"${item.value}"^^<${item.datatype}>`;
      return `"${item.value}"`;
    }
    if (item.type === "bnode") return `_:${item.value}`;

    throw "unexpected";
  }

  function rawFormatValues(varNames: string[], literals: string[][]): string {
    return `VALUES (${fmtVars(varNames)}) {
      ${literals.map((tuple) => `(${tuple.join(" ")})`).join(" ") satisfies string}
    }`
  }

  function formatValues(
    varNames: string[],
    values: MulticardinalTableData["rows"][number]["idValues"][],
  ): string {
    return rawFormatValues(varNames, values.map((it) => varNames.map((varName) => {
      const item = it[varName];
      if (!item) return "UNDEF";
      return formatTermAsLiteral(item);
    })));
  }

  // NOTE: limit per cell
  function formatCellQuery(
    valueCol: string,
    keyValue: (typeof keyValues)[number],
  ) {
    return `SELECT ${fmtVars([...idVars, propNameVar, propValVar])} WHERE {
      {${main}}
      ${formatValues(idVars, [keyValue])}
      BIND("${valueCol}" AS ?${propNameVar})
      BIND(?${valueCol} AS ?${propValVar})
    } LIMIT ${defaultCellLimit}`;
  }

  const valueCols = findVars({ query: queryToWrap}).filter((it) => !idVars.includes(it));

  const cells = valueCols.flatMap((valueCol) => keyValues
    .flatMap((keyValue) => formatCellQuery(valueCol, keyValue))
  );

  const finalQuery = `${preamble}
  SELECT ${fmtVars([...idVars, propNameVar, propValVar])} WHERE {
    ${cells.map((it) => `{${it}}`).join(" UNION ")}
  }`;

  return finalQuery;
}
