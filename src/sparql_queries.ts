export interface QueryConfig {
    sparqlURL: url,
}

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
    // NOTE: `createArchetypesForTypeQuery` is one example which can generate a query large enough
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

export function createDefaultQuery(
    { sparqlURL }: QueryConfig,
) {
        const queryString = `
SELECT *
WHERE {
  ?s ?p ?o .
} LIMIT 10`;

    return async function (): Promise<SparqlTableResult> {
        return requestAsSparqlTableResult(sparqlURL, queryString);
    };
}

interface TypeCountPayload {
  type: string,
  count: number,
}

export function createTypeCountQuery(
    { sparqlURL }: QueryConfig,
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

    return async function (): Promise<TypeCountPayload[]> {
        const table = await requestAsSparqlTableResult(sparqlURL, queryString);
        return table.results.bindings.map((row) => ({
          type: row.obj.value,
          count: Number(row.count.value),
        }));
    };
}

export function createTypePropertiesQuery(
    { sparqlURL }: QueryConfig,
) {
    return async function ({ queryKey }: { queryKey: string[]}): Promise<string[]> {
        const [_, rdfType] = queryKey;

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

        const tableResult = await requestAsSparqlTableResult(sparqlURL, queryString);
        return tableResult.results.bindings.map((item) => item[columnName].value);
    };
}

export function createArchetypesForTypeQuery(
    { sparqlURL }: QueryConfig,
) {
    return async function(
        { queryKey }: { queryKey: [string, string, string[]]}
    ): Promise<{ archetype: Set<string>, count: number }[]> {
        const [_, rdfType, properties] = queryKey;

        const iToVar = (i: number) => `?propExists${i}`;
        const iToTmpObJVar = (i: number) => `?tmpObj${i}`;

        const iToBindBlock = (i: number) => `
BIND(EXISTS {
   ?sub <${properties[i]}> ${iToTmpObJVar(i)} .
} AS ${iToVar(i)})`;

        const queryString = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT
  ${properties.map((_ , i) => iToVar(i)).join("\n")}
  (COUNT(DISTINCT ?sub) AS ?count)
WHERE {
  ?sub ?pred ?obj .
  ?sub rdf:type ${rdfType} .
  ${properties.map((_, i) => iToBindBlock(i)).join("\n")}
}
GROUP BY ${properties.map((_, i) => iToVar(i)).join(" ")}
ORDER BY DESC(?count)
`;

        const tableRes = await requestAsSparqlTableResult(sparqlURL, queryString);
        const res: { archetype: Set<string>, count: number }[] = tableRes.results.bindings.map((item) => {
            const archetypeArray = properties.filter((_, i) => {
                const varName = iToVar(i).slice(1); // NOTE: remove the leading "?"
                return item[varName].value === "true";
            });

            return {
                archetype: new Set(archetypeArray),
                count: Number(item.count.value),
              };
        });

        return res;
    };
}


interface ByArchetypeData {
    subject: string,
    [key: string]: string,
};

export function createFindByArchetypeQuery(
    { sparqlURL }: QueryConfig,
) {
    return async function ({ queryKey }: {
      queryKey: [string, string, string[], number],
  }): Promise<ByArchetypeData[]> {
      const [_, rdfType, properties, limit] = queryKey;

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
        const tableResult = await requestAsSparqlTableResult(sparqlURL, queryString);

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
  }
}
