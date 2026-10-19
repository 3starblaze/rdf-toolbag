import { expect, test, describe } from "vitest";
import type { QueryStoreProvider } from "./test-util/QueryStore";
import {
  formatPaginatedQuery as rawFormatPaginatedQuery,
  formatPaginatedCounterQuery as rawFormatPaginatedCounterQuery,
  tableToMulticardinalTable,
  tableToCountPayload,
} from "./compact-pagination";
import type { MulticardinalTableData } from "./multi-cardinal-table-util";
import type { SparqlTableResult, RdfTerm } from "./sparql_queries";
import { OxigraphQueryStoreProvider } from "./test-util/OxigraphQueryStore";
import { QLeverQueryStoreProvider } from "./test-util/QLeverQueryStore";
import { JenaQueryStoreProvider } from "./test-util/JenaQueryStore";
import { optimize } from "./query-util";
import { produce } from "immer";

type Row = MulticardinalTableData["rows"][number];

function lit(v: string | number): RdfTerm {
  if (typeof v === "number") {
    return {
      type: "literal",
      value: v.toString(),
      datatype: "http://www.w3.org/2001/XMLSchema#integer",
    };
  }
  return { type: "literal", value: v };
}

function uri(v: string): RdfTerm {
  return { type: "uri", value: v };
}

function normalizeDatatype(src: RdfTerm): RdfTerm {
  // NOTE: Sometimes there are different int representations
  if (src.type === "literal" && src.datatype === "http://www.w3.org/2001/XMLSchema#int") {
    return produce(src, (draft) => {
      draft.datatype = "http://www.w3.org/2001/XMLSchema#integer";
    });
  }
  return src;
}

function makeRowSorter(keys: string[]) {
  function singleCompare(a: Row, b: Row, key: string): number {
    const v0 = a.idValues[key];
    const v1 = b.idValues[key];

    if (v0 === v1) return 0;
    if (v0 === null) return -1;
    if (v1 === null) return 1;

    return (v0?.value || "").localeCompare(v1?.value || "");
  }

  function compareRecursive(
    a: Row,
    b: Row,
    [currentKey, ...restKeys]: string[],
  ): number {
    if (currentKey === undefined) return 0;
    const res = singleCompare(a, b, currentKey);
    return (res === 0) ? compareRecursive(a, b, restKeys) : res;
  }

  return (a: Row, b: Row) => compareRecursive(a, b, keys);
}

function expectEquivalentRows({
  actualRows,
  expectedRows,
  idCols,
}: {
  actualRows: Row[],
  expectedRows: Row[],
  idCols: string[],
}) {
  // NOTE: Make a normalized representation so that `.toEqual` actually works and it's easier
  // to catch issues.
  function normalizeRow(row: Row) {
    return {
      idValues: Object.fromEntries(
        Object.entries(row.idValues)
          .map(([k, v]) => [k, v ? normalizeDatatype(v) : null] as const)
      ),
      restValues: Object.fromEntries(
        Object.entries(row.restValues)
          .map(([k, v]) => [k, v.toSorted((a, b) => (a?.value || "").localeCompare(b?.value || ""))] as const satisfies unknown[])
          .map(([k, v]) => [k, v.map(normalizeDatatype)] as const)
      ),
    }
  }

  const sorter = makeRowSorter(idCols);

  const a = actualRows.toSorted(sorter).map(normalizeRow);
  const b = expectedRows.toSorted(sorter).map(normalizeRow);
  expect(a).toEqual(b);
}

// NOTE: As long as limit is not reached (in both counter and result query) count payload's
// globalCount should always match the row count that paginated result query gives.
function expectTableCountToMatchCountPayload({
  resultingTable,
  expectedCountPayload,
}: {
  resultingTable: SparqlTableResult,
  expectedCountPayload: { globalCount: number, groupedCount: number },
}) {
  expect(resultingTable.results.bindings.length).toEqual(expectedCountPayload.globalCount);
}

const propNameVar = "__propName";
const propValVar = "__propVal";

function testIntegration({
  name,
  queryStoreProvider,
  formatPaginatedQuery,
  formatPaginatedCounterQuery,
}: {
  name: string,
  queryStoreProvider: QueryStoreProvider,
  formatPaginatedQuery: typeof rawFormatPaginatedQuery,
  formatPaginatedCounterQuery: typeof rawFormatPaginatedCounterQuery,
}) {
  describe(name, async () => {
    describe("basic test", async () => {
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
      const store = await queryStoreProvider.storeFromTtl({ ttl });

      // NOTE: Ordering results so that it's easier to assert the results
      const queryToWrap = `PREFIX voc: <https://example.com/vocabulary/>
    SELECT ?productType ?color ?buildType ?price WHERE {
      ?this voc:productType ?productType .
      ?this voc:color ?color .
      ?this voc:buildType ?buildType .
      ?this voc:price ?price .
    } ORDER BY ?productType ?color ?buildType ?price`;

      const idCols = ["productType", "color"];

      const expectedCountPayload = { groupedCount: 3, globalCount: 8 };

      test("sanity check", () => {
        expect(queryToWrap).toBeValidSparqlQuery();
      });

      test("row retrieval", async () => {
        const newQuery = formatPaginatedQuery({
          globalLimit: 10000,
          groupLimit: 100,
          groupOffset: 0,
          idVars: idCols,
          propNameVar,
          propValVar,
          queryToWrap,
        });

        const resultingTable = await store.executeQuery({ query: newQuery });

        expectTableCountToMatchCountPayload({ resultingTable, expectedCountPayload });

        const tableData = tableToMulticardinalTable({ resultingTable, propNameVar, propValVar });
        const actualRows = tableData.rows;

        const lit = (v: string): RdfTerm => ({ type: "literal", value: v });

        const expectedRows: Row[] = [
          {
            idValues: { productType: uri("https://example.com/vocabulary/Phone"), color: lit("black") },
            restValues: { price: [lit("899"), lit("999")], buildType: [lit("refurbished")] },
          },
          {
            idValues: { productType: uri("https://example.com/vocabulary/Watch"), color: lit("black") },
            restValues: { price: [lit("7999")], buildType: [lit("new")] },
          },
          {
            idValues: { productType: uri("https://example.com/vocabulary/Watch"), color: lit("blue") },
            restValues: { price: [lit("4999"), lit("9999")], buildType: [lit("new")] },
          },
        ];

        expectEquivalentRows({
          actualRows,
          expectedRows,
          idCols,
        });
      });

      test("counting", async () => {
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

        const resultingTable = await store.executeQuery({ query: counterQuery });
        const countPayload = tableToCountPayload({
          resultingTable,
          globalRowCountVar,
          groupedRowCountVar,
        });

        expect(countPayload).toEqual(expectedCountPayload);
      });
    });

    // NOTE: Unbound key functionality is temporarily removed
    describe.todo("keys may be unbound", async () => {
      // NOTE: The example showcases a previously-encountered edge case where unbound key values
      // previously caused issues.
      // NOTE: This example is taken from Academy Sampo https://ldf.fi/yoma/sparql using this
      // construct query:
      /**
        PREFIX y: <http://ldf.fi/schema/yoma/>
        PREFIX schema: <http://schema.org/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        CONSTRUCT {?s ?p ?o} WHERE {
          ?s rdf:type y:StudentNation .
          ?s ?p ?o.
          FILTER(?p IN (skos:prefLabel, y:comment))
        }
       */
      const ttl = `@base <http://ldf.fi/yoma/nations/> .
    @prefix y: <http://ldf.fi/schema/yoma/> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    @prefix voc: <https://example.com/vocabulary/> .

<sn29> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn29> skos:prefLabel "Uppsalan Länsigötanmaalainen osakunta"@fi .
<sn23> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn23> skos:prefLabel "Uppsalan Västmanlantilainen osakunta"@fi .
<sn24> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn24> skos:prefLabel "Uppsalan Smålandilainen osakunta"@fi .
<sn6> skos:prefLabel "Itägötanmaalainen osakunta"@fi .
<sn30> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn30> skos:prefLabel "Lundin Itägötanmaalainen osakunta"@fi .
<sn26> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn26> skos:prefLabel "Uppsalan Pohjalainen osakunta"@fi .
<sn25> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn25> skos:prefLabel "Lundin Smålandilainen osakunta"@fi .
<sn15> skos:prefLabel "Satakunda nation"@sv .
<sn15> skos:prefLabel "Satakuntalainen osakunta"@fi .
<sn13> skos:prefLabel "Sveagotiska nationen"@sv .
<sn13> skos:prefLabel "Ruotsalainen osakunta"@fi .
<sn2> skos:prefLabel "Borealiska nationen"@sv .
<sn2> skos:prefLabel "Boreaalinen osakunta"@fi .
<sn17> skos:prefLabel "Smålands nation"@sv .
<sn17> skos:prefLabel "Smålandilainen osakunta"@fi .
<sn19> skos:prefLabel "Åbo nation"@sv .
<sn19> skos:prefLabel "Turkulainen osakunta"@fi .
<sn5> skos:prefLabel "Tavastehus nation"@sv .
<sn5> skos:prefLabel "Hämäläinen osakunta"@fi .
<sn21> skos:prefLabel "Viborgska nationen"@sv .
<sn21> skos:prefLabel "Viipurilainen osakunta"@fi .
<sn16> skos:prefLabel "Savokarelska avdelningen 1833–52"@sv .
<sn16> skos:prefLabel "Savokarjalainen osakunta 1833–52"@fi .
<sn20> skos:prefLabel "Nylands nation"@sv .
<sn20> skos:prefLabel "Uusmaalainen osakunta"@fi .
<sn7> skos:prefLabel "Västfinska nationen"@sv .
<sn7> skos:prefLabel "Länsisuomalainen osakunta"@fi .
<sn11> skos:prefLabel "Österbottniska nationen"@sv .
<sn11> skos:prefLabel "Pohjalainen osakunta"@fi .
<sn28> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn28> skos:prefLabel "Uppsalan Västmanland-Dala osakunta"@fi .
<sn12> skos:prefLabel "Nordösterbottniska avdelningen"@sv .
<sn12> skos:prefLabel "Pohjoispohjalainen osakunta"@fi .
<sn27> y:comment "Aineistossa mainittu ruotsalainen osakunta"@fi .
<sn27> skos:prefLabel "Uppsalan Suomalainen osakunta"@fi .
<sn1> skos:prefLabel "Austraalinen osakunta"@fi .
<sn14> skos:prefLabel "Sveagotiska nationen 1798–"@sv .
<sn14> skos:prefLabel "Ruotsalainen (yhd.) osakunta vuodesta 1798"@fi .
<sn3> skos:prefLabel "Sydösterbottniska avdelningen"@sv .
<sn3> skos:prefLabel "Eteläpohjalainen osakunta"@fi .`

      const queryToWrap = `PREFIX y: <http://ldf.fi/schema/yoma/>
PREFIX schema: <http://schema.org/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT * WHERE{
  OPTIONAL{?StudentNation skos:prefLabel ?prefLabel .  }
  OPTIONAL{?StudentNation y:comment ?comment .  }
} ORDER BY ?comment ?StudentNation ?prefLabel`
      const store = await queryStoreProvider.storeFromTtl({ ttl });
      const idCols = ["comment"];

      const expectedCountPayload = { groupedCount: 2, globalCount: 62 };

      test("sanity check", () => {
        expect(queryToWrap).toBeValidSparqlQuery();
      });

      test("row retrieval", async () => {
        const newQuery = formatPaginatedQuery({
          globalLimit: 10000,
          groupLimit: 100,
          groupOffset: 0,
          idVars: idCols,
          propNameVar,
          propValVar,
          queryToWrap,
        });

        const resultingTable = await store.executeQuery({ query: newQuery });

        expectTableCountToMatchCountPayload({ expectedCountPayload, resultingTable });

        const tableData = tableToMulticardinalTable({ resultingTable, propNameVar, propValVar });
        const actualRows = tableData.rows;

        const expectedRows: Row[] = [
          {
            idValues: { comment: null },
            restValues: {
              StudentNation: [
                lit('http://ldf.fi/yoma/nations/sn1'),
                lit('http://ldf.fi/yoma/nations/sn11'),
                lit('http://ldf.fi/yoma/nations/sn12'),
                lit('http://ldf.fi/yoma/nations/sn13'),
                lit('http://ldf.fi/yoma/nations/sn14'),
                lit('http://ldf.fi/yoma/nations/sn15'),
                lit('http://ldf.fi/yoma/nations/sn16'),
                lit('http://ldf.fi/yoma/nations/sn17'),
                lit('http://ldf.fi/yoma/nations/sn19'),
                lit('http://ldf.fi/yoma/nations/sn2'),
                lit('http://ldf.fi/yoma/nations/sn20'),
                lit('http://ldf.fi/yoma/nations/sn21'),
                lit('http://ldf.fi/yoma/nations/sn3'),
                lit('http://ldf.fi/yoma/nations/sn5'),
                lit('http://ldf.fi/yoma/nations/sn6'),
                lit('http://ldf.fi/yoma/nations/sn7'),
              ],
              prefLabel: [
                lit('Austraalinen osakunta'),
                lit('Boreaalinen osakunta'),
                lit('Borealiska nationen'),
                lit('Eteläpohjalainen osakunta'),
                lit('Hämäläinen osakunta'),
                lit('Itägötanmaalainen osakunta'),
                lit('Länsisuomalainen osakunta'),
                lit('Nordösterbottniska avdelningen'),
                lit('Nylands nation'),
                lit('Pohjalainen osakunta'),
                lit('Pohjoispohjalainen osakunta'),
                lit('Ruotsalainen (yhd.) osakunta vuodesta 1798'),
                lit('Ruotsalainen osakunta'),
                lit('Satakunda nation'),
                lit('Satakuntalainen osakunta'),
                lit('Savokarelska avdelningen 1833–52'),
                lit('Savokarjalainen osakunta 1833–52'),
                lit('Smålandilainen osakunta'),
                lit('Smålands nation'),
                lit('Sveagotiska nationen'),
                lit('Sveagotiska nationen 1798–'),
                lit('Sydösterbottniska avdelningen'),
                lit('Tavastehus nation'),
                lit('Turkulainen osakunta'),
                lit('Uusmaalainen osakunta'),
                lit('Viborgska nationen'),
                lit('Viipurilainen osakunta'),
                lit('Västfinska nationen'),
                lit('Åbo nation'),
                lit('Österbottniska nationen')
              ]
              ,
            },
          },
          {
            idValues: { comment: lit("Aineistossa mainittu ruotsalainen osakunta") },
            restValues: {
              StudentNation: [
                lit('http://ldf.fi/yoma/nations/sn23'),
                lit('http://ldf.fi/yoma/nations/sn24'),
                lit('http://ldf.fi/yoma/nations/sn25'),
                lit('http://ldf.fi/yoma/nations/sn26'),
                lit('http://ldf.fi/yoma/nations/sn27'),
                lit('http://ldf.fi/yoma/nations/sn28'),
                lit('http://ldf.fi/yoma/nations/sn29'),
                lit('http://ldf.fi/yoma/nations/sn30'),
              ],
              prefLabel: [
                lit('Lundin Itägötanmaalainen osakunta'),
                lit('Lundin Smålandilainen osakunta'),
                lit('Uppsalan Länsigötanmaalainen osakunta'),
                lit('Uppsalan Pohjalainen osakunta'),
                lit('Uppsalan Smålandilainen osakunta'),
                lit('Uppsalan Suomalainen osakunta'),
                lit('Uppsalan Västmanland-Dala osakunta'),
                lit('Uppsalan Västmanlantilainen osakunta')
              ],
            },
          },
        ];

        expectEquivalentRows({
          actualRows,
          expectedRows,
          idCols,
        });
      });

      test("counting", async () => {
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

        const resultingTable = await store.executeQuery({ query: counterQuery });
        const countPayload = tableToCountPayload({
          resultingTable,
          globalRowCountVar,
          groupedRowCountVar,
        });

        expect(countPayload).toEqual(expectedCountPayload);
      });
    });

    // NOTE: What are we testing?
    // - GROUP BY
    // - ORDER BY
    // - paginated querying (where query result is smaller than the dataset)
    // - working with calculated values (?TotalAmount)
    // - ensuring that globalLimit is applied to the final result (not the result set that is matched
    //   by `queryToWrap`)
    describe("Grouping, ordering and pagination", async () => {
      const ttl = `@base <http://example.com/vocabulary/> .
    @prefix : <http://example.com/vocabulary/> .

    <tx0>
    :TransactionRegion "Europe";
    :Amount 1000 .

    <tx1>
    :TransactionRegion "Africa";
    :Amount 200 .

    <tx2>
    :TransactionRegion "Asia";
    :Amount 300 .

    <tx3>
    :TransactionRegion "North America";
    :Amount 400 .

    <tx4>
    :TransactionRegion "Africa";
    :Amount 500 .

    <tx5>
    :TransactionRegion "Africa";
    :Amount 700 .

    <tx6>
    :TransactionRegion "North America";
    :Amount 200 .

    <tx7>
    :TransactionRegion "Asia";
    :Amount 100 .
`

      const queryToWrap = `PREFIX : <http://example.com/vocabulary/>
    SELECT ?TransactionRegion (SUM(?Amount) AS ?TotalAmount) WHERE{
      ?this :TransactionRegion ?TransactionRegion .
      ?this :Amount ?Amount .
    } GROUP BY ?TransactionRegion ORDER BY DESC(?TotalAmount)`;
      const store = await queryStoreProvider.storeFromTtl({ ttl });
      const idCols = ["TransactionRegion"];

      const expectedCountPayload = { groupedCount: 4, globalCount: 4 };

      test("sanity check", () => {
        expect(queryToWrap).toBeValidSparqlQuery();
      });

      test("row retrieval", async () => {
        const newQuery = formatPaginatedQuery({
          globalLimit: 2,
          groupLimit: 2,
          groupOffset: 0,
          idVars: idCols,
          propNameVar,
          propValVar,
          queryToWrap,
        });

        const resultingTable = await store.executeQuery({ query: newQuery });

        // NOTE: This query doesn't fetch all items, expectedCountPayload is different
        expectTableCountToMatchCountPayload({
          expectedCountPayload: { groupedCount: 2, globalCount: 2 },
          resultingTable,
        });

        const tableData = tableToMulticardinalTable({ resultingTable, propNameVar, propValVar });
        const actualRows = tableData.rows;

        const expectedRows: Row[] = [
          {
            idValues: { TransactionRegion: lit("Africa") },
            restValues: { TotalAmount: [lit(1400)] },
          },
          {
            idValues: { TransactionRegion: lit("Europe") },
            restValues: { TotalAmount: [lit(1000)] },
          },
        ];

        expectEquivalentRows({
          actualRows,
          expectedRows,
          idCols,
        });
      });

      test("counting", async () => {
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

        const resultingTable = await store.executeQuery({ query: counterQuery });
        const countPayload = tableToCountPayload({
          resultingTable,
          globalRowCountVar,
          groupedRowCountVar,
        });

        expect(countPayload).toEqual(expectedCountPayload);
      });
    });

    describe("order is preserved with several order keys", async () => {
      // NOTE: What are we testing
      // - Multiple order keys work
      // - Ordering works in both key and value level

      // NOTE: Extra additions added to the tests
      // - Mixed numbers and strings for variety
      // - Added numbers with varying digit count that will mess the order if numbers are ordered by
      //   string (e.g. 2 < 1000 vs "2" > "1000")
      const ttl = `
      @base <http://example.com/vocabulary/> .
      @prefix : <http://example.com/vocabulary/> .

      <bA> :priorityLevel "B"; :score 1000; :index -1 .
      <a0> :priorityLevel "A"; :score 1000; :index 0 .
      <b0> :priorityLevel "B"; :score 2   ; :index 1 .
      <c0> :priorityLevel "C"; :score 100 ; :index 2 .
      <b1> :priorityLevel "B"; :score 10  ; :index 3 .
      <a1> :priorityLevel "A"; :score 300 ; :index 4 .
      <c1> :priorityLevel "C"; :score 40  ; :index 5 .
      <c2> :priorityLevel "C"; :score 1000; :index 6 .
      <b2> :priorityLevel "B"; :score 1000; :index 7 .
      <a2> :priorityLevel "A"; :score 2000; :index 8 .
      <bZ> :priorityLevel "B"; :score 1000; :index 100 .
      `;

      const store = await queryStoreProvider.storeFromTtl({ ttl });

      const prefixed = (it: string) => `http://example.com/vocabulary/${it}`;

      const queryToWrap = `PREFIX : <http://example.com/vocabulary/>
    SELECT * WHERE {
      ?this :score ?score .
      ?this :priorityLevel ?priorityLevel .
      ?this :index ?index .
    } ORDER BY DESC(?score) ?priorityLevel ?index`;

      const idCols = ["score", "priorityLevel"];

      test("sanity check", () => {
        expect(queryToWrap).toBeValidSparqlQuery();
      });

      test("row retrieval", async () => {
        const newQuery = formatPaginatedQuery({
          globalLimit: 1_000,
          groupLimit: 5,
          groupOffset: 0,
          idVars: idCols,
          propNameVar,
          propValVar,
          queryToWrap,
        });

        expect(newQuery).toBeValidSparqlQuery();

        const resultingTable = await store.executeQuery({ query: newQuery });

        expectTableCountToMatchCountPayload({
          expectedCountPayload: { groupedCount: 5, globalCount: 14 },
          resultingTable,
        });

        const tableData = tableToMulticardinalTable({ resultingTable, propNameVar, propValVar });
        const actualRows = tableData.rows;

        const row = (
          score: RdfTerm,
          priorityLevel: RdfTerm,
          thisVal: (RdfTerm | null)[],
          index: (RdfTerm | null)[],
        ): Row => ({
          idValues: { score, priorityLevel },
          restValues: {
            this: thisVal.filter((v): v is RdfTerm => v !== null),
            index: index.filter((v): v is RdfTerm => v !== null),
          },
        });

        const expectedRows: Row[] = [
          row(lit(2000), lit("A"), [uri(prefixed("a2"))], [lit(8)]),
          row(lit(1000), lit("A"), [uri(prefixed("a0"))], [lit(0)]),
          row(lit(1000), lit("B"), ["bA", "b2", "bZ"].map(prefixed).map(uri), [lit(-1), lit(7), lit(100)]),
          row(lit(1000), lit("C"), [uri(prefixed("c2"))], [lit(6)]),
          row(lit(300), lit("A"), [uri(prefixed("a1"))], [lit(4)]),
        ];

        expectEquivalentRows({
          actualRows,
          expectedRows,
          idCols,
        });
      });

      test("counting", async () => {
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

        const resultingTable = await store.executeQuery({ query: counterQuery });
        const countPayload = tableToCountPayload({
          resultingTable,
          globalRowCountVar,
          groupedRowCountVar,
        });

        const expectedCountPayload = { groupedCount: 9, globalCount: 22 };
        expect(countPayload).toEqual(expectedCountPayload);
      });
    });
  });
}

const optimizer = (query: string): string => {
  return optimize(query);
}

const optimizedQuery: typeof rawFormatPaginatedQuery = (args) => {
  const unoptimizedQuery = rawFormatPaginatedQuery(args);
  return optimizer(unoptimizedQuery);
};

const optimizedCounter: typeof rawFormatPaginatedCounterQuery = (args) => {
  const unoptimizedQuery = rawFormatPaginatedCounterQuery(args);
  return optimizer(unoptimizedQuery);
}


const providers: { name: string, queryStoreProvider: QueryStoreProvider }[] = [
  { name: "Oxigraph", queryStoreProvider: OxigraphQueryStoreProvider },
  { name: "QLever", queryStoreProvider: QLeverQueryStoreProvider },
  { name: "Jena", queryStoreProvider: JenaQueryStoreProvider },
];

const queryFormatters: {
  name: string,
  formatPaginatedQuery: typeof rawFormatPaginatedQuery,
  formatPaginatedCounterQuery: typeof rawFormatPaginatedCounterQuery,
}[] = [
  {
    name: "raw",
    formatPaginatedCounterQuery: rawFormatPaginatedCounterQuery,
    formatPaginatedQuery: rawFormatPaginatedQuery,
  },
  {
    name: "optimized",
    formatPaginatedCounterQuery: optimizedCounter,
    formatPaginatedQuery: optimizedQuery,
  },
];

type TestItem = Parameters<typeof testIntegration>[0];

// NOTE: Cartesian product of all providers and query formatters
const tests: TestItem[] = providers.flatMap((provider) => {
  return queryFormatters.map((formatter): TestItem => ({
    name: `${provider.name} (${formatter.name})`,
    queryStoreProvider: provider.queryStoreProvider,
    formatPaginatedQuery: formatter.formatPaginatedQuery,
    formatPaginatedCounterQuery: formatter.formatPaginatedCounterQuery,
  }));
});

for (const test of tests) {
  testIntegration(test);
}
