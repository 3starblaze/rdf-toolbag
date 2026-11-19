/** Characters that may not appear inside a SPARQL IRIREF (besides control characters and space). */
// eslint-disable-next-line no-control-regex -- control characters are exactly what is matched
const iriForbiddenRe = /[\u0000- <>"{}|^`\\]/gu;

/**
 * Format a value as a SPARQL IRI. Characters that are not allowed in an IRI are percent-encoded so
 * that the value cannot break out of the `<...>` term.
 */
export function formatIri(value: string): string {
    const escaped = value.replace(
        iriForbiddenRe,
        (ch) => [...new TextEncoder().encode(ch)]
            .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`)
            .join(""),
    );
    return `<${escaped}>`;
}

const stringEscapes: Record<string, string> = {
    "\\": "\\\\",
    "\"": "\\\"",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
    "\f": "\\f",
};

/** Format a value as a SPARQL string literal. */
export function formatStringLiteral(value: string): string {
    return `"${value.replace(/[\\"\n\r\t\b\f]/g, (ch) => stringEscapes[ch]!)}"`;
}

export function formatVariable(varName: string): string {
    return `?${varName}`;
}
