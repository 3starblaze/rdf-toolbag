import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { constraintDefinitions, constraintSubTypes, type ConstraintSubType } from "../constraints";
import { SectionHeader } from "../components/primitives";
import type { ConstraintNode, GroupOperator } from "../shared";
import { ConstraintTree } from "./ConstraintTree";

/** What the add menu creates. */
export type AddChoice =
    | { kind: "constraint", subType: ConstraintSubType }
    | { kind: "group", operator: GroupOperator };

const groupChoices: readonly { operator: GroupOperator, label: string, description: string }[] = [
    { operator: "and", label: "AND group", description: "All constraints inside must hold." },
    { operator: "or", label: "OR group", description: "At least one constraint inside must hold." },
];

/** List of constraints (the top level or the children of a group) with its add menu. */
export function ConstraintsSection({
    title,
    titleHint,
    emptyText,
    nodes,
    containerId,
    onAdd,
    onOpen,
    onMove,
}: {
    title: string,
    titleHint: string,
    emptyText: string,
    nodes: readonly ConstraintNode[],
    /** Group whose children are shown, `null` for the top level. */
    containerId: string | null,
    onAdd: (choice: AddChoice) => void,
    onOpen: (node: ConstraintNode) => void,
    onMove: (id: string, parentId: string | null) => void,
}) {
    return (
        <section className="flex flex-col gap-2">
            <SectionHeader title={<span title={titleHint}>{title}</span>}>
                <AddConstraintMenu onAdd={onAdd} />
            </SectionHeader>
            {nodes.length === 0 && <p className="m-0 text-muted-foreground">{emptyText}</p>}
            <ConstraintTree nodes={nodes} containerId={containerId} onOpen={onOpen} onMove={onMove} />
        </section>
    );
}

function AddConstraintMenu({ onAdd }: { onAdd: (choice: AddChoice) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7 cursor-pointer"
                    aria-label="Add constraint or group"
                    title="Add constraint or group"
                >
                    <Plus className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-75" aria-label="Constraint kinds">
                {constraintSubTypes.map((subType) => {
                    const definition = constraintDefinitions[subType];
                    return (
                        <MenuChoice
                            key={subType}
                            label={definition.label}
                            description={definition.description}
                            onSelect={() => onAdd({ kind: "constraint", subType })}
                        />
                    );
                })}
                <DropdownMenuSeparator />
                {groupChoices.map(({ operator, label, description }) => (
                    <MenuChoice
                        key={operator}
                        label={label}
                        description={description}
                        onSelect={() => onAdd({ kind: "group", operator })}
                    />
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function MenuChoice({ label, description, onSelect }: { label: string, description: string, onSelect: () => void }) {
    return (
        <DropdownMenuItem className="cursor-pointer flex-col items-start gap-0.5" onSelect={onSelect}>
            <span className="font-medium">{label}</span>
            <span className="text-[13px] text-muted-foreground">{description}</span>
        </DropdownMenuItem>
    );
}
