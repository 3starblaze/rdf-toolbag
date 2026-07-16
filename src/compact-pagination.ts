import { findVars, splitQueryPreamble } from "./query-util";

const indentation = "  ";
const indent = (line: string) => `${indentation}${line}`;
const lineAwareIndent = (src: string) => src.split("\n").map(indent).join("\n");
const fmtVars = (vars: string[]) => vars.map((it) => `?${it}`).join(" ");
const fmtSubquery = (subquery: string) => lineAwareIndent(["{", subquery, "}"].join("\n"));

/**
 * Get lines of queries needed for proper propName and propVal usage.
 */
function formatPropConstraints({
  query,
  idVars,
  propNameVar,
  propValVar,
}: {
  query: string,
  idVars: string[],
  propNameVar: string,
  propValVar: string,
}) {
  const valueVars: string[] = findVars({ query }).filter((it) => !idVars.includes(it));

  // NOTE: N/A value shouldn't ever appear but we have to put some value
  const makeIfExpr = ([thisVar, ...rest]: string[]): string => thisVar
    ? `IF(?${propNameVar} = "${thisVar}", ?${thisVar}, ${makeIfExpr(rest)})`
    : '"N/A"';

  return [
    `VALUES ?${propNameVar} { ${valueVars.map((it) => `"${it}"`).join(" ")} }`,
    `BIND(${makeIfExpr(valueVars)} AS ${propValVar})`,
  ].join("\n");
}

export function formatPaginatedQuery({
  queryToWrap: query,
  idVars,
  groupLimit,
  globalLimit,
  groupOffset,
  propNameVar,
  propValVar,
}: {
  queryToWrap: string,
  idVars: string[],
  groupLimit: number,
  groupOffset: number,
  globalLimit: number,
  propNameVar: string,
  propValVar: string,
}): string {
  const { preamble, main } = splitQueryPreamble(query);

  const selectedVars = [...idVars, propNameVar, propValVar];

  const keyConstraintSubquery = `SELECT DISTINCT ${fmtVars(idVars)}
WHERE {
${lineAwareIndent(main)}
}
LIMIT ${groupLimit}
OFFSET ${groupOffset}`;

  const res = [
    preamble,
    `SELECT DISTINCT ${fmtVars(selectedVars)} {`,
    fmtSubquery(keyConstraintSubquery),
    fmtSubquery(main),
    formatPropConstraints({ idVars, propNameVar, propValVar, query }),
    `} LIMIT ${globalLimit}`,
  ].join("\n");

  return res;
}


export function formatPaginatedCounterQuery({
  queryToWrap,
  idVars,
  globalLimit,
  propNameVar,
  propValVar,
  globalRowCountVar,
  groupedRowCountVar,
}: {
  queryToWrap: string,
  idVars: string[],
  globalLimit: number,
  propNameVar: string,
  propValVar: string,
  globalRowCountVar: string,
  groupedRowCountVar: string,
}) {
  const { preamble, main } = splitQueryPreamble(queryToWrap);

  const limitedSubquery: string = [
    "SELECT DISTINCT * {",
    lineAwareIndent(main),
    lineAwareIndent(
      formatPropConstraints({ query: queryToWrap, idVars, propNameVar, propValVar })
    ),
    `} LIMIT ${globalLimit}`,
  ].join("\n");

  const query = [
    preamble,
    "SELECT",
    `(COUNT(DISTINCT *) AS ?${globalRowCountVar})`,
    `(COUNT(DISTINCT ${fmtVars(idVars)}) AS ?${groupedRowCountVar})`,
    "{",
    fmtSubquery(limitedSubquery),
    "}",
  ].join("\n");

  return query;
}
