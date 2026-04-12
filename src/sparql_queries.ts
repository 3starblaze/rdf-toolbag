import { queryOptions } from "@tanstack/react-query";
import N3 from "n3";

export interface SparqlTableResult {
    head: {
        vars: string[],
    },
    results: {
        bindings: {
            [key: string]: {
                type: string,
                value: string,
            }
        }[],
    },
}

export class RequestError extends Error {
  response: Response;

  constructor(response: Response, message: string) {
    super(message);
    this.response = response;
  }
}

export async function requestAsSparqlTableResult(
    url: URL,
    queryString: string,
): Promise<SparqlTableResult> {
    // NOTE: It's possible to run queries via GET but it doesn't work when queries are long. I
    // managed to obtain 5xx error because Varnish couldn't handle the GET request.
    // NOTE: `archetypesForTypeQuery` is one example which can generate a query large enough
    // to cause the previously mentioned GET problems.

    const req = new Request(url, {
        method: "POST",
        headers: {
          // NOTE: Some endpoints return xml by default, so we have to be explicit
          // NOTE: And it also has to be "sparql-results" because in some rare occasions (e.g.
          // Muziekweb SparQL endpoint) you can get json directly as an array.
          "Accept": "application/sparql-results+json",
        },
        body: new URLSearchParams({
            query: queryString,
        })
    });

    const res = await fetch(req);

    if (!res.ok) {
      throw new RequestError(res, "Unexpected response");
    }

    // FIXME: Validate data shape
    const data = await res.json() as SparqlTableResult;

    return data;
}

async function requestAsNTriples(
  url: URL,
  queryString: string,
): Promise<N3.Quad[]> {
  const req = new Request(url, {
    method: "POST",
    headers: {
      "Accept": "application/n-triples",
    },
    body: new URLSearchParams({
      query: queryString,
    }),
  });

  const res = await fetch(req);

  if (!res.ok) {
    throw new Error("Network response was not ok");
  }

  const parser = new N3.Parser();
  const text = await res.text();

  const quads = parser.parse(text);

  return quads;
}

export function defaultQuery(url: URL) {
  const queryString = `
SELECT *
WHERE {
  ?s ?p ?o .
} LIMIT 10`;

  const queryFn: () => Promise<SparqlTableResult> = () => {
    return requestAsSparqlTableResult(url, queryString)
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["defaultQuery", url],
      queryFn,
    }),
  } satisfies QueryInfo<unknown>;

  return res;
}

interface TypeCountPayload {
  type: string,
  count: number,
}

interface QueryInfo<T> {
  queryString: string,
  tanstackQueryOptions: T,
}

export function typeCountQuery(
  url: URL,
) {
  const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT
  ?obj
  (COUNT(*) AS ?count)
WHERE {
  ?sub rdf:type ?obj
}
GROUP BY ?obj
ORDER BY DESC(?count)
`;

  const queryFn: () => Promise<TypeCountPayload[]> = async () => {
    const table = await requestAsSparqlTableResult(url, queryString);
    return table.results.bindings.map((row) => ({
      type: row.obj.value,
      count: Number(row.count.value),
    }));
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["typeCountQuery", url],
      queryFn,
    })
  } satisfies QueryInfo<unknown>;

  return res;
}

export function typePropertiesQuery(
  url: URL,
  rdfType: string,
) {
  const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT
  DISTINCT ?prop
WHERE {
  ?sub ?prop ?obj .
  ?sub rdf:type ${rdfType} .
}
`;

  const columnName = "prop";
  const queryFn: () => Promise<string[]> = async () => {
    const tableResult = await requestAsSparqlTableResult(url, queryString);
    return tableResult.results.bindings.map((item) => item[columnName].value);
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["typePropertiesQuery", url, rdfType],
      queryFn,
    }),
  } satisfies QueryInfo<unknown>;

  return res;
}

export function archetypesForTypeQuery(
  url: URL,
  rdfType: string,
  properties: string[],
) {
  const iToVar = (i: number) => `?propExists${i}`;
  const iToTmpObJVar = (i: number) => `?tmpObj${i}`;

  const iToBindBlock = (i: number) => `
BIND(EXISTS {
   ?sub <${properties[i]}> ${iToTmpObJVar(i)} .
} AS ${iToVar(i)})`;

  // NOTE: archetypeString is a string of 1's and 0's where for each i if archetypeString[i] is
  // "1" then properties[i] is in the archetype.
  // NOTE: IF(x, 1, 0) is used to convert a boolean to int.

      const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT
  ?archetypeString
  (COUNT(DISTINCT ?sub) AS ?count)
WHERE {
  ?sub ?pred ?obj .
  ?sub rdf:type ${rdfType} .
  ${properties.map((_, i) => iToBindBlock(i)).join("\n")}
  BIND(CONCAT(
    ${properties.map((_, i) => `STR(IF(${iToVar(i)}, 1, 0))`).join(",\n")}
  ) AS ?archetypeString)
}
GROUP BY ?archetypeString
ORDER BY DESC(?count)
`;

  // NOTE: Initially grouping was done by all the `iToVar` variables but this fails in some
  // endpoints like DBPedia which set the max grouping/distinct limit to 100 variables. To
  // circumvent that, a string is built instead and grouping is then done by just that string.
  const queryFn: () => Promise<{ archetype: Set<string>, count: number }[]> = async () => {
    const tableRes = await requestAsSparqlTableResult(url, queryString);

    const res: { archetype: Set<string>, count: number }[] = tableRes.results.bindings.map((item) => {
      const archetypeString = item.archetypeString.value;

      // NOTE: Validate string length
      if (archetypeString.length !== properties.length) {
        throw new Error(
          "Query returned string with unexpected size, expected size"
            +`${properties.length}, got ${archetypeString.length}`
        );
      }


      const archetypeArray: string[] = [];

      [...archetypeString].forEach((val, i) => {
        if (val === "1") {
          archetypeArray.push(properties[i]);
        } else if (val === "0"){
          return;
        } else {
          throw new Error(`Unexpected char in archetypeString "${val}"`)
        }
      });

      return {
        archetype: new Set(archetypeArray),
        count: Number(item.count.value),
      };
    });

    return res;
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["archetypesForTypeQuery", url, rdfType, properties],
      queryFn,
    })
  } satisfies QueryInfo<unknown>;

  return res;
}

interface ByArchetypeData {
    subject: string,
    [key: string]: string,
};

export function findByArchetypeQuery(
  url: URL,
  rdfType: string,
  properties: string[],
  limit: number,
) {
  const iToTmpObjVar = (i: number) => `?tmpObj${i}`;

  const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT
  DISTINCT
  ?sub
  ${properties.map((_, i) => iToTmpObjVar(i)).join(" ")}
WHERE {
  ?sub ?pred ?obj .
  ?sub rdf:type ${rdfType} .

  ${properties.map((p, i) => `?sub <${p}> ${iToTmpObjVar(i)} .`).join("\n")}

  FILTER NOT EXISTS {
    ?sub ?predFilter ?objFilter .
    FILTER (?predFilter NOT IN (
      ${properties.map((p) => `<${p}>`).join(",\n")}
    ))
  }
}
LIMIT ${limit}
`;

  const queryFn: () => Promise<ByArchetypeData[]> = async () => {
    const tableResult = await requestAsSparqlTableResult(url, queryString);

    return tableResult.results.bindings.map((row) => {
      const subject = row.sub.value;
      const restEntries: [string, string][] = properties.map((prop, i) => {
        const varName = iToTmpObjVar(i).slice(1); // NOTE: remove the leading "?"
        return [prop, row[varName].value];
      });

      return {
        subject,
        ...Object.fromEntries(restEntries),
      };
    });
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["findByArchetypeQuery", url, rdfType, properties, limit],
      queryFn,
    }),
  } satisfies QueryInfo<unknown>;

  return res;
}

export function defaultConstructQuery(url: URL) {
  const queryString = `
CONSTRUCT { ?s ?p ?o }
WHERE {
  ?s ?p ?o .
} LIMIT 10`;

  const queryFn: () => Promise<N3.Quad[]> = () => {
    return requestAsNTriples(url, queryString);
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["defaultConstructQuery", url],
      queryFn,
    }),
  } satisfies QueryInfo<unknown>;

  return res;
}

export function formatMultiCardinalTableQuery(
  rdfType: string,
  properties: string[],
  idLimit: number,
) {
  const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

CONSTRUCT { ?sub ?pred ?obj }
WHERE {
  ?sub ?pred ?obj .
  FILTER(?pred IN (
${properties.map((prop) => `    <${prop}>`).join(",\n")}
  ))
  {
    SELECT DISTINCT ?sub
    WHERE {
      ?sub ?pred ?obj .
      ?sub rdf:type ${rdfType} .
${properties.map((prop, i) => `      ?sub <${prop}> ?tmpObj${i} .`).join("\n")}
    }
    LIMIT ${idLimit}
  }
}
`;
  return queryString;
}

export function multicardinalTableQuery(
  url: URL,
  rdfType: string,
  properties: string[],
  idLimit: number,
) {
  const queryString = formatMultiCardinalTableQuery(rdfType, properties, idLimit);

  const queryFn: () => Promise<N3.Quad[]> = () => {
    return requestAsNTriples(url, queryString);
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["multicardinalTableQuery", url, rdfType, properties, idLimit],
      queryFn,
    }),
  } satisfies QueryInfo<unknown>;

  return res;
}

export function formatMultiCardinalTableAsSelectQuery(
  rdfType: string,
  properties: string[],
  idLimit: number,
) {
  const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?sub ?pred ?obj
WHERE {
  ?sub ?pred ?obj .
  FILTER(?pred IN (
${properties.map((prop) => `    <${prop}>`).join(",\n")}
  ))
  {
    SELECT DISTINCT ?sub
    WHERE {
      ?sub ?pred ?obj .
      ?sub rdf:type ${rdfType} .
${properties.map((prop, i) => `      ?sub <${prop}> ?tmpObj${i} .`).join("\n")}
    }
    LIMIT ${idLimit}
  }
}
`;

  return queryString;
}

/**
 * Make multicardinal table query but use SELECT instead of CONSTRUCT.
 */
export function multiCardinalTableAsSelectQuery(
  url: URL,
  rdfType: string,
  properties: string[],
  idLimit: number,
) {
  const queryString = formatMultiCardinalTableAsSelectQuery(rdfType, properties, idLimit);

  const queryFn: () => Promise<SparqlTableResult> = () => {
    return requestAsSparqlTableResult(url, queryString);
  };

  const res = {
    queryString,
    tanstackQueryOptions: queryOptions({
      queryKey: ["multicardinalTableQuery", url, rdfType, properties, idLimit],
      queryFn,
    }),
  } satisfies QueryInfo<unknown>;

  return res;
}

/**
 * Get query that should correspond to `groupLimit` grouped rows.
 *
 * If this query returns a table with rowCount === globalLimit, the results should not be used
 * because the result is incomplete and some target columns may be missing, depending on how the
 * rows are ordered.
 *
 * @property queryToWrap The query that needs to be paginated
 * @property idVars Set of variables that are used as id
 * @property groupLimit Count of grouped rows to receive
 * @property groupOffset OFFSET that is applied to grouped rows
 * @property globalLimit Raw row count limit
 */
export function formatUniversalPaginatorQuery({
  queryToWrap,
  idVars,
  groupLimit,
  groupOffset,
  globalLimit,
}: {
  queryToWrap: string,
  idVars: string[],
  groupLimit: number,
  groupOffset: number,
  globalLimit: number,
}): string {
  const selectedVars = idVars.map((varName) => `?${varName}`).join(" ");

  const indentation = "  ";
  const indent = (line: string) => `${indentation}${line}`;
  const lineAwareIndent = (src: string) => src.split("\n").map(indent).join("\n");

  const distinctQuery = `SELECT DISTINCT ${selectedVars}
WHERE {
${lineAwareIndent(queryToWrap)}
}
LIMIT ${groupLimit}
OFFSET ${groupOffset}`;

  // NOTE: The basic principle is to inject `distinctQuery` along with the regular query. The
  // neighboring `distinctQuery` filters the result set and then it's just a matter of wrapping
  // those two queries into same WHERE block which are returned as is, with group limit.
  const fmt = [
    "SELECT * WHERE {",
    lineAwareIndent([
      "{", lineAwareIndent(distinctQuery), "}"
    ].join("\n")),
    lineAwareIndent([
      "{", lineAwareIndent(queryToWrap), "}"
    ].join("\n")),
    "}",
  ].join("\n");

  return fmt;
}

/**
 * Make query that counts grouped and total row count.
 *
 * Even though globalLimit is optional, it's advisable to set it in order to avoid seeking too many
 * rows. If `globalLimit` is set and the query returns result with count `globalLimit`, returned
 * grouped count is the minimum count and is not guaranteed to be exact.
 */
export function formatUniversalPaginatorQueryCounter({
  queryToWrap,
  idVars,
  globalLimit,
  globalRowCountVar,
  groupedRowCountVar,
}: {
  /** Query about which the info is retrieved. */
  queryToWrap: string,
  /** Columns that are used as a composite key. */
  idVars: string[],
  /** Name of the variable that will hold global row count. */
  globalRowCountVar: string,
  /** Name of the variable that will hold grouped row count. */
  groupedRowCountVar: string,
  /** Max count of grouped rows. */
  groupLimit?: number,
  /** Max count of total rows. */
  globalLimit?: number,
}): string {
  const colsFmt = idVars.map((colName) => `?${colName}`).join(" ");

  const indentation = "  ";
  const indent = (line: string) => `${indentation}${line}`;
  const lineAwareIndent = (src: string) => src.split("\n").map(indent).join("\n");

  const query = [
    "SELECT",
    `(COUNT(*) AS ?${globalRowCountVar})`,
    `(COUNT(DISTINCT *) AS ?${groupedRowCountVar})`,
    "{",
    lineAwareIndent([
      `SELECT ${colsFmt} WHERE {`,
      lineAwareIndent(queryToWrap),
      ["}", ...(globalLimit ? [`LIMIT ${globalLimit}`] : [])].join(" "),
    ].join("\n")),
    "}",
  ].join("\n");

  return query;
}
