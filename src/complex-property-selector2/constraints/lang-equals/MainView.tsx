import { BinaryConstraintSummary } from "../common/ArgChip";
import type { ConstraintMainViewProps } from "../types";
import { LANG_EQUALS_LABEL, LANG_EQUALS_OPERATOR, type LangEqualsConstraint } from "./types";

export default function LangEqualsMainView({ constraint }: ConstraintMainViewProps<LangEqualsConstraint>) {
    return (
        <BinaryConstraintSummary
            label={LANG_EQUALS_LABEL}
            operator={LANG_EQUALS_OPERATOR}
            target={constraint.target}
            value={constraint.value}
        />
    );
}
