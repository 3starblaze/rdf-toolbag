import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddIconButton, ItemCard, OrLabel, SectionHeader, SegmentedToggle } from "../components/primitives";
import { SuggestionInput } from "../components/SuggestionInput";
import type { SelectedProperty } from "../shared";
import { removeAt, replaceAt } from "../util";

/** Edits the path(s), alias and presence of one property. */
export function PropertyEditView({
    property,
    onPropertyChange,
}: {
    property: SelectedProperty,
    onPropertyChange: (newProperty: SelectedProperty) => void,
}) {
    const { alternatives } = property;
    const isUnion = alternatives.length > 1;

    function setAlternatives(newAlternatives: string[][]) {
        onPropertyChange({ ...property, alternatives: newAlternatives });
    }

    return (
        <div className="flex flex-col gap-4">
            <SectionHeader title="Path">
                <AddIconButton
                    label="Add alternative path"
                    onClick={() => setAlternatives([...alternatives, [""]])}
                />
            </SectionHeader>

            {/* NOTE: Index keys are intentional. Steps may not be unique and change while typing. */}
            {alternatives.map((steps, ai) => (
                <div key={ai} className="flex flex-col gap-2">
                    {ai > 0 && <OrLabel className="ml-1" />}
                    <ItemCard
                        title={isUnion ? `Alternative ${ai + 1}` : "Steps"}
                        actions={<>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 cursor-pointer px-2.5 text-[13px]"
                                aria-label="Add step"
                                title="Add step"
                                onClick={() => setAlternatives(replaceAt(alternatives, ai, [...steps, ""]))}
                            >
                                <Plus className="size-3.5" />
                                Step
                            </Button>
                            {isUnion && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-7 cursor-pointer"
                                    aria-label="Remove alternative"
                                    title="Remove alternative"
                                    onClick={() => setAlternatives(removeAt(alternatives, ai))}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            )}
                        </>}
                    >
                        <div className="flex flex-col gap-1">
                            {steps.map((step, si) => (
                                <div key={si} className="flex min-w-0 items-center gap-2">
                                    {si > 0 && (
                                        <span className="w-5 shrink-0 text-center text-sm font-medium text-gray-500">
                                            /
                                        </span>
                                    )}
                                    <div className="flex min-w-0 flex-1">
                                        <SuggestionInput
                                            value={step}
                                            onValueChange={(newStep) => setAlternatives(
                                                replaceAt(alternatives, ai, replaceAt(steps, si, newStep)),
                                            )}
                                            target={{
                                                kind: "propertyStep",
                                                propertyId: property.id,
                                                alternativeIndex: ai,
                                                stepIndex: si,
                                            }}
                                            placeholder="Enter property"
                                            ariaLabel={`Step ${si + 1}` + (isUnion ? ` of alternative ${ai + 1}` : "")}
                                        />
                                    </div>
                                    {steps.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="cursor-pointer"
                                            aria-label="Remove step"
                                            title="Remove step"
                                            onClick={() => setAlternatives(replaceAt(alternatives, ai, removeAt(steps, si)))}
                                        >
                                            -
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ItemCard>
                </div>
            ))}

            {isUnion && (
                <div className="flex flex-col gap-2">
                    <p className="m-0 font-medium">Union alias</p>
                    <Input
                        aria-label="Union alias"
                        placeholder="Union alias (optional)"
                        value={property.alias ?? ""}
                        onChange={(e) => onPropertyChange({ ...property, alias: e.target.value })}
                    />
                    <p className="m-0 text-muted-foreground">
                        Names the variable that holds whichever alternative matched.
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <p className="m-0 font-medium">Presence</p>
                <div>
                    <SegmentedToggle
                        ariaLabel="Presence"
                        size="default"
                        value={property.mandatory ? "mandatory" : "optional"}
                        onValueChange={(value) => onPropertyChange({ ...property, mandatory: value === "mandatory" })}
                        options={[
                            { value: "optional", label: "Optional" },
                            { value: "mandatory", label: "Mandatory" },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}
