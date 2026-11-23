import type { ConstraintArg } from "../../shared";
import type { ConstraintQueryContext } from "../types";
import type { RdfTypeConstraint } from "./types";

/**
 * `EXISTS { ?target a ?value }`. Literal arguments are IRIs.
 *
 * NOTE: A property variable may be unbound (optional properties). Inside EXISTS an unbound
 * variable would match anything, so each property argument is guarded with BOUND.
 */
export function rdfTypeExpression(
    constraint: RdfTypeConstraint,
    { term }: ConstraintQueryContext,
): string | null {
    const target = term(constraint.target, "iri");
    const value = term(constraint.value, "iri");
    if (target === null || value === null) return null;

    const guards = ([[constraint.target, target], [constraint.value, value]] as [ConstraintArg, string][])
        .filter(([arg]) => arg.kind === "property")
        .map(([, it]) => `BOUND(${it})`);
    return [...new Set(guards), `EXISTS { ${target} a ${value} }`].join(" && ");
}
