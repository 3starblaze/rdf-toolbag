import { Brackets } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { allGroups, isGroup, locateNode, selfAndDescendantIds } from "../constraint-tree";
import { Hint, ItemCard, SegmentedToggle } from "../components/primitives";
import { groupName } from "../node-text";
import { useSelectorContext } from "../selector-context";
import type { ConstraintNode, GroupOperator } from "../shared";

const TOP_LEVEL_KEY = "top-level";
const groupKey = (id: string) => `group:${id}`;

/** NOT is a flag on any constraint or group. */
export function NegationEditor({
    node,
    onNegatedChange,
}: {
    node: ConstraintNode,
    onNegatedChange: (negated: boolean) => void,
}) {
    return (
        <ItemCard
            title="Negation"
            actions={
                <SegmentedToggle
                    ariaLabel="Negation"
                    value={node.negated ? "not" : "normal"}
                    onValueChange={(value) => onNegatedChange(value === "not")}
                    options={[
                        { value: "normal", label: "Normal" },
                        { value: "not", label: "NOT" },
                    ]}
                />
            }
        >
            <Hint>
                {isGroup(node)
                    ? "NOT inverts the whole group. It is shown to the left of the group."
                    : "NOT inverts this constraint. It is shown to its left."}
            </Hint>
        </ItemCard>
    );
}

export function OperatorEditor({
    operator,
    onOperatorChange,
}: {
    operator: GroupOperator,
    onOperatorChange: (operator: GroupOperator) => void,
}) {
    return (
        <ItemCard
            title="Operator"
            actions={
                <SegmentedToggle
                    ariaLabel="Operator"
                    value={operator}
                    onValueChange={onOperatorChange}
                    options={[
                        { value: "and", label: "AND" },
                        { value: "or", label: "OR" },
                    ]}
                />
            }
        >
            <Hint>
                {operator === "and" ? "Every constraint inside must hold." : "Any one constraint inside is enough."}
            </Hint>
        </ItemCard>
    );
}

/** Which group holds the node: the top level (implicit AND) or one of the groups. */
export function LocationEditor({
    node,
    onMove,
}: {
    node: ConstraintNode,
    onMove: (parentId: string | null) => void,
}) {
    const { selection, labelOf } = useSelectorContext();
    const textCtx = { selection, labelOf };
    const parent = locateNode(selection.constraints, node.id)?.parent ?? null;
    const banned = selfAndDescendantIds(node);
    const groups = allGroups(selection.constraints).filter((group) => !banned.includes(group.id));

    return (
        <ItemCard title="Located in">
            <Select
                value={parent ? groupKey(parent.id) : TOP_LEVEL_KEY}
                onValueChange={(key) => onMove(key === TOP_LEVEL_KEY ? null : key.slice(groupKey("").length))}
            >
                <SelectTrigger
                    aria-label="Group that contains this item"
                    className="w-full cursor-pointer bg-neutral-100 dark:bg-neutral-800"
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <Brackets aria-hidden="true" className="size-3.5 shrink-0" />
                        <SelectValue />
                    </span>
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                    <SelectItem value={TOP_LEVEL_KEY} title="Top level: constraints here must all hold (AND)">
                        Top level
                    </SelectItem>
                    {groups.map((group) => {
                        const name = groupName(group, textCtx, true);
                        return (
                            <SelectItem key={group.id} value={groupKey(group.id)} title={name}>
                                <span className="truncate">{name}</span>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
            <Hint>
                You can also drag a constraint onto a group in the list. Top-level constraints must all hold (AND).
            </Hint>
        </ItemCard>
    );
}
