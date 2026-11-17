import { BinaryConstraintSummary } from "../common/ArgChip";
import type { ConstraintMainViewProps } from "../types";
import { LANG_MATCHES_LABEL, LANG_MATCHES_OPERATOR, type LangMatchesConstraint } from "./types";

export default function LangMatchesMainView({ constraint }: ConstraintMainViewProps<LangMatchesConstraint>) {
    return (
        <BinaryConstraintSummary
            label={LANG_MATCHES_LABEL}
            operator={LANG_MATCHES_OPERATOR}
            target={constraint.target}
            value={constraint.value}
        />
    );
}
