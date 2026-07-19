import { expect, test, describe } from "vitest";
import {
  formatPaginatedQuery,
  formatPaginatedCounterQuery,
  tableToMulticardinalRow,
  tableToCountPayload,
} from "./compact-pagination";
import { isQueryValid } from "./query-util";
import { queryStore, ttlStringToStore } from "./test-util";
import type { SparqlTableResult } from "./sparql_queries";
import type { MulticardinalRow } from "./multi-cardinal-table-util";

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

function expectValidQuery(query: string) {
  expect(isQueryValid(query)).toBeTrue();
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

    expect(res).toBeValidSparqlQuery();

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

    expectValidQuery(res);
    expectPrefixesToNotBeNested(res);
  });
});


describe("formatPaginatedCounterQuery", () => {
  test("basic limited query", () => {
    const globalRowCountVar = "__another_global_count";
    const groupedRowCountVar = "__another_grouped_count";
    const globalLimit = 1000;

    const queryToWrap = `SELECT * WHERE { ?sub ?pred ?obj }`;
    expect(queryToWrap).toBeValidSparqlQuery();

    const q = formatPaginatedCounterQuery({
      globalRowCountVar,
      groupedRowCountVar,
      idVars: ["sub", "pred"],
      queryToWrap,
      globalLimit,
      propNameVar,
      propValVar,
    });

    expect(q).toBeValidSparqlQuery();
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
    expectValidQuery(queryToWrap);

    const q = formatPaginatedCounterQuery({
      propNameVar,
      propValVar,
      globalRowCountVar,
      groupedRowCountVar,
      idVars: ["sub", "pred"],
      queryToWrap,
      globalLimit,
    });

    expect(q).toBeValidSparqlQuery();

    expectPrefixesToNotBeNested(q);
  });
});

describe("tableToMulticardinalRow", () => {
  test("basic example", () => {
    const v = (value: string) => ({ value, type: "literal" });

    const row = (a: string, b: string, c: string, d: string) => ({
      productType: v(a),
      color: v(b),
      [propNameVar]: v(c),
      [propValVar]: v(d),
    })

    const resultingTable: SparqlTableResult = {
      head: { vars: [propNameVar, propValVar, "productType", "color"] },
      results: {
        bindings: [
          row("watch", "blue", "price", "9999"),
          row("watch", "blue", "price", "4999"),
          row("watch", "blue", "buildType", "new"),

          row("watch", "black", "price", "7999"),
          row("watch", "black", "buildType", "new"),

          row("phone", "black", "price", "999"),
          row("phone", "black", "price", "899"),
          row("phone", "black", "buildType", "refurbished"),
        ],
      },
    };

    const rows = tableToMulticardinalRow({ propNameVar, propValVar, resultingTable });

    const idCols = ["productType", "color"];
    const restCols = ["price", "buildType"];

    const expectedRows: MulticardinalRow[] = [
      {
        idCols,
        idValues: { productType: "watch", color: "blue" },
        restCols,
        restValues: { price: ["9999", "4999"], buildType: ["new"] },
      },
      {
        idCols,
        idValues: { productType: "watch", color: "black" },
        restCols,
        restValues: { price: ["7999"], buildType: ["new"] },
      },
      {
        idCols,
        idValues: { productType: "phone", color: "black" },
        restCols,
        restValues: { price: ["999", "899"], buildType: ["refurbished"] },
      },
    ];

    expect(rows).toEqual(expectedRows);
  });
});

describe("pagination query tests", async () => {
  describe("basic test", () => {
    const ttl = `
    @base <https://example.com/resource/>.
    @prefix voc: <https://example.com/vocabulary/> .
    <watch/1>
      voc:productType voc:Watch;
      voc:color "blue";
      voc:price "9999";
      voc:buildType "new" .

    <watch/2>
      voc:productType voc:Watch;
      voc:color "blue";
      voc:notes "this is a budget-friendly option" ;
      voc:price "4999";
      voc:buildType "new" .

    <watch/3>
      voc:productType voc:Watch;
      voc:color "black";
      voc:price "7999";
      voc:buildType "new" .

    <rice-cooker>
      voc:notes "this is for internal use only";
      voc:color "gray" .

    <phone/1>
      voc:productType voc:Phone;
      voc:color "black";
      voc:price "999";
      voc:buildType "refurbished" .

    <phone/1>
      voc:productType voc:Phone;
      voc:color "black";
      voc:price "899";
      voc:buildType "refurbished" .
`;
    const store = ttlStringToStore(ttl);

    // NOTE: Ordering results so that it's easier to assert the results
    const queryToWrap = `PREFIX voc: <https://example.com/vocabulary/>
    SELECT ?productType ?color ?buildType ?price WHERE {
      ?this voc:productType ?productType .
      ?this voc:color ?color .
      ?this voc:buildType ?buildType .
      ?this voc:price ?price .
    } ORDER BY ?productType ?color ?buildType ?price`;

    const idCols = ["productType", "color"];
    const restCols = ["price", "buildType"];

    test("sanity check", () => {
      expect(queryToWrap).toBeValidSparqlQuery();
    });

    test("row retrieval", () => {
      const newQuery = formatPaginatedQuery({
        globalLimit: 10000,
        groupLimit: 100,
        groupOffset: 0,
        idVars: idCols,
        propNameVar,
        propValVar,
        queryToWrap,
      });

      const resultingTable = queryStore(store, newQuery);

      const groupedRows = tableToMulticardinalRow({ resultingTable, propNameVar, propValVar });

      const expectedRows: MulticardinalRow[] = [
        {
          idCols,
          idValues: { productType: "https://example.com/vocabulary/Phone", color: "black" },
          restCols,
          restValues: { price: ["899", "999"], buildType: ["refurbished"] },
        },
        {
          idCols,
          idValues: { productType: "https://example.com/vocabulary/Watch", color: "black" },
          restCols,
          restValues: { price: ["7999"], buildType: ["new"] },
        },
        {
          idCols,
          idValues: { productType: "https://example.com/vocabulary/Watch", color: "blue" },
          restCols,
          restValues: { price: ["4999", "9999"], buildType: ["new"] },
        },
      ];

      const sortedResult = groupedRows.toSorted((a, b) => {
        const mainKey = a.idValues["productType"].localeCompare(b.idValues["productType"]);
        return (mainKey === 0) ? a.idValues["color"].localeCompare(b.idValues["color"]) : mainKey;
      });

      // NOTE: This comparison is kinda shaky because the order of some properties (like idCols,
      // restCols) is not defined. Future changes may break tests even if the rows encode the same
      // content.
      expect(sortedResult).toEqual(expectedRows);
    });

    test("counting", () => {
      const globalRowCountVar = "__global_count";
      const groupedRowCountVar = "__grouped_count";

      const counterQuery = formatPaginatedCounterQuery({
        queryToWrap,
        globalLimit: 10_000,
        globalRowCountVar,
        groupedRowCountVar,
        idVars: idCols,
        propNameVar,
        propValVar,
      });

      expect(counterQuery).toBeValidSparqlQuery();

      const resultingTable = queryStore(store, counterQuery);
      const countPayload = tableToCountPayload({
        resultingTable,
        globalRowCountVar,
        groupedRowCountVar,
      });

      expect(countPayload).toEqual({ groupedCount: 3, globalCount: 8 });
    });
  });
});
