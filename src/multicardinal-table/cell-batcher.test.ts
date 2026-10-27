import { describe, expect, test, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { batchByColumn, createCellBatcher } from './cell-batcher';
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
  const signal = new AbortController().signal;

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
      batcher.load(request("name", "a"), signal),
      batcher.load(request("age", "a"), signal),
      batcher.load(request("name", "b"), signal),
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
      batcher.load(request("name", "a", 2), signal),
      batcher.load(request("name", "b", 7), signal),
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
      batcher.load(request("name", "a"), signal),
      batcher.load(request("name", "b"), signal),
    ]);

    expect(results.map((it) => it.status)).toEqual(["rejected", "rejected"]);
  });
});

describe('cancelling cell requests', () => {
  const idVars = ["item"];

  // NOTE: A query that stays in flight until its signal is aborted, like a slow network request.
  function hangingQuery({ signal }: { query: string, signal?: AbortSignal }): Promise<SparqlTableResult> {
    return new Promise((_, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason));
    });
  }

  test('aborts the query of a batch once its only request is cancelled', async () => {
    const queryCallback = vi.fn(hangingQuery);
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });

    const controller = new AbortController();
    const cell = batcher.load(request("name", "a"), controller.signal);
    await vi.waitFor(() => expect(queryCallback).toHaveBeenCalledTimes(1));

    const querySignal = queryCallback.mock.calls[0][0].signal;
    expect(querySignal?.aborted).toBe(false);

    controller.abort();

    expect(querySignal?.aborted).toBe(true);
    await expect(cell).rejects.toBeDefined();
  });

  test('keeps the query of a batch running while another request in it is still active', async () => {
    const queryCallback = vi.fn(hangingQuery);
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });

    const cancelled = new AbortController();
    const active = new AbortController();
    batcher.load(request("name", "a"), cancelled.signal).catch(() => {});
    batcher.load(request("name", "b"), active.signal).catch(() => {});
    await vi.waitFor(() => expect(queryCallback).toHaveBeenCalledTimes(1));

    const querySignal = queryCallback.mock.calls[0][0].signal;
    cancelled.abort();
    expect(querySignal?.aborted).toBe(false);

    active.abort();
    expect(querySignal?.aborted).toBe(true);
  });

  test('does not send a query for a request cancelled before it is flushed', async () => {
    const queryCallback = vi.fn(async () => ({
      head: { vars: [] },
      results: { bindings: [] },
    }) as unknown as SparqlTableResult);
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });

    const controller = new AbortController();
    const cell = batcher.load(request("name", "a"), controller.signal);
    controller.abort();

    await expect(cell).rejects.toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryCallback).not.toHaveBeenCalled();
  });

  test('cancels the in-flight query when the query client cancels the cell', async () => {
    // NOTE: Mirrors how `useCells` loads a cell, so the signal React Query hands over is the one used
    const queryClient = new QueryClient();
    const queryCallback = vi.fn(hangingQuery);
    const batcher = createCellBatcher({
      baseQuery: "SELECT * WHERE { ?item ?p ?o }",
      idVars,
      queryCallback,
      batchingStrategy: batchByColumn,
    });
    const cellRequest = request("name", "a");

    const cell = queryClient.fetchQuery({
      queryKey: ["useCell", cellRequest],
      queryFn: ({ signal }) => batcher.load(cellRequest, signal),
      retry: false,
    });
    cell.catch(() => {});
    await vi.waitFor(() => expect(queryCallback).toHaveBeenCalledTimes(1));

    const querySignal = queryCallback.mock.calls[0][0].signal;
    await queryClient.cancelQueries({ queryKey: ["useCell", cellRequest] });

    expect(querySignal?.aborted).toBe(true);
  });
});
