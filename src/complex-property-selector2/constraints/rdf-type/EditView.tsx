import { ArgEditor } from "../common/ArgEditor";
import type { ConstraintEditViewProps } from "../types";
import type { RdfTypeConstraint } from "./types";

export default function RdfTypeEditView({
    constraint,
    onConstraintChange,
}: ConstraintEditViewProps<RdfTypeConstraint>) {
    return (
        <>
            <ArgEditor
                title="Target item"
                arg={constraint.target}
                onArgChange={(target) => onConstraintChange({ ...constraint, target })}
                suggestionTarget={{
                    kind: "constraintArg",
                    constraintId: constraint.id,
                    subType: constraint.subType,
                    arg: "target",
                }}
                literalPlaceholder="Enter property or URI"
            />
            <ArgEditor
                title="Expected type"
                arg={constraint.value}
                onArgChange={(value) => onConstraintChange({ ...constraint, value })}
                suggestionTarget={{
                    kind: "constraintArg",
                    constraintId: constraint.id,
                    subType: constraint.subType,
                    arg: "value",
                }}
                literalPlaceholder="Enter type"
            />
        </>
    );
}
