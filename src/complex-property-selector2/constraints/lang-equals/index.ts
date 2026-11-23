import { binaryConstraintText, defaultBinaryArgs } from "../common/binary";
import type { ConstraintDefinition } from "../types";
import EditView from "./EditView";
import MainView from "./MainView";
import { langEqualsExpression } from "./query";
import { LANG_EQUALS_LABEL, LANG_EQUALS_OPERATOR, type LangEqualsConstraint } from "./types";

export type { LangEqualsConstraint } from "./types";

export const langEqualsConstraint: ConstraintDefinition<LangEqualsConstraint> = {
    subType: "langEquals",
    label: LANG_EQUALS_LABEL,
    description: "Language tag of the target item equals the expected language.",
    create: ({ id, selection }) => ({ subType: "langEquals", id, ...defaultBinaryArgs(selection) }),
    ...binaryConstraintText<LangEqualsConstraint>({
        label: LANG_EQUALS_LABEL,
        operator: LANG_EQUALS_OPERATOR,
    }),
    expression: langEqualsExpression,
    MainView,
    EditView,
};
