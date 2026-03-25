import type { ComplexPropertySelection } from "@/components/complex_property_selector";

// NOTE: Made this helper function so that we can elegantly collect object properties.
function collectConstraints(
    thisPrefix: string,
    { rdfType, dataProps, objectProps }: ComplexPropertySelection,
): string[] {
    const typeConstraint = `?${thisPrefix} a <${rdfType}> .`;
    const dataPropConstraints = dataProps.map(
        ({ name }, i) => `?${thisPrefix} <${name}> ?${thisPrefix}_d_${i} .`,
    );

    const objectPropConstraints = objectProps.flatMap(
        ({ name, selection }, i) => [
            `${thisPrefix} <${name}> ${thisPrefix}_o_${i}`,
            ...collectConstraints(`${thisPrefix}_o_${i}`, selection),
        ],
    );

    return [
        typeConstraint,
        ...dataPropConstraints,
        ...objectPropConstraints,
    ];
}

/**
 * Make a query that represents the passed selection.
 */
export function formatQuery(selection: ComplexPropertySelection) {
    const constraints = collectConstraints("this", selection);

    const fmt = `SELECT * WHERE { ${constraints.join("\n")} }`;

    return fmt;
}
