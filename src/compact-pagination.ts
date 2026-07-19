import type { MulticardinalRow } from "./multi-cardinal-table-util";
import { findVars, splitQueryPreamble } from "./query-util";
import type { SparqlTableResult } from "./sparql_queries";
import { Data, Option, MutableHashMap } from "effect";

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
    `BIND(${makeIfExpr(valueVars)} AS ?${propValVar})`,
    // NOTE: `valueVars` may contain vars that will never appear in results and we need to filter
    // those rows out to reduce noise.
    `FILTER ( BOUND(?${propValVar}) )`,
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
    `SELECT ${fmtVars(idVars)} WHERE {`,
    fmtSubquery(main),
    lineAwareIndent(
      formatPropConstraints({ query: queryToWrap, idVars, propNameVar, propValVar })
    ),
    `} LIMIT ${globalLimit}`,
  ].join("\n");

  // NOTE: Limited subquery first selects "DISTINCT *" tuples and then keeps only id vars. This way
  // we can use COUNT(*) and COUNT(DISTINCT *) to get expected results.
  const query = [
    preamble,
    "SELECT",
    `(COUNT(*) AS ?${globalRowCountVar})`,
    `(COUNT(DISTINCT *) AS ?${groupedRowCountVar})`,
    "WHERE {",
    fmtSubquery(limitedSubquery),
    "}",
  ].join("\n");

  return query;
}

export function tableToMulticardinalRow({
  propNameVar,
  propValVar,
  resultingTable,
}: {
  resultingTable: SparqlTableResult,
  propNameVar: string,
  propValVar: string,
}): MulticardinalRow[] {
  const vars = resultingTable.head.vars;
  if (!vars.includes(propNameVar)) throw new Error(`Could not find ${propNameVar}`);
  if (!vars.includes(propValVar)) throw new Error(`Could not find ${propValVar}`);

  const idCols = vars.filter((it) => it !== propNameVar && it !== propValVar);

  type BindingItem = SparqlTableResult["results"]["bindings"][number]

  const collectingMap = MutableHashMap.fromIterable<readonly string[], BindingItem[]>([]);

  resultingTable.results.bindings.forEach((it) => {
    const mapKey = Data.array(idCols.map((idCol) => it[idCol].value));
    collectingMap.pipe(
      MutableHashMap.modifyAt(mapKey, (items) => {
        const current = Option.getOrElse(items, () => []);
        return Option.some([...current, it]);
      })
    );
  });

  const res: MulticardinalRow[] = collectingMap
    .pipe(MutableHashMap.keys)
    .map((k) => {
      const items = collectingMap.pipe(MutableHashMap.get(k), Option.getOrThrow);
      const propToVal = items.map((it) => [it[propNameVar].value, it[propValVar].value] as const);

      const propMap = new Map<string, string[]>();
      propToVal.forEach(([prop, val]) => propMap.set(prop, [...propMap.get(prop) ?? [], val]));

      return {
        idCols,
        idValues: Object.fromEntries(idCols.map((col, i) => [col, k[i]] as const)),
        restCols: [...propMap.keys()],
        restValues: Object.fromEntries(propMap),
      };
    });

  return res;
}
