import { expect, test, describe } from "vitest";
import {
    formatUniversalPaginatorQuery
} from "./sparql_queries";

describe("formatUniversalPaginationQuery", () => {
    test("basic query with one distinct variable", () => {
        const q = `
SELECT * WHERE {
  ?sub ?pred ?obj .
}
`;
        const res = formatUniversalPaginatorQuery({
            queryToWrap: q,
            groupLimit: 50,
            groupOffset: 100,
            globalLimit: 1000,
            idVars: ["sub"],
        });
        // NOTE: Should have a distinct query involving the ?sub column
        expect(res).toMatch(/SELECT\s+DISTINCT\s+\?sub/);
        // NOTE: Match passed parameters
        expect(res).toMatch(/LIMIT 50/);
        expect(res).toMatch(/OFFSET 100/);
        expect(res).toMatch(/LIMIT 1000/);
    });

    test("basic query with two distinct variables", () => {
        const q = `
SELECT * WHERE {
  ?sub ?pred ?obj .
}
`;
        const res = formatUniversalPaginatorQuery({
            queryToWrap: q,
            groupLimit: 20,
            groupOffset: 30,
            globalLimit: 2000,
            idVars: ["sub", "pred"],
        });

        // NOTE: Match "DISTINCT ?sub ?pred"
        expect(res).toMatch(/SELECT\s+DISTINCT\s+\?sub\s+\?pred/);
        // NOTE: Match passed parameters
        expect(res).toMatch(/LIMIT 20/);
        expect(res).toMatch(/OFFSET 30/);
        expect(res).toMatch(/LIMIT 2000/);
    });
});
