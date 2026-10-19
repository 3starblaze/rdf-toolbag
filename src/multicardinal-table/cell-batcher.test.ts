import { describe, expect, test, vi } from 'vitest';
import { batchByColumn, batchByCount, createCellBatcher } from './cell-batcher';
import type { CellRequest } from '@/compact-pagination/cell';
import type { SparqlTableResult } from '@/sparql_queries';

const request = (column: string, id: string, limit = 5): CellRequest => ({
  column,
  key: { item: { type: "uri", value: id } },
  limit,
});

describe('batchByColumn', () => {
  const requests = [
    request("name", "a"),
    request("age", "a"),
    request("name", "b"),
    request("age", "b"),
    request("city", "a"),
  ];

  test('groups requests by column, keeping request order', () => {
    const batches = batchByColumn(requests);
    expect(batches.map((batch) => batch.map((it) => it.column))).toEqual([
      ["name", "name"],
      ["age", "age"],
      ["city"],
    ]);
  });

  test('returns no batches for no requests', () => {
    expect(batchByColumn([])).toEqual([]);
  });
});

describe('createCellBatcher', () => {
  const idVars = ["item"];

  // NOTE: Returns one "name" value per item in the query so that values can be unpacked.
  function fakeTable(query: string): SparqlTableResult {
    const columns = [...new Set([...query.matchAll(/BIND\("([^"]+)" AS/g)].map((it) => it[1]))];
    const bindings = columns.flatMap((column) => [{
      item: { type: "uri", value: "a" },
      __propName: { type: "literal", value: column },
      __propVal: { type: "literal", value: `${column}-value` },
    }]);
    return {
      head: { vars: ["item", "__propName", "__propVal"] },
      results: { bindings },
    } as unknown as SparqlTableResult;
  }

  test('batches requests made in the same tick into one query per batch', async () => {
    const queryCallback = vi.fn(async ({ query }: { query: string }) => fakeTable(query));
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });

    const cells = await Promise.all([
      batcher.load(request("name", "a")),
      batcher.load(request("age", "a")),
      batcher.load(request("name", "b")),
    ]);

    expect(queryCallback).toHaveBeenCalledTimes(2);
    expect(cells.map((it) => it.column)).toEqual(["name", "age", "name"]);
    expect(cells[0].values).toEqual([{ type: "literal", value: "name-value" }]);
  });

  test('keeps each cell limit in the query and on the returned cell', async () => {
    const queryCallback = vi.fn(async ({ query }: { query: string }) => fakeTable(query));
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });

    const cells = await Promise.all([
      batcher.load(request("name", "a", 2)),
      batcher.load(request("name", "b", 7)),
    ]);

    const query = queryCallback.mock.calls[0][0].query;
    expect(query).toContain("LIMIT 2");
    expect(query).toContain("LIMIT 7");
    expect(cells.map((it) => it.limit)).toEqual([2, 7]);
  });

  test('rejects every request of a failing batch', async () => {
    const queryCallback = vi.fn(async () => { throw new Error("boom"); });
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });

    const results = await Promise.allSettled([
      batcher.load(request("name", "a")),
      batcher.load(request("name", "b")),
    ]);

    expect(results.map((it) => it.status)).toEqual(["rejected", "rejected"]);
  });
});
