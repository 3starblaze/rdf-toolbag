import type { MulticardinalTableData } from "@/multi-cardinal-table-util";
import { findVars } from "@/query-util";
import type { RdfTerm } from "@/sparql_queries";
import { Option, MutableHashMap, Data, Equal, HashMap } from "effect";
import { fmtVars, formatTermAsLiteral } from "./util";

type CellKey = MulticardinalTableData["rows"][number]["idValues"];

export interface CellRequest {
  limit: number,
  key: CellKey,
  column: string,
}

export interface MCTCell extends CellRequest {
  values: RdfTerm[],
}

export function initialCellRequests({
  keys,
  queryToWrap,
  idVars,
  limit,
}: {
  keys: CellKey[],
  queryToWrap: string,
  idVars: string[],
  limit: number,
}): CellRequest[] {
  const columns = findVars({ query: queryToWrap }).filter((it) => !idVars.includes(it));

  return keys.flatMap((key) => columns.map((column) => ({
    column,
    key,
    limit,
  }) satisfies CellRequest));
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

export function formatCellQuery({
  idVars,
  cellRequest: { column, key, limit },
  propNameVar,
  propValVar,
  baseQuery,
}: {
  idVars: string[],
  cellRequest: CellRequest,
  propNameVar: string,
  propValVar: string,
  baseQuery: string,
}) {
  return `SELECT ${fmtVars([...idVars, propNameVar, propValVar])} WHERE {
      {${baseQuery}}
      ${formatValues(idVars, [key])}
      BIND("${column}" AS ?${propNameVar})
      BIND(?${column} AS ?${propValVar})
    } LIMIT ${limit}`;
}

export function multicardinalTableToCells(
  data: MulticardinalTableData,
  limit: number,
): MCTCell[] {
  const { restCols, rows } = data;

  const unmergedCells = rows.flatMap((it) => restCols.map((column) => ({
    column,
    key: it.idValues,
    limit,
    values: it.restValues[column],
  }) satisfies MCTCell));


  const collector = MutableHashMap.empty<CellKey, MCTCell[]>();

  // NOTE: Group by key
  unmergedCells.forEach((cell) => {
    const key = cell.key;

    collector.pipe(MutableHashMap.modifyAt(key, (cells) => {
      const current = Option.getOrElse(cells, () => []);
      return Option.some([...current, cell]);
    }));
  });

  // NOTE: Merge each group
  return collector
    .pipe(MutableHashMap.values)
    .flatMap((cells) => {
      // NOTE: Shouldn't happen but handling this explicitly just in case
      if (cells.length === 0) return [];
      // NOTE: These will be the same
      const { column, key, limit } = cells[0];
      return {
        column,
        key,
        limit,
        values: cells.flatMap((it) => it.values),
      } satisfies MCTCell;
    });
}

// NOTE: Data.struct/Data.array only compare nested values by value if those are Data values too,
// so convert the whole value tree recursively
function toValueData<T>(value: T): T {
  if (Array.isArray(value)) return Data.array(value.map(toValueData)) as T;
  if (value !== null && typeof value === "object") {
    return Data.struct(Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toValueData(v)] as const),
    )) as T;
  }
  return value;
}

/**
 * Convert from cells to multicardinal table and sort by `idVals`.
 **/
export function cellsToMulticardinalTable(
  cells: MCTCell[],
  idVals: CellKey[],
): MulticardinalTableData["rows"] {
  const collector = MutableHashMap.empty<CellKey, MCTCell[]>();

  // NOTE: Group by key
  cells.forEach((cell) => {
    const key = toValueData(cell.key);

    collector.pipe(MutableHashMap.modifyAt(key, (cells) => {
      const current = Option.getOrElse(cells, () => []);
      return Option.some([...current, cell]);
    }));
  });

  return collector
    .pipe(MutableHashMap.values)
    .flatMap((cells) => {
      if (cells.length === 0) return [];
      const { key } = cells[0];
      return {
        idValues: key,
        restValues: Object.fromEntries(cells.map((it) => [it.column, it.values] as const)),
      } satisfies MulticardinalTableData["rows"][number];
    }).toSorted((a, b) => {
      // FIXME: Sorting not working as expected
      const aNew = idVals.findIndex((it) => Equal.equals(toValueData(it), toValueData(a.idValues)));
      const bNew = idVals.findIndex((it) => Equal.equals(toValueData(it), toValueData(b.idValues)));

      return aNew - bNew;
    });
}
