import { binaryConstraintText, defaultBinaryArgs } from "../common/binary";
import type { ConstraintDefinition } from "../types";
import EditView from "./EditView";
import MainView from "./MainView";
import { langMatchesQueryFragment } from "./query";
import { LANG_MATCHES_LABEL, LANG_MATCHES_OPERATOR, type LangMatchesConstraint } from "./types";

export type { LangMatchesConstraint } from "./types";

export const langMatchesConstraint: ConstraintDefinition<LangMatchesConstraint> = {
    subType: "langMatches",
    label: LANG_MATCHES_LABEL,
    description: "Language tag of the target item matches the expected language range.",
    create: ({ id, selection }) => ({ subType: "langMatches", id, ...defaultBinaryArgs(selection) }),
    ...binaryConstraintText<LangMatchesConstraint>({
        label: LANG_MATCHES_LABEL,
        operator: LANG_MATCHES_OPERATOR,
    }),
    queryFragment: langMatchesQueryFragment,
    MainView,
    EditView,
};
