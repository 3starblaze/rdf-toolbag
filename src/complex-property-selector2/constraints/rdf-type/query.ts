import type { ConstraintQueryContext } from "../types";
import type { RdfTypeConstraint } from "./types";

/** `?target a ?value .` Literal arguments are IRIs. */
export function rdfTypeQueryFragment(
    constraint: RdfTypeConstraint,
    { term }: ConstraintQueryContext,
): string | null {
    const target = term(constraint.target, "iri");
    const value = term(constraint.value, "iri");
    if (target === null || value === null) return null;
    return `${target} a ${value} .`;
}
