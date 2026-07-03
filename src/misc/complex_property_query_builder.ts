import type { ComplexPropertySelection } from "@/components/complex_property_selector";

export interface VarInfo {
    /** Final sparql variable name */
    varName: string,
    /** List of URIs that were used to generated the var */
    path: string[],
}

interface ConstraintPayload {
    constraints: string[],
    varInfos: VarInfo[],
}

function formatVar(path: string[]) {
    // NOTE: Since empty name is not allowed, we need something like this
    if (path.length === 0) return "this";
    // NOTE: URI items are usually segmented by slashes and sometimes "#", so we just split assume
    // that the last item is the most accurate identifier
    return path.map((item) => item.split(/[\/|#]+/).at(-1)).join("__");
}

function formatVarInfo(path: string[]): VarInfo {
    return {
        path,
        varName: formatVar(path),
    };
}

// NOTE: Made this helper function so that we can elegantly collect object properties.
function collectConstraints(
    pathPrefix: string[],
    { rdfType, dataProps, objectProps }: ComplexPropertySelection,
): ConstraintPayload {
    function wrapOptional(constraint: string): string {
        return `OPTIONAL { ${constraint} }`;
    }

    const thisVar = formatVarInfo(pathPrefix);

    const dataVars = dataProps.map(({ name }) => {
        const varInfo = formatVarInfo([...pathPrefix, name]);
        const constraint = wrapOptional(`?${thisVar.varName} <${name}> ?${varInfo.varName}`);
        return { varInfo, constraint };
    });

    const objectVars: ConstraintPayload[] = objectProps.map(({ name, selection }) => {
        const varInfo = formatVarInfo([...pathPrefix, name]);
        const constraint = wrapOptional(`?${thisVar.varName} <${name}> ?${varInfo.varName}`);
        const { constraints, varInfos } = collectConstraints([...pathPrefix, name], selection);
        return {
            constraints: [constraint, ...constraints],
            varInfos: [varInfo, ...varInfos],
        };
    })

    const miscConstraints: string[] = [
        // NOTE: rdfType constraint should only be applied if the string is not empty
        ...(rdfType !== "" ?  [`?${thisVar.varName} a <${rdfType}> .`] : []),
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

/**
 * Make a query that represents the passed selection.
 */
export function formatQuery(selection: ComplexPropertySelection): {
    query: string,
    varInfos: VarInfo[],
} {
    const { constraints, varInfos: initialVarInfos } = collectConstraints([], selection);

    // NOTE: Drop duplicates by using varName as key
    const varInfosMap = new Map(initialVarInfos.map((varInfo) => [varInfo.varName, varInfo]));
    const varInfos = [...varInfosMap.values()];

    const indentation = "  ";

    const lines = [
        "SELECT * WHERE {",
        ...constraints.map((line) => `${indentation}${line}`),
        "}",
    ];

    const query = lines.join("\n");

    return { query, varInfos };
}
