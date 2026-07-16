import { expect, test, describe } from "vitest";
import {
  formatPaginatedQuery,
  formatPaginatedCounterQuery,
} from "./compact-pagination";

function expectPrefixesToNotBeNested(query: string) {
    const lines = query.split("\n");

    const lineIsPrefixStmt = (line: string) => !!line.match(/\s*PREFIX/);
    const lineIsBlank = (line: string) => !!line.match(/^\s*$/);

    const maxPrefixIndex = ([...lines.entries()])
        .filter(([_, l]) => lineIsPrefixStmt(l))
        .map(([i]) => i)
        .reduce((a, b) => Math.max(a, b));

    expect(lines.slice(0, maxPrefixIndex + 1))
        .toSatisfyAll((line) => lineIsPrefixStmt(line) || lineIsBlank(line));
}

const propNameVar = "__propName";
const propValVar = "__propVal";

describe("formatPaginatedQuery", () => {
  test("basic query with one distinct variable", () => {
    const q = `
SELECT * WHERE {
  ?sub ?pred ?obj .
}
`;
    const res = formatPaginatedQuery({
      queryToWrap: q,
      groupLimit: 50,
      groupOffset: 100,
      globalLimit: 1000,
      idVars: ["sub"],
      propNameVar,
      propValVar,
    });
    // NOTE: Should have a distinct query involving the ?sub column
    expect(res).toMatch(/SELECT\s+DISTINCT\s+\?sub/);
    // NOTE: Match passed parameters
    expect(res).toMatch(/LIMIT 50/);
    expect(res).toMatch(/OFFSET 100/);
    expect(res).toMatch(/LIMIT 1000/);
    // NOTE: Those vars should appear
    expect(res).toMatch(`?${propNameVar}`);
    expect(res).toMatch(`?${propValVar}`);
  });

  test("basic query with two distinct variables", () => {
    const q = `
SELECT * WHERE {
  ?sub ?pred ?obj .
}
`;
    const res = formatPaginatedQuery({
      queryToWrap: q,
      groupLimit: 20,
      groupOffset: 30,
      globalLimit: 2000,
      idVars: ["sub", "pred"],
      propNameVar,
      propValVar,
    });

    // NOTE: Match "DISTINCT ?sub ?pred"
    expect(res).toMatch(/SELECT\s+DISTINCT\s+\?sub\s+\?pred/);
    // NOTE: Match passed parameters
    expect(res).toMatch(/LIMIT 20/);
    expect(res).toMatch(/OFFSET 30/);
    expect(res).toMatch(/LIMIT 2000/);
    // NOTE: Those vars should appear
    expect(res).toMatch(`?${propNameVar}`);
    expect(res).toMatch(`?${propValVar}`);
  });

  test("query with prefixes", () => {
    // NOTE: applying weird spacing to check that our function can handle various situations
    const q = `
    PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>

PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT * WHERE{
        ?Catalog rdf:type dcat:Catalog .
        OPTIONAL{?Catalog dct:title ?title .  }
        OPTIONAL{?Catalog dct:description ?description .  }
} LIMIT 20`;

    const res = formatPaginatedQuery({
      queryToWrap: q,
      groupLimit: 20,
      groupOffset: 30,
      globalLimit: 2000,
      idVars: ["Catalog"],
      propNameVar,
      propValVar,
    });

    expectPrefixesToNotBeNested(res);
  });
});


describe("formatPaginatedQuery", () => {
  test("basic limited query", () => {
    const globalRowCountVar = "__another_global_count";
    const groupedRowCountVar = "__another_grouped_count";
    const globalLimit = 1000;

    const queryToWrap = `SELECT * WHERE { ?sub ?pred ?obj }`;

    const q = formatPaginatedCounterQuery({
      globalRowCountVar,
      groupedRowCountVar,
      idVars: ["sub", "pred"],
      queryToWrap,
      globalLimit,
      propNameVar,
      propValVar
    });

    expect(q).toMatch(`?${globalRowCountVar}`);
    expect(q).toMatch(`?${groupedRowCountVar}`);
    expect(q).toMatch("?sub");
    expect(q).toMatch("?pred");
    expect(q).toMatch("?obj");
    expect(q).toMatch(`LIMIT ${globalLimit}`);
  });

  test("query with prefixes", () => {
    const globalRowCountVar = "__another_global_count";
    const groupedRowCountVar = "__another_grouped_count";
    const globalLimit = 1000;

    const queryToWrap = `
    PREFIX dcat: <http://www.w3.org/ns/dcat#>
PREFIX dct: <http://purl.org/dc/terms/>

PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT * WHERE{
        ?Catalog rdf:type dcat:Catalog .
        OPTIONAL{?Catalog dct:title ?title .  }
        OPTIONAL{?Catalog dct:description ?description .  }
} LIMIT 20`;

    const q = formatPaginatedCounterQuery({
      globalRowCountVar,
      groupedRowCountVar,
      idVars: ["sub", "pred"],
      queryToWrap,
      globalLimit,
    });

    expectPrefixesToNotBeNested(q);
  });
});
