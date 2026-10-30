import type { ComplexPropertySelection, PropertySelection } from "@/components/complex_property_selector";
import { reorderOptional } from "@/query-util";
import { HashSet, Data, HashMap, Option } from "effect";

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
    const fmtCodePoint = (it: number) => `\\u${it.toString(16).padStart(4, "0")}`;

    const ranges = sparqlVarNameRanges
        .map(([from, to]) => `${fmtCodePoint(from)}-${fmtCodePoint(to)}`);

    return new RegExp(`[?$][${ranges.join("")}]+`, "gu");
})();

const pathSeparatorChar = "__";
const pathItemSegmentSeparatorChar = "_";
const placeholderChar = "_";

function isCharLegalForVarName(ch: string) {
  const i = ch.codePointAt(0);
  if (i === undefined) throw "empty character";
  const res = sparqlVarNameRanges.find(([from, to]) => i >= from && i <= to);
  return !!res;
}

export interface VarInfo {
    /** Final sparql variable name */
    varName: string,
    /** List of URIs that were used to generated the var */
    path: readonly string[],
}

interface ConstraintPayload {
    constraints: string[],
    varInfos: VarInfo[],
}

const uriSplitterRe = /[\/|#]+/;

function sanitizeSparqlVarName(candidateName: string) {
    return candidateName
        .split("")
        .map((ch) => isCharLegalForVarName(ch) ? ch : placeholderChar)
        .join("");
}

function formatVar(path: readonly string[], sliceIndex: number = -1) {
    // NOTE: Since empty name is not allowed, we need something like this
    if (path.length === 0) return "this";
    // NOTE: URI items are usually segmented by slashes and sometimes "#", so we just split assume
    // that the last item is the most accurate identifier
    const candidateName = path
        .map(
            (item) => item
                .split(uriSplitterRe)
                .slice(sliceIndex)
                .join(pathItemSegmentSeparatorChar)
        )
        .join(pathSeparatorChar);
    return sanitizeSparqlVarName(candidateName);
}

function formatCollidingVars(varInfos: VarInfo[]): VarInfo[] {
    const maxI = Math.max(
        ...varInfos.flatMap(
            (item) => item.path.map((pathItem) => pathItem.split(uriSplitterRe).length)
        )
    );

    for (let i = -1; i >= -maxI; i--) {
        const newCandidates = varInfos.map((item) => formatVar(item.path, i));

        // NOTE: No collisions, we can use the new candidates
        if ((new Set(newCandidates)).size === newCandidates.length) {
            return varInfos.map((props, i) => ({
                ...props,
                varName: newCandidates[i],
            }));
        }
    }

    // NOTE: If we fail (should only happen when there are two same paths), just add numbers and
    // call it a day.
    return varInfos.map(({ varName, ...rest }, i) => ({ varName: `${varName}${i}`, ...rest }));
}

/** Values that are actually used. Empty values are ignored, but the list is never empty. */
function valuesOf(values: readonly string[]): string[] {
    const nonEmpty = values.filter((it) => it !== "");
    return nonEmpty.length > 0 ? nonEmpty : [""];
}

/**
 * Path item that identifies a property. Union properties are identified by their alias when one is
 * provided, otherwise by their first name.
 */
function segmentOf({ names, alias }: PropertySelection): string {
    const values = valuesOf(names);
    if (values.length > 1 && alias) return alias;
    return values[0]!;
}

/** Joins alternatives so that at least one of them must match. */
function unionOf(alternatives: string[]): string {
    if (alternatives.length === 1) return alternatives[0]!;
    return alternatives.map((it) => `{ ${it} }`).join(" UNION ");
}

function formatVarInfo(path: readonly string[]): VarInfo {
    return {
        path,
        varName: formatVar(path),
    };
}

// NOTE: Made this helper function so that we can elegantly collect object properties.
function collectConstraints(
    varInfoMapping: HashMap.HashMap<readonly string[], VarInfo>,
    pathPrefix: string[],
    { rdfType, dataProps, objectProps }: ComplexPropertySelection,
    /** Whether every object property on the path to this selection is mandatory. */
    parentsMandatory: boolean,
): ConstraintPayload {
    function wrapOptional(constraint: string): string {
        return `OPTIONAL { ${constraint} }`;
    }

    function getByPath(path: readonly string[]): VarInfo {
        return varInfoMapping.pipe(
            HashMap.get(Data.array(path)),
            Option.getOrThrow,
        );
    }

    /**
     * Constraint for a prop. A prop is only required when it and all of its ancestors are
     * mandatory, otherwise requiring it would also drop solutions where an optional ancestor is
     * missing.
     */
    function propConstraint(
        thisVarName: string,
        prop: PropertySelection,
        varName: string,
    ): string {
        const constraint = unionOf(
            valuesOf(prop.names).map((name) => `?${thisVarName} <${name}> ?${varName}`)
        );
        return parentsMandatory && prop.mandatory ? `${constraint} .` : wrapOptional(constraint);
    }

    const thisVar = getByPath(pathPrefix);

    const dataVars = dataProps.map((prop) => {
        const varInfo = getByPath([...pathPrefix, segmentOf(prop)]);
        const constraint = propConstraint(thisVar.varName, prop, varInfo.varName);
        return { varInfo, constraint };
    });

    const objectVars: ConstraintPayload[] = objectProps.map((prop) => {
        const segment = segmentOf(prop);
        const varInfo = getByPath([...pathPrefix, segment]);
        const constraint = propConstraint(thisVar.varName, prop, varInfo.varName);
        const { constraints, varInfos } = collectConstraints(
            varInfoMapping,
            [...pathPrefix, segment],
            prop.selection,
            parentsMandatory && prop.mandatory,
        );
        return {
            constraints: [constraint, ...constraints],
            varInfos: [varInfo, ...varInfos],
        };
    })

    const types = valuesOf(rdfType.names);
    const miscConstraints: string[] = [
        // NOTE: type constraint should only be applied if at least one type is specified
        ...(types[0] !== "" ? [unionOf(
            types.map((typeName) => `?${thisVar.varName} a <${typeName}> .`)
        )] : []),
    ];

    return {
        constraints: [
            ...dataVars.map((item) => item.constraint),
            ...objectVars.flatMap((item) => item.constraints),
            ...miscConstraints,
        ],
        varInfos: [
            thisVar,
            ...dataVars.map((item) => item.varInfo),
            ...objectVars.flatMap((item) => item.varInfos),
        ],
    };
}

function collectVarNames(
    selection: ComplexPropertySelection,
): HashMap.HashMap<readonly string[], VarInfo> {
    function collectPaths(
        currentSelection: ComplexPropertySelection,
        pathPrefix: string[],
    ): string[][] {
        return [
            pathPrefix, // NOTE: this
            ...currentSelection.dataProps.map((it) => [...pathPrefix, segmentOf(it)]),
            ...currentSelection.objectProps.flatMap((it) => [
                [...pathPrefix, segmentOf(it)],
                ...collectPaths(it.selection, [...pathPrefix, segmentOf(it)]),
            ])
        ];
    }

    function adjustVarNames(currentVarNames: VarInfo[]): VarInfo[] {
        const grouped = Map.groupBy(currentVarNames, (it) => it.varName);
        return ([...grouped.values()]).flatMap((items) => {
            if (items.length <= 1) return items;
            return formatCollidingVars(items);
        });
    }

    function duplicatesExist(currentVarNames: VarInfo[]): boolean {
        return (new Set(currentVarNames.map((it) => it.varName))).size !== currentVarNames.length;
    }

    const possiblyDuplicatedPaths = collectPaths(selection, []);
    let currentVarInfos = HashSet.make(...possiblyDuplicatedPaths.map((path) => Data.array(path)))
        .pipe(HashSet.toValues)
        .map(formatVarInfo);

    while (duplicatesExist(currentVarInfos)) {
        currentVarInfos = adjustVarNames(currentVarInfos);
    }

    return HashMap.make(...currentVarInfos.map((it) => [Data.array(it.path), it] as const));
}

/**
 * Make a query that represents the passed selection.
 */
export function formatQuery(selection: ComplexPropertySelection): {
    query: string,
    varInfos: VarInfo[],
} {
    const collectedVarNames = collectVarNames(selection);

    const {
        constraints,
    } = collectConstraints(collectedVarNames, [], selection, true);

    const varInfos = collectedVarNames.pipe(HashMap.toValues);

    const indentation = "  ";

    const lines = [
        "SELECT * WHERE {",
        ...constraints.map((line) => `${indentation}${line}`),
        "}",
    ];

    const query = reorderOptional(lines.join("\n"));

    return { query, varInfos };
}
