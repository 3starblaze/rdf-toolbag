import { expect, test, describe } from "vitest";
import { formatQuery } from "./complex_property_query_builder";
import type { ComplexPropertySelection } from "@/components/complex_property_selector";

describe("formatQuery", () => {
    test("basic test", () => {
        const selection: ComplexPropertySelection = {
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
        };
        const expectedVars = [
            "?this",
            "?this_d_0",
            "?this_d_1",
            "?this_o_0",
            "?this_o_0_d_0",
            "?this_o_0_o_0",
            "?this_o_0_o_0_d_0",
        ];

        const formattedQuery = formatQuery(selection);
        const foundVars = new Set(formattedQuery.match(/\?\w+/g));

        // NOTE: we should see all the expected vars in the query
        expect(expectedVars.every((varName) => foundVars.has(varName))).toBe(true);

        // NOTE: asserting one constraint that should appear
        expect(formattedQuery).toMatch(`?this_o_0 <${selection.dataProps[0].name}> ?this_o_0_d_0`);
    });
});
