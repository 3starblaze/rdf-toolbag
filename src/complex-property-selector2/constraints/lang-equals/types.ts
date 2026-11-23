import type { BinaryConstraint } from "../common/binary";

/** The language tag of the target item equals the expected language tag. */
export interface LangEqualsConstraint extends BinaryConstraint {
    subType: "langEquals",
}

export const LANG_EQUALS_LABEL = "LangEquals";
export const LANG_EQUALS_OPERATOR = "equals";
