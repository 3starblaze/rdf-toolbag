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
          "Accept": "application/json",
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

  return queryOptions({
    queryKey: ["defaultQuery", url],
    queryFn,
  });
}

interface TypeCountPayload {
  type: string,
  count: number,
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

  return queryOptions({
    queryKey: ["typeCountQuery", url],
    queryFn,
  });
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

  return queryOptions({
    queryKey: ["typePropertiesQuery", url, rdfType],
    queryFn,
  });
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

  const queryFn: () => Promise<{ archetype: Set<string>, count: number }[]> = async () => {
      const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT
  ${properties.map((_, i) => iToVar(i)).join("\n")}
  (COUNT(DISTINCT ?sub) AS ?count)
WHERE {
  ?sub ?pred ?obj .
  ?sub rdf:type ${rdfType} .
  ${properties.map((_, i) => iToBindBlock(i)).join("\n")}
}
GROUP BY ${properties.map((_, i) => iToVar(i)).join(" ")}
ORDER BY DESC(?count)
`;
    const tableRes = await requestAsSparqlTableResult(url, queryString);
    const res: { archetype: Set<string>, count: number }[] = tableRes.results.bindings.map((item) => {
      const archetypeArray = properties.filter((_, i) => {
        const varName = iToVar(i).slice(1); // NOTE: remove the leading "?"
        const val = item[varName].value;
        // NOTE: The query can return things as boolean or as integer. I believe that formally it
        // ought to return a boolean ( https://www.w3.org/TR/sparql11-query/#func-filter-exists )
        // but it is what it is and we ought to adapt.
        return (val === "true") || (val === "1");
      });

      return {
        archetype: new Set(archetypeArray),
        count: Number(item.count.value),
      };
    });

    return res;
  };

  return queryOptions({
    queryKey: ["archetypesForTypeQuery", url, rdfType, properties],
    queryFn,
  });
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

  return queryOptions({
    queryKey: ["findByArchetypeQuery", url, rdfType, properties, limit],
    queryFn,
  });
}
