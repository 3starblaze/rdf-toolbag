import { expect, test, describe } from 'vitest'
import {
  rewriteQueryWithPrefixes,
  findVars,
  isQueryValid,
  reorderOptional,
  dropUselessOptionals,
  flattenUselessSubqueries,
} from './query-util';
import { Parser } from '@traqula/parser-sparql-1-1';
import { AstTransformer} from '@traqula/rules-sparql-1-1';

// NOTE: Root of the query also is included in the count
function countQueries(q: string) {
  const parser = new Parser();
  const ast = parser.parse(q);
  const transformer = new AstTransformer();

  let count = 0;

  transformer.visitNode(ast, {
    query: {
      visitor(it) {
        if (it.subType === "select") count++;
      },
    }
  });

  return count;
}

describe("rewriteQueryWithPrefixes", () => {
  test("no prefixes initially", () => {
    const query = `SELECT * WHERE {
   OPTIONAL { ?this <http://xmlns.com/foaf/0.1/name> ?name }
  OPTIONAL { ?this <http://www.w3.org/2000/01/rdf-schema#label> ?label }
  OPTIONAL { ?this <http://dbpedia.org/property/dateOfBirth> ?dateOfBirth }
  OPTIONAL { ?this <http://xmlns.com/foaf/0.1/birthday> ?birthday }
  OPTIONAL { ?this <http://xmlns.com/foaf/0.1/givenName> ?givenName }
  OPTIONAL { ?this <http://dbpedia.org/ontology/birthPlace> ?birthPlace }
  OPTIONAL { ?this <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type }
  OPTIONAL { ?this <http://dbpedia.org/ontology/deathPlace> ?deathPlace }
  ?this a <http://data.nobelprize.org/terms/Laureate> .
}`;

    const newQuery = rewriteQueryWithPrefixes({
      query,
      prefixInfo: [
        { prefix: "", uri: "http://data.nobelprize.org/terms/" },
        { prefix: "foaf", uri: "http://xmlns.com/foaf/0.1/" },
        { prefix: "rdfs", uri: "http://www.w3.org/2000/01/rdf-schema#" },
        { prefix: "dbp", uri: "http://dbpedia.org/property/" },
        { prefix: "dbo", uri: "http://dbpedia.org/ontology/" },
        { prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
      ],
    });

    const prefixBoundary = newQuery.indexOf("SELECT");
    if (prefixBoundary === -1) throw "Could not find SELECT!";

    const prefixArea = newQuery.slice(0, prefixBoundary);
    const restArea = newQuery.slice(prefixBoundary);

    // NOTE: should not match uris outside prefix zone
    expect(restArea).not.toMatch(/<.*>/);

    const prefixedNames = [
      "foaf:name",
      "rdfs:label",
      ":Laureate",
      "foaf:givenName",
      "dbp:dateOfBirth",
    ];

    prefixedNames.forEach((it) => expect(restArea).toMatch(it));

    const prefixDefs = [
      "PREFIX : <http://data.nobelprize.org/terms/>",
      "PREFIX foaf: <http://xmlns.com/foaf/0.1/>",
      "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
      "PREFIX dbp: <http://dbpedia.org/property/>",
      "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
      "PREFIX dbo: <http://dbpedia.org/ontology/>",
    ]
    // NOTE: match prefix definitions
    prefixDefs.forEach((it) => expect(prefixArea).toMatch(it));
  });

  test("partially prefixed", () => {
    const query = `PREFIX : <http://data.nobelprize.org/terms/>
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT DISTINCT * WHERE{
  ?Award rdf:type dbo:Award .
  OPTIONAL{?Award rdfs:label ?label .  }
  OPTIONAL{?Award :motivation ?motivation .  }
  OPTIONAL{?Award <http://data.nobelprize.org/terms/year> ?year .  }
  OPTIONAL{?Award <http://data.nobelprize.org/terms/share> ?share .  }
  OPTIONAL{?Award :sortOrder ?sortOrder .  }
  OPTIONAL{?Award :categoryOrder ?categoryOrder .  }
}`;

    const newQuery = rewriteQueryWithPrefixes({ query, prefixInfo: [
      { prefix: "", uri: "http://data.nobelprize.org/terms/" }
    ] });

    const prefixBoundary = newQuery.indexOf("SELECT");
    if (prefixBoundary === -1) throw "Could not find SELECT!";

    const prefixArea = newQuery.slice(0, prefixBoundary);
    const restArea = newQuery.slice(prefixBoundary);

    // NOTE: should not match uris outside prefix zone
    expect(restArea).not.toMatch(/<.*>/);

    const matches = [...prefixArea.matchAll(/http:\/\/data.nobelprize.org\/terms\//g)];

    // NOTE: prefix should not be redefined if it already exists
    expect(matches).toHaveLength(1);
  })
});

describe("findVars", () => {
  test("basic test", () => {
    const query = `SELECT * WHERE {
    OPTIONAL { ?this <http://xmlns.com/foaf/0.1/name> ?name }
    OPTIONAL { ?this <http://www.w3.org/2000/01/rdf-schema#label> ?label }
    OPTIONAL { ?this <http://dbpedia.org/property/dateOfBirth> ?dateOfBirth }
    OPTIONAL { ?this <http://xmlns.com/foaf/0.1/birthday> ?birthday }
    OPTIONAL { ?this <http://xmlns.com/foaf/0.1/givenName> ?givenName }
    OPTIONAL { ?this <http://dbpedia.org/ontology/birthPlace> ?birthPlace }
    OPTIONAL { ?this <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type }
    OPTIONAL { ?this <http://dbpedia.org/ontology/deathPlace> ?deathPlace }
    ?this a <http://data.nobelprize.org/terms/Laureate> .
    }`;

    const vars = findVars({ query });

    expect(vars).toIncludeAllMembers([
      "this",
      "name",
      "label",
      "dateOfBirth",
      "birthday",
      "givenName",
      "birthPlace",
      "type",
      "deathPlace",
    ]);
  });
});

describe("isQueryValid", () => {
  test("valid query", () => {
    const query = "SELECT * WHERE { ?s ?p ?o }";
    expect(isQueryValid(query)).toBeTrue();
  });

  test("invalid query", () => {
    const query = "SELECT * WHERE ?s ?p ?o";
    expect(isQueryValid(query)).toBeFalse();
  });
});

describe("reorderOptional", () => {
  test("basic test", () => {
    const query = `PREFIX kbv: <https://id.kb.se/vocab/>
PREFIX : <https://id.kb.se/marc/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT * WHERE {
  OPTIONAL {
    ?this kbv:label ?label .
  }
  OPTIONAL {
    ?this :fieldref ?fieldref .
  }
  ?this rdf:type kbv:Note .
  OPTIONAL {
    ?this :headingOrSubdivisionTerm ?headingOrSubdivisionTerm .
  }
  OPTIONAL {
    ?this kbv:scopeNote ?scopeNote .
  }
  OPTIONAL {
    ?this kbv:hasNote ?hasNote .
  }
  FILTER(?label != "H3299A")
} LIMIT 100`;

    const expectedQuery = `PREFIX kbv: <https://id.kb.se/vocab/>
PREFIX : <https://id.kb.se/marc/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT * WHERE {
  ?this rdf:type kbv:Note .
  OPTIONAL { ?this kbv:label ?label . }
  OPTIONAL { ?this :fieldref ?fieldref . }
  OPTIONAL { ?this :headingOrSubdivisionTerm ?headingOrSubdivisionTerm . }
  OPTIONAL { ?this kbv:scopeNote ?scopeNote . }
  OPTIONAL { ?this kbv:hasNote ?hasNote . }
  FILTER ( ( ?label != "H3299A" ) )
}
LIMIT 100`;

    expect(query).toBeValidSparqlQuery();
    expect(expectedQuery).toBeValidSparqlQuery();

    const newQuery = reorderOptional(query);

    expect(newQuery).toEqual(expectedQuery);
  });
});

describe("dropUselessOptionals", () => {
  test("Optional key with two steps", () => {
    const query = `
    PREFIX : <https://dblp.org/rdf/schema#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT DISTINCT ?this ?createdBy__label
      WHERE {
        ?this rdf:type :Publication .
        OPTIONAL { ?this :numberOfCreators ?numberOfCreators . }
        OPTIONAL { ?this rdfs:label ?label . }
        OPTIONAL { ?this :title ?title . }
        OPTIONAL { ?this :yearOfPublication ?yearOfPublication . }
        OPTIONAL { ?this :publishedIn ?publishedIn . }
        OPTIONAL { ?this :hasSignature ?hasSignature . }
        OPTIONAL { ?this :createdBy ?createdBy . }
        OPTIONAL { ?createdBy rdfs:label ?createdBy__label . }
    }`;

    const newQuery = dropUselessOptionals(query);


    function withAnySpace(expected: string) {
      const src = expected
        // NOTE: escape some regex symbols
        .replaceAll("{", "\\{")
        .replaceAll("}", "\\}")
        .replaceAll("?", "\\?")
        .replaceAll(":", "\\:")
        // NOTE: turn literal space into any whitespace
        .replaceAll(" ", "\\s+");
      return new RegExp(src);
    }

    expect(newQuery).toMatch(withAnySpace("?this rdf:type :Publication ."));
    expect(newQuery).toMatch(withAnySpace("OPTIONAL { ?this :createdBy ?createdBy . }"));
    expect(newQuery).toMatch(withAnySpace("OPTIONAL { ?createdBy rdfs:label ?createdBy__label . }"));

    const blacklist = `
        OPTIONAL { ?this :numberOfCreators ?numberOfCreators . }
        OPTIONAL { ?this rdfs:label ?label . }
        OPTIONAL { ?this :title ?title . }
        OPTIONAL { ?this :yearOfPublication ?yearOfPublication . }
        OPTIONAL { ?this :publishedIn ?publishedIn . }
        OPTIONAL { ?this :hasSignature ?hasSignature . }`
      .trim()
      .split("\n")
      .map((it) => it.trim());

    blacklist.forEach((it) => expect(newQuery).not.toMatch(withAnySpace(it)));
  });
});

describe("flattenUselessSubqueries", () => {
  test("Double subquery + subquery", () => {
    const query = `PREFIX : <https://dblp.org/rdf/schema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
SELECT DISTINCT ?this ?__propName ?__propVal {
VALUES ?__propName { "numberOfCreators" "label" "title" "yearOfPublication" "publishedIn" "hasSignature" "createdBy" "createdBy__label" }
  {
  SELECT DISTINCT ?this
  WHERE {
    SELECT ?this WHERE {
      ?this rdf:type :Publication .
      OPTIONAL { ?this :numberOfCreators ?numberOfCreators . }
      OPTIONAL { ?this rdfs:label ?label . }
      OPTIONAL { ?this :title ?title . }
      OPTIONAL { ?this :yearOfPublication ?yearOfPublication . }
      OPTIONAL { ?this :publishedIn ?publishedIn . }
      OPTIONAL { ?this :hasSignature ?hasSignature . }
      OPTIONAL { ?this :createdBy ?createdBy . }
      OPTIONAL { ?createdBy rdfs:label ?createdBy__label . }
    } ORDER BY ?this
  }
  ORDER BY ?this
  LIMIT 10
  OFFSET 0
  }
  {

  SELECT * WHERE {
    ?this rdf:type :Publication .
    OPTIONAL { ?this :numberOfCreators ?numberOfCreators . }
    OPTIONAL { ?this rdfs:label ?label . }
    OPTIONAL { ?this :title ?title . }
    OPTIONAL { ?this :yearOfPublication ?yearOfPublication . }
    OPTIONAL { ?this :publishedIn ?publishedIn . }
    OPTIONAL { ?this :hasSignature ?hasSignature . }
    OPTIONAL { ?this :createdBy ?createdBy . }
    OPTIONAL { ?createdBy rdfs:label ?createdBy__label . }
  }
  }
BIND(IF(?__propName = "numberOfCreators", ?numberOfCreators, IF(?__propName = "label", ?label, IF(?__propName = "title", ?title, IF(?__propName = "yearOfPublication", ?yearOfPublication, IF(?__propName = "publishedIn", ?publishedIn, IF(?__propName = "hasSignature", ?hasSignature, IF(?__propName = "createdBy", ?createdBy, IF(?__propName = "createdBy__label", ?createdBy__label, "N/A")))))))) AS ?__propVal)
FILTER ( BOUND(?__propVal) )
} LIMIT 100000`;

    const newQuery = flattenUselessSubqueries(query);

    expect(newQuery).toBeValidSparqlQuery();

    // NOTE: Root + 2x nested subquery for keys + main content subquery
    expect(countQueries(query)).toEqual(4);
    // NOTE: Root + flattened key subquery
    expect(countQueries(newQuery)).toEqual(2);
  });

  test("Leaky subquery is not projected", () => {
    // NOTE: The last subquery cannot be safely projected because we risk leaking "?this"
    const query = `PREFIX voc: <https://example.com/vocabulary/>
SELECT DISTINCT ?productType ?color ?__propName ?__propVal WHERE {
  VALUES ?__propName {
    "buildType"
    "price"
    "this"
  }
  {
    SELECT DISTINCT ?productType ?color WHERE {
      SELECT ?productType ?color ?buildType ?price WHERE {
        ?this voc:productType ?productType .
        ?this voc:color ?color .
        ?this voc:buildType ?buildType .
        ?this voc:price ?price .
      }
      ORDER BY ASC ( ?productType ) ASC ( ?color ) ASC ( ?buildType ) ASC ( ?price )
    }
    ORDER BY ASC ( ?productType ) ASC ( ?color ) ASC ( ?buildType ) ASC ( ?price )
    LIMIT 100
  }
  {
    SELECT ?productType ?color ?buildType ?price WHERE {
      ?this voc:productType ?productType .
      ?this voc:color ?color .
      ?this voc:buildType ?buildType .
      ?this voc:price ?price .
    }
    ORDER BY ASC ( ?productType ) ASC ( ?color ) ASC ( ?buildType ) ASC ( ?price )
  }
  BIND( IF( ( ?__propName = "buildType" ) , ?buildType , IF( ( ?__propName = "price" ) , ?price , IF( ( ?__propName = "this" ) , ?this , "N/A" ) ) ) AS ?__propVal )
  FILTER ( BOUND( ?__propVal ) )
}
ORDER BY ASC ( ?productType ) ASC ( ?color ) ASC ( ?buildType ) ASC ( ?price )
    LIMIT 10000`;

    const newQuery = flattenUselessSubqueries(query);

    expect(newQuery).toBeValidSparqlQuery();

    // NOTE: Root + 2x nested subquery for keys + main content subquery
    expect(countQueries(query)).toEqual(4);
    // NOTE: Root + flattened key subquery + main content subquery
    expect(countQueries(newQuery)).toEqual(3);
  });
});
