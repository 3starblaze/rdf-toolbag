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
    const newUrl = new URL(url);
    newUrl.searchParams.set("query", queryString);

    const req = new Request(newUrl);

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

    return async function (): Promise<SparqlTableResult> {
        return requestAsSparqlTableResult(sparqlURL, queryString);
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
