import { describe, expect, test } from 'vitest';
import { cellsToMulticardinalTable, type MCTCell } from './cell';
import type { RdfTerm } from '@/sparql_queries';
import type { MulticardinalTableData } from '@/multi-cardinal-table-util';

type CellKey = MCTCell["key"];

const iri = (value: string): RdfTerm => ({ type: "uri", value });
const literal = (value: string): RdfTerm => ({ type: "literal", value });

describe('cellsToMulticardinalTable', () => {
  // NOTE: idVals is not equal to idVals.sorted() to ensure that order is actually determined by
  // these keys, not by string sort order.
  const idVals = [
    { item: iri("http://example.com/c") },
    { item: iri("http://example.com/a") },
    { item: iri("http://example.com/b") },
  ] satisfies CellKey[];

  const cells: MCTCell[] = [
    { column: "name", key: { item: iri("http://example.com/a") }, limit: 10, values: [literal("Alice")] },
    { column: "age", key: { item: iri("http://example.com/a") }, limit: 10, values: [literal("30")] },
    { column: "name", key: { item: iri("http://example.com/b") }, limit: 10, values: [literal("Bob")] },
    { column: "age", key: { item: iri("http://example.com/b") }, limit: 10, values: [literal("41")] },
    { column: "name", key: { item: iri("http://example.com/c") }, limit: 10, values: [literal("Carol")] },
    { column: "age", key: { item: iri("http://example.com/c") }, limit: 10, values: [literal("55")] },
  ];

  const initialResult = cellsToMulticardinalTable(cells, idVals);

  test("initial result matches expected table", () => {
    const expectedRows: MulticardinalTableData["rows"] = [
      {
        idValues: { item: iri("http://example.com/c") },
        restValues: { name: [literal("Carol")], age: [literal("55")] },
      },
      {
        idValues: { item: iri("http://example.com/a") },
        restValues: { name: [literal("Alice")], age: [literal("30")] },
      },
      {
        idValues: { item: iri("http://example.com/b") },
        restValues: { name: [literal("Bob")], age: [literal("41")] },
      },
    ];

    expect(initialResult).toEqual(expectedRows);
  });

  test("reversed order does not change result", () => {
    const reversedCells = cells.toReversed();
    const reversedResult = cellsToMulticardinalTable(reversedCells, idVals);

    expect(initialResult).toEqual(reversedResult);
  });
});
