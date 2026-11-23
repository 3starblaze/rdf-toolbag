import type { ConstraintQueryContext } from "../types";
import type { LangEqualsConstraint } from "./types";

/** `LANG(?target) = ?value`. Literal arguments are string literals, e.g. `"en"`. */
export function langEqualsExpression(
    constraint: LangEqualsConstraint,
    { term }: ConstraintQueryContext,
): string | null {
    const target = term(constraint.target, "string");
    const value = term(constraint.value, "string");
    if (target === null || value === null) return null;
    return `LANG(${target}) = ${value}`;
}
