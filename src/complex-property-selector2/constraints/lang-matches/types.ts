import type { BinaryConstraint } from "../common/binary";

/** The language tag of the target item matches the expected language range. */
export interface LangMatchesConstraint extends BinaryConstraint {
    subType: "langMatches",
}

export const LANG_MATCHES_LABEL = "LangMatches";
export const LANG_MATCHES_OPERATOR = "matches";
