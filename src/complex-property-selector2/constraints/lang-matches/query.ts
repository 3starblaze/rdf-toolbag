import type { ConstraintQueryContext } from "../types";
import type { LangMatchesConstraint } from "./types";

/**
 * `LANGMATCHES(LANG(?target), ?value)`. Literal arguments are string literals, e.g. `"en"`
 * (which also matches `en-US`) or `"*"` (any non-empty language tag).
 */
export function langMatchesExpression(
    constraint: LangMatchesConstraint,
    { term }: ConstraintQueryContext,
): string | null {
    const target = term(constraint.target, "string");
    const value = term(constraint.value, "string");
    if (target === null || value === null) return null;
    return `LANGMATCHES(LANG(${target}), ${value})`;
}
