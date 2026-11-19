import { expect, test, describe } from "vitest";
import { Parser } from "@traqula/parser-sparql-1-1";
import { AstTransformer } from "@traqula/rules-sparql-1-1";
import { formatQuery, sparqlVarRe, type VarInfo } from "./query-builder";
import type { ComplexPropertySelection, SelectedProperty } from "./shared";
import type { Constraint } from "./constraints";

/**
 * Assert that bgp (basic graph patterns) appear before optional patterns.
 *
 * This has to be checked because some endpoints throw 500 when bgp are after optional.
 */
function expectCorrectOptionalPosition(query: string) {
    const ast = new Parser().parse(query);
    let visitCount = 0;

    new AstTransformer().visitNodeSpecific(ast, {}, {
        pattern: {
            group: {
                visitor: ({ patterns }) => {
                    visitCount++;
                    const indicesOf = (subType: string) => patterns
                        .map((it, i) => [it, i] as const)
                        .filter(([it]) => it.subType === subType)
                        .map(([, i]) => i);
                    const bgps = indicesOf("bgp");
                    const optionals = indicesOf("optional");
                    if (bgps.length === 0 || optionals.length === 0) return;
                    expect(Math.max(...bgps)).toBeLessThan(Math.min(...optionals));
                },
            },
        },
    });

    expect(visitCount).toBeGreaterThan(0);
}

function makeCommonAssertions(query: string, varInfos: VarInfo[]) {
    const foundVars = new Set(query.match(sparqlVarRe)?.map((s) => s.slice(1)));
    for (const { varName } of varInfos) {
        // NOTE: the subject only appears when something refers to it
        if (varName !== "this" || varInfos.length > 1) expect(foundVars).toContain(varName);
    }
    expect(new Set(varInfos.map((it) => it.varName)).size).toEqual(varInfos.length);
    expectCorrectOptionalPosition(query);
}

/** `a` is written out in full by the query generator. */
const rdfTypeIri = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";

/** Collapses whitespace and trailing dots so that generated queries can be matched as strings. */
function compact(query: string): string {
    return query.replace(/\s+/g, " ").replace(/ \.(?= |$)/g, "");
}

function prop(id: string, steps: string[] | string[][], extra: Partial<SelectedProperty> = {}): SelectedProperty {
    const alternatives = Array.isArray(steps[0]) ? steps as string[][] : [steps as string[]];
    return { id, alternatives, mandatory: false, ...extra };
}

function run(selection: ComplexPropertySelection) {
    const result = formatQuery(selection);
    makeCommonAssertions(result.query, result.varInfos);
    return { ...result, compacted: compact(result.query) };
}

function varOf(varInfos: VarInfo[], propertyId: string): string {
    return varInfos.find((it) => it.propertyId === propertyId)!.varName;
}

describe("formatQuery properties", () => {
    test("each property binds its own variable", () => {
        const { compacted, varInfos } = run({
            properties: [prop("p1", ["http://p0"]), prop("p2", ["http://p1"])],
            constraints: [],
        });

        expect(varInfos).toIncludeSameMembers([
            { varName: "this", propertyId: null, path: [] },
            { varName: "p0", propertyId: "p1", path: ["http://p0"] },
            { varName: "p1", propertyId: "p2", path: ["http://p1"] },
        ]);
        expect(compacted).toContain("OPTIONAL { ?this <http://p0> ?p0 }");
        expect(compacted).toContain("OPTIONAL { ?this <http://p1> ?p1 }");
    });

    test("multi-step path is a property path bound to one variable", () => {
        const { compacted, varInfos } = run({
            properties: [prop("p1", ["http://relation", "http://name"])],
            constraints: [],
        });

        expect(varOf(varInfos, "p1")).toEqual("relation__name");
        expect(compacted).toContain("?this (<http://relation>/<http://name>) ?relation__name");
    });

    test("mandatory property is not wrapped in OPTIONAL", () => {
        const { compacted } = run({
            properties: [prop("p1", ["http://p0"], { mandatory: true }), prop("p2", ["http://p1"])],
            constraints: [],
        });

        expect(compacted).toContain("?this <http://p0> ?p0");
        expect(compacted).not.toContain("OPTIONAL { ?this <http://p0> ?p0 }");
        expect(compacted).toContain("OPTIONAL { ?this <http://p1> ?p1 }");
    });

    test("alternatives are a union bound to the alias variable", () => {
        const { compacted, varInfos } = run({
            properties: [
                prop("p1", [["http://a"], ["http://b", "http://c"]], { alias: "label", mandatory: true }),
            ],
            constraints: [],
        });

        expect(varOf(varInfos, "p1")).toEqual("label");
        expect(compacted).toContain("{ ?this <http://a> ?label } UNION { ?this (<http://b>/<http://c>) ?label }");
    });

    test("union without alias is named by the first alternative", () => {
        const { varInfos } = run({
            properties: [prop("p1", [["http://a"], ["http://b"]])],
            constraints: [],
        });

        expect(varOf(varInfos, "p1")).toEqual("a");
    });

    test("incomplete paths are ignored", () => {
        const { compacted, varInfos } = run({
            properties: [
                prop("p1", [""]),
                prop("p2", [["http://a", ""], ["http://b"]]),
            ],
            constraints: [],
        });

        expect(varInfos.map((it) => it.propertyId)).toIncludeSameMembers([null, "p2"]);
        expect(compacted).toContain("OPTIONAL { ?this <http://b> ?b }");
        expect(compacted).not.toContain("http://a");
    });

    test("colliding names use more URI segments", () => {
        const { varInfos } = run({
            properties: [
                prop("p1", ["http://www.w3.org/2004/02/skos/core#prefLabel"]),
                prop("p2", ["http://www.w3.org/2008/05/skos-xl#prefLabel"]),
                prop("p3", ["http://www.w3.org/2004/02/skos/core#prefLabel123"]),
            ],
            constraints: [],
        });

        expect(varOf(varInfos, "p1")).toEqual("core_prefLabel");
        expect(varOf(varInfos, "p2")).toEqual("skos_xl_prefLabel");
        expect(varOf(varInfos, "p3")).toEqual("prefLabel123");
    });

    test("equal paths get distinct variables", () => {
        const { varInfos } = run({
            properties: [prop("p1", ["http://p0"]), prop("p2", ["http://p0"]), prop("p3", ["http://p01"])],
            constraints: [],
        });

        expect(new Set(varInfos.map((it) => it.varName)).size).toEqual(4);
    });

    test("property named like the subject does not take its variable", () => {
        const { varInfos } = run({
            properties: [prop("p1", ["http://example/this"])],
            constraints: [],
        });

        expect(varOf(varInfos, "p1")).not.toEqual("this");
    });

    test("IRIs are escaped", () => {
        const { query } = run({
            properties: [prop("p1", ["http://example/a b>c"])],
            constraints: [],
        });

        expect(query).toContain("<http://example/a%20b%3Ec>");
    });
});

describe("formatQuery constraints", () => {
    const rdfType = (target: Constraint["target"], value: Constraint["value"]): Constraint =>
        ({ subType: "rdfType", id: "c1", target, value });
    const langMatches = (target: Constraint["target"], value: Constraint["value"]): Constraint =>
        ({ subType: "langMatches", id: "c2", target, value });

    test("rdfType with subject and literal", () => {
        const { compacted } = run({
            properties: [],
            constraints: [rdfType({ kind: "subject" }, { kind: "literal", value: "http://Person" })],
        });

        expect(compacted).toContain(`?this ${rdfTypeIri} <http://Person>`);
    });

    test("rdfType with properties as both arguments", () => {
        const { compacted } = run({
            properties: [prop("p1", ["http://friend"]), prop("p2", ["http://friendType"])],
            constraints: [
                rdfType({ kind: "property", propertyId: "p1" }, { kind: "property", propertyId: "p2" }),
            ],
        });

        expect(compacted).toContain(`?friend ${rdfTypeIri} ?friendType`);
    });

    test("langMatches with property and literal", () => {
        const { compacted } = run({
            properties: [prop("p1", ["http://label"])],
            constraints: [langMatches({ kind: "property", propertyId: "p1" }, { kind: "literal", value: "en" })],
        });

        expect(compacted).toContain('FILTER ( ( LANG( ?label ) = "en" ) )');
    });

    test("langMatches literal is escaped", () => {
        const { query } = run({
            properties: [prop("p1", ["http://label"])],
            constraints: [langMatches({ kind: "property", propertyId: "p1" }, { kind: "literal", value: 'e"n' })],
        });

        expect(query).toContain('"e\\"n"');
    });

    test("incomplete constraints are left out", () => {
        const { compacted } = run({
            properties: [prop("p1", [""])],
            constraints: [
                rdfType({ kind: "subject" }, { kind: "literal", value: "" }),
                langMatches({ kind: "property", propertyId: "p1" }, { kind: "literal", value: "en" }),
                rdfType({ kind: "property", propertyId: "removed" }, { kind: "literal", value: "http://T" }),
            ],
        });

        expect(compacted).toEqual("SELECT * WHERE { }");
    });
});
