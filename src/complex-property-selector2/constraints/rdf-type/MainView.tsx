import { BinaryConstraintSummary } from "../common/ArgChip";
import type { ConstraintMainViewProps } from "../types";
import { RDF_TYPE_LABEL, RDF_TYPE_OPERATOR, type RdfTypeConstraint } from "./types";

export default function RdfTypeMainView({ constraint }: ConstraintMainViewProps<RdfTypeConstraint>) {
    return (
        <BinaryConstraintSummary
            label={RDF_TYPE_LABEL}
            operator={RDF_TYPE_OPERATOR}
            target={constraint.target}
            value={constraint.value}
        />
    );
}
