import { expect, test, describe } from "vitest";
import { formatQuery, sparqlVarRe, type VarInfo } from "./complex_property_query_builder";
import type { ComplexPropertySelection } from "@/components/complex_property_selector";
import { Parser } from "@traqula/parser-sparql-1-1";
import { AstTransformer } from '@traqula/rules-sparql-1-1';

function expectExpectedVarsToBeInQuery(
    expectedVarInfos: VarInfo[],
    query: string,
) {
    const expectedVars = expectedVarInfos.map((item) => item.varName);
    // NOTE: find vars and strip leading "?"
    const foundVars = [...new Set(query.match(sparqlVarRe)?.map((s) => s.slice(1)))];
    expect(foundVars).toIncludeAllMembers(expectedVars);
}

/**
 * Assert that bgp (basic graph patterns) appear before optional patterns.
 *
 * This has to be checked because some endpoints throw 500 when bgp are after optional.
 */
function expectCorrectOptionalPosition(query: string) {
    const parser = new Parser();
    const ast = parser.parse(query);
    const transformer = new AstTransformer();

    let visitCount = 0;

    transformer.visitNodeSpecific(ast, {}, {
        pattern: {
            group: {
                visitor: ({ patterns }) => {
                    visitCount++;
                    const bgps = patterns
                        .map((it, i) => [it, i] as const)
                        .filter(([it]) => it.subType === "bgp");
                    const optionals = patterns
                        .map((it, i) => [it, i] as const)
                        .filter(([it]) => it.subType === "optional");

                    // NOTE: if bgps or optionals are missing the order is guaranteed to be correct
                    if (bgps.length === 0 || optionals.length === 0) return;

                    const maxBgpIndex = Math.max(...bgps.map(([_, i]) => i));
                    const minOptionalIndex = Math.min(...optionals.map(([_, i]) => i));

                    expect(maxBgpIndex).toBeLessThan(minOptionalIndex);
                },
            },
        },
    });

    // NOTE: Sanity check, SELECT queries should always be visited at least once
    expect(visitCount).toBeGreaterThan(0);
}

function expectNoDuplicateVarInfo(varInfos: VarInfo[]) {
    expect(varInfos.length).toEqual((new Set(varInfos.map((item) => item.varName))).size);
}

function makeCommonAssertions({
   expectedVarInfos,
    query,
    varInfos
}: {
    varInfos: VarInfo[],
    expectedVarInfos: VarInfo[],
    query: string,
}) {
    expectExpectedVarsToBeInQuery(expectedVarInfos, query);
    expectNoDuplicateVarInfo(varInfos);
    expectCorrectOptionalPosition(query);
}

/** Collapses whitespace and trailing dots so that generated queries can be matched as strings. */
function compact(query: string): string {
    return query.replace(/\s+/g, " ").replace(/ \.(?= |$)/g, "");
}

describe("formatQuery", () => {
    test("basic test", () => {
        const sampleSelection = {
            rdfType: { names: ["http://Person"] },
            dataProps: [{ names: ["http://p0"] }, { names: ["http://p1"] }],
            objectProps: [
                {
                    names: ["http://relation"],
                    selection: {
                        rdfType: { names: ["http://Item"] },
                        dataProps: [{ names: ["http://p0"] }],
                        objectProps: [
                            {
                                names: ["http://anotherRelation"],
                                selection: {
                                    rdfType: { names: ["http://anotherRelatedType"] },
                                    dataProps: [
                                        { names: ["http://lastDataPropISwear"] }
                                    ],
                                    objectProps: [],
                                },
                            }
                        ],
                    },
                },
            ],
        } satisfies ComplexPropertySelection;

        const expectedVarInfos = [
            { varName: "this", path: [] },
            { varName: "p0", path: ["http://p0"] },
            { varName: "p1", path: ["http://p1"] },
            { varName: "relation", path: ["http://relation"] },
            { varName: "relation__p0", path: ["http://relation", "http://p0"] },
            {
                varName: "relation__anotherRelation",
                path: ["http://relation", "http://anotherRelation"],
            },
            {
                varName: "relation__anotherRelation__lastDataPropISwear",
                path: ["http://relation", "http://anotherRelation", "http://lastDataPropISwear"],
            },
        ];

        const { query, varInfos } = formatQuery(sampleSelection);

        // NOTE: asserting one constraint that should appear
        expect(query).toMatch(`?this <${sampleSelection.dataProps[0]?.names[0]}> ?p0`);

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
    test("more realistic test", () => {
        const sampleSelection = {
            rdfType: { names: ["http://data.nobelprize.org/terms/Laureate"] },
            "dataProps": [
                {
                    names: ["http://xmlns.com/foaf/0.1/name"]
                },
                {
                    names: ["http://www.w3.org/2000/01/rdf-schema#label"]
                },
                {
                    names: ["http://dbpedia.org/property/dateOfBirth"]
                },
                {
                    names: ["http://xmlns.com/foaf/0.1/birthday"]
                },
                {
                    names: ["http://xmlns.com/foaf/0.1/givenName"]
                }
            ],
            "objectProps": [
                {
                    names: ["http://dbpedia.org/ontology/birthPlace"],
                    "selection": {
                        rdfType: { names: [""] },
                        "dataProps": [],
                        "objectProps": []
                    }
                },
                {
                    names: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"],
                    "selection": {
                        rdfType: { names: [""] },
                        "dataProps": [],
                        "objectProps": []
                    }
                },
                {
                    names: ["http://dbpedia.org/ontology/deathPlace"],
                    "selection": {
                        rdfType: { names: [""] },
                        "dataProps": [],
                        "objectProps": []
                    }
                }
            ]
        } satisfies ComplexPropertySelection;

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "name", path: ["http://xmlns.com/foaf/0.1/name"] },
            { varName: "label", path: ["http://www.w3.org/2000/01/rdf-schema#label"] },
            { varName: "dateOfBirth", path: ["http://dbpedia.org/property/dateOfBirth"] },
            { varName: "birthday", path: ["http://xmlns.com/foaf/0.1/birthday"] },
            { varName: "givenName", path: ["http://xmlns.com/foaf/0.1/givenName"] },
            { varName: "birthPlace", path: ["http://dbpedia.org/ontology/birthPlace"] },
            { varName: "type", path: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"] },
            { varName: "deathPlace", path: ["http://dbpedia.org/ontology/deathPlace"] },
        ];

        const { query, varInfos } = formatQuery(sampleSelection);

        // NOTE: asserting some constraints that should appear
        expect(query).toMatch(`?this <http://dbpedia.org/property/dateOfBirth> ?dateOfBirth`);
        expect(query).toMatch(`?this <http://dbpedia.org/ontology/birthPlace> ?birthPlace`);

        expect(varInfos).toIncludeAllMembers(expectedVarInfos);

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
    test("potential varName collisions", () => {
        const sampleSelection = {
            rdfType: { names: ["http://ldf.fi/schema/yoma/ReferencedPerson"] },
            "dataProps": [
                {
                    names: ["http://www.w3.org/2004/02/skos/core#prefLabel"]
                },
                {
                    names: ["http://www.w3.org/2008/05/skos-xl#prefLabel"]
                },
            ],
            "objectProps": []
        } satisfies ComplexPropertySelection;

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "core_prefLabel", path: ["http://www.w3.org/2004/02/skos/core#prefLabel"] },
            { varName: "skos_xl_prefLabel", path: ["http://www.w3.org/2008/05/skos-xl#prefLabel"] },
        ];

        const { query, varInfos } = formatQuery(sampleSelection);

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
    test("prefixed var is handled correctly", () => {
        const sampleSelection = {
            rdfType: { names: ["http://ldf.fi/schema/yoma/ReferencedPerson"] },
            "dataProps": [
                {
                    names: ["http://www.w3.org/2004/02/skos/core#prefLabel"]
                },
                {
                    names: ["http://www.w3.org/2008/05/skos-xl#prefLabel"]
                },
                {
                    names: ["http://www.w3.org/2004/02/skos/core#prefLabel123"]
                },
            ],
            "objectProps": [],
        } satisfies ComplexPropertySelection;

        const { query, varInfos } = formatQuery(sampleSelection);

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "core_prefLabel", path: ["http://www.w3.org/2004/02/skos/core#prefLabel"] },
            { varName: "skos_xl_prefLabel", path: ["http://www.w3.org/2008/05/skos-xl#prefLabel"] },
            { varName: "prefLabel123", path: ["http://www.w3.org/2004/02/skos/core#prefLabel123"] },
        ];

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
});

describe("formatQuery unions", () => {
    test("union of data props is bound to the alias variable", () => {
        const sampleSelection = {
            rdfType: { names: [""] },
            dataProps: [
                {
                    names: ["http://schema.org/name", "http://xmlns.com/foaf/0.1/name"],
                    alias: "personName",
                },
            ],
            objectProps: [],
        } satisfies ComplexPropertySelection;

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "personName", path: ["personName"] },
        ];

        const { query, varInfos } = formatQuery(sampleSelection);

        expect(compact(query)).toMatch(
            "OPTIONAL { { ?this <http://schema.org/name> ?personName } UNION { ?this <http://xmlns.com/foaf/0.1/name> ?personName } }"
        );

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
    test("union of data props without alias falls back to the first name", () => {
        const sampleSelection = {
            rdfType: { names: [""] },
            dataProps: [
                {
                    names: ["http://schema.org/name", "http://xmlns.com/foaf/0.1/name"],
                },
            ],
            objectProps: [],
        } satisfies ComplexPropertySelection;

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "name", path: ["http://schema.org/name"] },
        ];

        const { query, varInfos } = formatQuery(sampleSelection);

        expect(compact(query)).toMatch(
            "OPTIONAL { { ?this <http://schema.org/name> ?name } UNION { ?this <http://xmlns.com/foaf/0.1/name> ?name } }"
        );

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
    test("union alias collision is prefixed like other variables", () => {
        const sampleSelection = {
            rdfType: { names: [""] },
            dataProps: [
                { names: ["http://a/label"] },
                {
                    names: ["http://b/label", "http://c/label"],
                    alias: "label",
                },
            ],
            objectProps: [],
        } satisfies ComplexPropertySelection;

        const { query, varInfos } = formatQuery(sampleSelection);

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "a_label", path: ["http://a/label"] },
            { varName: "label", path: ["label"] },
        ];

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
    test("union of types", () => {
        const sampleSelection = {
            rdfType: { names: ["http://Person", "http://Organization"] },
            dataProps: [],
            objectProps: [],
        } satisfies ComplexPropertySelection;

        const { query, varInfos } = formatQuery(sampleSelection);

        expect(compact(query)).toMatch("{ ?this <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://Person> } UNION { ?this <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://Organization> }");

        makeCommonAssertions({
            query,
            expectedVarInfos: [{ varName: "this", path: [] }],
            varInfos,
        });
    });
    test("empty values are ignored", () => {
        const sampleSelection = {
            rdfType: { names: ["", "http://Person"] },
            dataProps: [{ names: ["", "http://p0"] }],
            objectProps: [],
        } satisfies ComplexPropertySelection;

        const { query, varInfos } = formatQuery(sampleSelection);

        expect(compact(query)).not.toMatch("UNION");
        expect(compact(query)).toMatch("?this <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://Person>");
        expect(compact(query)).toMatch("OPTIONAL { ?this <http://p0> ?p0 }");

        makeCommonAssertions({
            query,
            expectedVarInfos: [
                { varName: "this", path: [] },
                { varName: "p0", path: ["http://p0"] },
            ],
            varInfos,
        });
    });
    test("union object prop with alias is used as the nested subject", () => {
        const sampleSelection = {
            rdfType: { names: [""] },
            dataProps: [],
            objectProps: [
                {
                    names: ["http://knows", "http://friend"],
                    alias: "contact",
                    selection: {
                        rdfType: { names: ["http://Person"] },
                        dataProps: [{ names: ["http://name"] }],
                        objectProps: [],
                    },
                },
            ],
        } satisfies ComplexPropertySelection;

        const expectedVarInfos: VarInfo[] = [
            { varName: "this", path: [] },
            { varName: "contact", path: ["contact"] },
            { varName: "contact__name", path: ["contact", "http://name"] },
        ];

        const { query, varInfos } = formatQuery(sampleSelection);

        expect(compact(query)).toMatch(
            "OPTIONAL { { ?this <http://knows> ?contact } UNION { ?this <http://friend> ?contact } }"
        );
        expect(compact(query)).toMatch("?contact <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://Person>");
        expect(compact(query)).toMatch("OPTIONAL { ?contact <http://name> ?contact__name }");

        makeCommonAssertions({ query, expectedVarInfos, varInfos });
    });
});
