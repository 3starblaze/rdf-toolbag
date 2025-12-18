import { queryOptions } from "@tanstack/react-query";

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

async function requestAsSparqlTableResult(
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
        throw new Error("Network response was not ok");
    }

    // FIXME: Validate data shape
    const data = await res.json() as SparqlTableResult;

    return data;
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
