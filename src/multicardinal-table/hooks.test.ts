import { describe, expect, test } from 'vitest';
import { getRestColumns } from './hooks';
import type { CellRequest } from '@/compact-pagination/cell';
import type { Row } from './shared';

const cellRequest = (column: string): CellRequest => ({
  column,
  key: { s: { type: "uri", value: "a" } },
  limit: 5,
});

const row = (restValues: Row["restValues"]): Row => ({
  idValues: { s: { type: "uri", value: "a" } },
  restValues,
});

const value = { type: "uri", value: "x" } as const;

describe('getRestColumns', () => {
  const queryToWrap = "SELECT * WHERE { ?s ?p ?o. }";
  const idVars = ["s"];

  test('excludes id vars and keeps the query variable order', () => {
    const columns = getRestColumns({
      queryToWrap,
      idVars,
      data: [row({ p: [value], o: [value] })],
      loadingIncreasedCellRequests: [],
      erroredCellRequests: [],
    });

    expect(columns).toEqual(["p", "o"]);
  });

  test('follows the order of an explicit select list', () => {
    const columns = getRestColumns({
      queryToWrap: "SELECT ?s ?o ?p WHERE { ?s ?p ?o. }",
      idVars,
      data: [row({ p: [value], o: [value] })],
      loadingIncreasedCellRequests: [],
      erroredCellRequests: [],
    });

    expect(columns).toEqual(["o", "p"]);
  });

  test('keeps the query order when a column is loading after a limit increase', () => {
    // NOTE: The increased cell is not in the settled data, so its column has no values here
    const columns = getRestColumns({
      queryToWrap,
      idVars,
      data: [row({ o: [value] })],
      loadingIncreasedCellRequests: [cellRequest("p")],
      erroredCellRequests: [],
    });

    expect(columns).toEqual(["p", "o"]);
  });

  test('keeps the query order when a column has errored', () => {
    const columns = getRestColumns({
      queryToWrap,
      idVars,
      data: [row({ o: [value] })],
      loadingIncreasedCellRequests: [],
      erroredCellRequests: [cellRequest("p")],
    });

    expect(columns).toEqual(["p", "o"]);
  });

  test('hides columns without values in any shown row', () => {
    const columns = getRestColumns({
      queryToWrap,
      idVars,
      data: [row({ p: [], o: [value] }), row({ p: [] })],
      loadingIncreasedCellRequests: [],
      erroredCellRequests: [],
    });

    expect(columns).toEqual(["o"]);
  });

  test('does not depend on the order of the cell requests', () => {
    // NOTE: Increasing a limit moves its request to the end of the request list
    const forward = getRestColumns({
      queryToWrap,
      idVars,
      data: [row({})],
      loadingIncreasedCellRequests: [cellRequest("p"), cellRequest("o")],
      erroredCellRequests: [],
    });
    const reversed = getRestColumns({
      queryToWrap,
      idVars,
      data: [row({})],
      loadingIncreasedCellRequests: [cellRequest("o"), cellRequest("p")],
      erroredCellRequests: [],
    });

    expect(forward).toEqual(["p", "o"]);
    expect(reversed).toEqual(["p", "o"]);
  });
});
