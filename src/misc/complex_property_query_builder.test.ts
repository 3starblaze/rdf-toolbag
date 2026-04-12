import { expect, test, describe } from "vitest";
import { demangleVarName, formatQuery } from "./complex_property_query_builder";
import type { ComplexPropertySelection } from "@/components/complex_property_selector";

const sampleSelection = {
    rdfType: "http://Person",
    dataProps: [{ name: "http://p0" }, { name: "http://p1" }],
    objectProps: [
        {
            name: "http://relation",
            selection: {
                rdfType: "http://Item",
                dataProps: [{ name: "http://p0" }],
                objectProps: [
                    {
                        name: "http://anotherRelation",
                        selection: {
                            rdfType: "http://anotherRelatedType",
                            dataProps: [
                                { name: "http://lastDataPropISwear" }
                            ],
                            objectProps: [],
                        },
                    }
                ],
            },
        },
    ],
} satisfies ComplexPropertySelection;

describe("formatQuery", () => {
    test("basic test", () => {
        const expectedVars = [
            "?this",
            "?this_d_0",
            "?this_d_1",
            "?this_o_0",
            "?this_o_0_d_0",
            "?this_o_0_o_0",
            "?this_o_0_o_0_d_0",
        ];

        const formattedQuery = formatQuery(sampleSelection);
        const foundVars = new Set(formattedQuery.match(/\?\w+/g));

        // NOTE: we should see all the expected vars in the query
        expect(expectedVars.every((varName) => foundVars.has(varName))).toBe(true);

        // NOTE: asserting one constraint that should appear
        expect(formattedQuery).toMatch(`?this_o_0 <${sampleSelection.dataProps[0]?.name}> ?this_o_0_d_0`);
    });
});

describe("demangleVarName", () => {
    test("just this", () => {
        expect(demangleVarName("this", sampleSelection)).toMatch("this");
    });
    test("data prop", () => {
        expect(demangleVarName("this_d_1", sampleSelection)).toMatch("this > http://p1");
    });
    test("obj prop", () => {
        expect(demangleVarName("this_o_0", sampleSelection)).toMatch("this > http://relation");
    });
    test("nested data prop", () => {
        expect(demangleVarName("this_o_0_d_0", sampleSelection))
            .toMatch("this > http://relation > http://p0");
    });
    test("deeper nesting", () => {
        expect(demangleVarName("this_o_0_o_0_d_0", sampleSelection))
            .toMatch("this > http://relation > http://anotherRelation > http://lastDataPropISwear");
    });
    test("garbage is rejected", () => {
        expect(demangleVarName("garbage", sampleSelection)).toBe(null);
    });
    test("garbage starting with 'this' is rejected", () => {
       expect(demangleVarName("this_garbage", sampleSelection)).toBe(null);
    });
    test("out of range property is rejected", () => {
       expect(demangleVarName("this_d_99", sampleSelection)).toBe(null);
    });
});
