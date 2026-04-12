import type { ComplexPropertySelection } from "@/components/complex_property_selector";
import { Match } from "effect";

// NOTE: Made this helper function so that we can elegantly collect object properties.
function collectConstraints(
    thisPrefix: string,
    { rdfType, dataProps, objectProps }: ComplexPropertySelection,
): string[] {
    const dataPropConstraints = dataProps.map(
        ({ name }, i) => `?${thisPrefix} <${name}> ?${thisPrefix}_d_${i} .`,
    );

    const objectPropConstraints = objectProps.flatMap(
        ({ name, selection }, i) => [
            `?${thisPrefix} <${name}> ?${thisPrefix}_o_${i} .`,
            ...collectConstraints(`${thisPrefix}_o_${i}`, selection),
        ],
    );

    const miscConstraints: string[] = [
        // NOTE: rdfType constraint should only be applied if the string is not empty
        ...(rdfType !== "" ?  [`?${thisPrefix} a <${rdfType}> .`] : []),
    ];

    return [
        ...miscConstraints,
        ...dataPropConstraints,
        ...objectPropConstraints,
    ];
}

/**
 * Make a query that represents the passed selection.
 */
export function formatQuery(selection: ComplexPropertySelection) {
    const constraints = collectConstraints("this", selection);

    const indentation = "  ";

    const lines = [
        "SELECT * WHERE {",
        ...constraints.map((line) => `${indentation}${line}`),
        "}",
    ];

    const fmt = lines.join("\n");

    return fmt;
}

/**
 * Turn generated variable name into human-readable label.
 *
 * Null is returned when varName does not match selection.
 *
 * @param varName variable without the leading "?" symbol
 * @param selection selection that is used for reference
 */
export function demangleVarName(
    varName: string,
    selection: ComplexPropertySelection,
): string | null {
    /**
     *
     * @param parts fragments from variable name
     * @param labelParts list of already collected label fragments that will be combined
     */
    function resolve(
        parts: string[],
        labelParts: string[],
        currentSelection: ComplexPropertySelection,
    ): string[] | null {
        return Match.value(parts.slice(0, 2)).pipe(
            Match.when(["d", Match.any], ([_, indexString]) => {
                const maybeLabelPart = currentSelection.dataProps[Number(indexString)]?.name;
                return maybeLabelPart ? [...labelParts, maybeLabelPart] : null;
            }),
            Match.when(["o", Match.any], ([_, indexString]) => {
                const maybeProp = currentSelection.objectProps[Number(indexString)];
                if (!maybeProp) return null;
                return resolve(
                    parts.slice(2),
                    [...labelParts, maybeProp.name],
                    maybeProp.selection,
                );
            }),
            // NOTE: We are finished and we can return what we have collected
            Match.when((val) => val.length === 0, () => labelParts),
            Match.orElse(() => null),
        );
    }

    const [thisPart, ...restParts] = varName.split("_");
    if (thisPart !== "this") return null;

    const labelParts = resolve(restParts, ["this"], selection);
    return labelParts ? labelParts.join(" > ") : null;
}
