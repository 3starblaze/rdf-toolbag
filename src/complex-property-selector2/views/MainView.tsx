import { Asterisk, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { constraintDefinitions, constraintSubTypes, definitionOf, type Constraint, type ConstraintSubType } from "../constraints";
import { AddIconButton, RowButton, SectionHeader } from "../components/primitives";
import { useSelectorContext } from "../selector-context";
import type { SelectedProperty } from "../shared";
import { isPropertyUnset, propertyFullText, propertyShortText } from "../util";

/** Lists the selected properties and constraints. Each opens its edit view when clicked. */
export function MainView({
    onAddProperty,
    onAddConstraint,
    onOpenProperty,
    onOpenConstraint,
}: {
    onAddProperty: () => void,
    onAddConstraint: (subType: ConstraintSubType) => void,
    onOpenProperty: (id: string) => void,
    onOpenConstraint: (id: string) => void,
}) {
    const { selection } = useSelectorContext();

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
                <SectionHeader title="Properties">
                    <AddIconButton label="Add property" onClick={onAddProperty} />
                </SectionHeader>
                {selection.properties.length === 0 && (
                    <p className="m-0 text-muted-foreground">No properties yet.</p>
                )}
                <div className="flex flex-col gap-1">
                    {selection.properties.map((property) => (
                        <PropertyRow
                            key={property.id}
                            property={property}
                            onOpen={() => onOpenProperty(property.id)}
                        />
                    ))}
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeader title="Constraints">
                    <AddConstraintMenu onAddConstraint={onAddConstraint} />
                </SectionHeader>
                {selection.constraints.length === 0 && (
                    <p className="m-0 text-muted-foreground">No constraints yet.</p>
                )}
                <div className="flex flex-col gap-1">
                    {selection.constraints.map((constraint) => (
                        <ConstraintRow
                            key={constraint.id}
                            constraint={constraint}
                            onOpen={() => onOpenConstraint(constraint.id)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

function PropertyRow({ property, onOpen }: { property: SelectedProperty, onOpen: () => void }) {
    const { labelOf } = useSelectorContext();
    const unset = isPropertyUnset(property);
    const full = propertyFullText(property, labelOf);
    const extraAlternatives = property.alternatives.length - 1;

    return (
        <RowButton
            title={full}
            aria-label={`Edit property ${unset ? "(new)" : full}`}
            onClick={onOpen}
        >
            <span className={unset ? "min-w-0 flex-1 truncate text-muted-foreground" : "min-w-0 flex-1 truncate"}>
                {propertyShortText(property, labelOf, 52)}
            </span>
            {extraAlternatives > 0 && (
                <Badge
                    variant="secondary"
                    className="rounded-md px-1.5 text-neutral-600 dark:text-neutral-400"
                    title={`${extraAlternatives} more alternative${extraAlternatives === 1 ? "" : "s"}`}
                >
                    +{extraAlternatives}
                </Badge>
            )}
            {property.mandatory && (
                <span title="Mandatory" className="flex shrink-0 text-neutral-600 dark:text-neutral-400">
                    <Asterisk role="img" aria-label="Mandatory" className="size-4" />
                </span>
            )}
        </RowButton>
    );
}

function ConstraintRow({ constraint, onOpen }: { constraint: Constraint, onOpen: () => void }) {
    const { selection, labelOf } = useSelectorContext();
    const definition = definitionOf(constraint);
    const full = definition.describe(constraint, { selection, labelOf });

    return (
        <RowButton title={full} aria-label={`Edit constraint ${full}`} onClick={onOpen}>
            <definition.MainView constraint={constraint} />
        </RowButton>
    );
}

function AddConstraintMenu({
    onAddConstraint,
}: {
    onAddConstraint: (subType: ConstraintSubType) => void,
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7 cursor-pointer"
                    aria-label="Add constraint"
                    title="Add constraint"
                >
                    <Plus className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-75" aria-label="Constraint kinds">
                {constraintSubTypes.map((subType) => {
                    const definition = constraintDefinitions[subType];
                    return (
                        <DropdownMenuItem
                            key={subType}
                            className="cursor-pointer flex-col items-start gap-0.5"
                            onSelect={() => onAddConstraint(subType)}
                        >
                            <span className="font-medium">{definition.label}</span>
                            <span className="text-[13px] text-muted-foreground">
                                {definition.description}
                            </span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
