import { reorderOptional } from "@/query-util";
import { definitionOf, type ConstraintQueryContext } from "./constraints";
import type { ComplexPropertySelection, ConstraintArg, SelectedProperty } from "./shared";
import { formatIri, formatStringLiteral, formatVariable } from "./sparql-terms";

// NOTE: technically there are more items that only can appear after the first character (not
// counting ? or $) but I think we can omit them for now.
const sparqlVarNameRanges = [
    ["0".codePointAt(0)!, "9".codePointAt(0)!],
    ["A".codePointAt(0)!, "Z".codePointAt(0)!],
    ["_".codePointAt(0)!, "_".codePointAt(0)!],
    ["a".codePointAt(0)!, "z".codePointAt(0)!],
    [0x00C0, 0x00D6],
    [0x00D8, 0x00F6],
    [0x00F8, 0x02FF],
    [0x0370, 0x037D],
    [0x037F, 0x1FFF],
    [0x200C, 0x200D],
    [0x2070, 0x218F],
    [0x2C00, 0x2FEF],
    [0x3001, 0xD7FF],
    [0xF900, 0xFDCF],
    [0xFDF0, 0xFFFD],
    // NOTE: This range is problematic for endpoints that don't support multi-byte characters
    [0x10000, 0xEFFFF],
] as const;

export const sparqlVarRe: RegExp = (() => {
    const fmtCodePoint = (it: number) => `\\u{${it.toString(16)}}`;

    const ranges = sparqlVarNameRanges
        .map(([from, to]) => `${fmtCodePoint(from)}-${fmtCodePoint(to)}`);

    return new RegExp(`[?$][${ranges.join("")}]+`, "gu");
})();

const subjectVarName = "this";
const pathSeparatorChar = "__";
const pathItemSegmentSeparatorChar = "_";
const placeholderChar = "_";
const uriSplitterRe = /[/|#]+/;

function isCharLegalForVarName(ch: string): boolean {
    const i = ch.codePointAt(0)!;
    return sparqlVarNameRanges.some(([from, to]) => i >= from && i <= to);
}

function sanitizeSparqlVarName(candidateName: string): string {
    return [...candidateName]
        .map((ch) => isCharLegalForVarName(ch) ? ch : placeholderChar)
        .join("");
}

export interface VarInfo {
    /** Final SPARQL variable name, without the leading "?". */
    varName: string,
    /** `SelectedProperty.id` of the property bound to the variable, `null` for the subject. */
    propertyId: string | null,
    /** Steps (usually URIs) that the variable name was made from. Empty for the subject. */
    path: readonly string[],
}

/**
 * Candidate variable name of a path. Only the last `-sliceIndex` URI segments of each step are
 * used, since the last segment of a URI is usually its most accurate identifier.
 */
function uriSegments(item: string): string[] {
    return item.split(uriSplitterRe).filter((it) => it !== "");
}

function formatVar(path: readonly string[], sliceIndex: number): string {
    // NOTE: Since empty name is not allowed, we need something like this
    if (path.length === 0) return subjectVarName;
    const candidateName = path
        .map((item) => uriSegments(item).slice(sliceIndex).join(pathItemSegmentSeparatorChar))
        .join(pathSeparatorChar);
    return sanitizeSparqlVarName(candidateName) || placeholderChar;
}

function segmentCount(path: readonly string[]): number {
    return Math.max(0, ...path.map((item) => uriSegments(item).length));
}

/**
 * Assign a unique variable name to each path. Colliding names are made longer by including more
 * URI segments; names that still collide get a numeric suffix.
 */
function assignVarNames(paths: readonly (readonly string[])[]): string[] {
    const sliceIndices = paths.map(() => -1);
    const names = paths.map((path) => formatVar(path, -1));

    const collidingIndices = () => {
        const grouped = Map.groupBy(names.map((name, i) => [name, i] as const), ([name]) => name);
        return [...grouped.values()].filter((group) => group.length > 1).map((group) => group.map(([, i]) => i));
    };

    // NOTE: Every round makes at least one name longer, so the loop is bounded by the longest path.
    let changed = true;
    while (changed) {
        changed = false;
        for (const group of collidingIndices()) {
            for (const i of group) {
                if (-sliceIndices[i]! >= segmentCount(paths[i]!)) continue;
                sliceIndices[i]!--;
                names[i] = formatVar(paths[i]!, sliceIndices[i]!);
                changed = true;
            }
        }
    }

    // NOTE: Should only happen when paths are equal (or sanitize to the same name).
    const used = new Set(names);
    for (const group of collidingIndices()) {
        for (const i of group.slice(1)) {
            let n = 1;
            while (used.has(`${names[i]}${n}`)) n++;
            names[i] = `${names[i]}${n}`;
            used.add(names[i]!);
        }
    }

    return names;
}

/** Alternatives whose every step is filled in. */
function completeAlternatives(property: SelectedProperty): string[][] {
    return property.alternatives.filter((steps) => steps.length > 0 && steps.every((step) => step !== ""));
}

/**
 * Path that names a property. Union properties are named by their alias when one is provided,
 * otherwise by their first alternative.
 */
function namingPathOf(property: SelectedProperty, alternatives: readonly string[][]): string[] {
    if (alternatives.length > 1 && property.alias) return [property.alias];
    return alternatives[0]!;
}

/** Joins patterns so that at least one of them must match. */
function unionOf(patterns: readonly string[]): string {
    if (patterns.length === 1) return patterns[0]!;
    return patterns.map((it) => `{ ${it} }`).join(" UNION ");
}

/** Triple pattern(s) that bind the property's variable. Optional properties are wrapped in OPTIONAL. */
function propertyFragment(
    alternatives: readonly string[][],
    mandatory: boolean,
    varName: string,
): string {
    const subject = formatVariable(subjectVarName);
    const object = formatVariable(varName);
    const pattern = unionOf(
        alternatives.map((steps) => `${subject} ${steps.map(formatIri).join("/")} ${object} .`),
    );
    return mandatory ? pattern : `OPTIONAL { ${pattern} }`;
}

/**
 * Make a query that represents the passed selection.
 *
 * Every property with at least one complete path binds its own variable, which constraints refer
 * to. Incomplete properties and constraints that refer to them (or have an empty literal) are
 * left out.
 */
export function formatQuery(selection: ComplexPropertySelection): {
    query: string,
    varInfos: VarInfo[],
} {
    const properties = selection.properties
        .map((property) => ({ property, alternatives: completeAlternatives(property) }))
        .filter(({ alternatives }) => alternatives.length > 0);

    const namingPaths = [
        [],
        ...properties.map(({ property, alternatives }) => namingPathOf(property, alternatives)),
    ];
    const varNames = assignVarNames(namingPaths);

    const varInfos: VarInfo[] = namingPaths.map((path, i) => ({
        varName: varNames[i]!,
        propertyId: i === 0 ? null : properties[i - 1]!.property.id,
        path,
    }));
    const varNameByPropertyId = new Map(varInfos.map((it) => [it.propertyId, it.varName]));

    const ctx: ConstraintQueryContext = {
        term: (arg: ConstraintArg, literalAs) => {
            switch (arg.kind) {
                case "subject":
                    return formatVariable(subjectVarName);
                case "property": {
                    const varName = varNameByPropertyId.get(arg.propertyId);
                    return varName === undefined ? null : formatVariable(varName);
                }
                case "literal":
                    if (arg.value === "") return null;
                    return literalAs === "iri" ? formatIri(arg.value) : formatStringLiteral(arg.value);
            }
        },
    };

    const fragments = [
        ...properties.map(({ property, alternatives }) =>
            propertyFragment(alternatives, property.mandatory, varNameByPropertyId.get(property.id)!)),
        ...selection.constraints.flatMap((constraint) => {
            const fragment = definitionOf(constraint).queryFragment(constraint, ctx);
            return fragment === null ? [] : [fragment];
        }),
    ];

    const indentation = "  ";
    const lines = [
        "SELECT * WHERE {",
        ...fragments.map((line) => `${indentation}${line}`),
        "}",
    ];

    return { query: reorderOptional(lines.join("\n")), varInfos };
}
