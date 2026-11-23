import { Asterisk } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddIconButton, RowButton, SectionHeader } from "../components/primitives";
import { useSelectorContext } from "../selector-context";
import type { ConstraintNode, SelectedProperty } from "../shared";
import { isPropertyUnset, propertyFullText, propertyShortText } from "../util";
import { ConstraintsSection, type AddChoice } from "./ConstraintsSection";

/** Lists the selected properties and constraints. Each opens its edit view when clicked. */
export function MainView({
    onAddProperty,
    onAddConstraint,
    onOpenProperty,
    onOpenConstraint,
    onMoveConstraint,
}: {
    onAddProperty: () => void,
    onAddConstraint: (choice: AddChoice) => void,
    onOpenProperty: (id: string) => void,
    onOpenConstraint: (node: ConstraintNode) => void,
    onMoveConstraint: (id: string, parentId: string | null) => void,
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

            <ConstraintsSection
                title="Constraints"
                titleHint="Top-level constraints must all hold (AND)"
                emptyText="No constraints yet."
                nodes={selection.constraints}
                containerId={null}
                onAdd={onAddConstraint}
                onOpen={onOpenConstraint}
                onMove={onMoveConstraint}
            />
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
