import { Quote, Route } from "lucide-react";
import { InputGroupAddon } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint, ItemCard, SegmentedToggle } from "../../components/primitives";
import { SuggestionInput } from "../../components/SuggestionInput";
import { useSelectorContext } from "../../selector-context";
import type { ConstraintArg, SuggestionTarget } from "../../shared";
import { findProperty, propertyFullText, propertyShortText } from "../../util";

const SUBJECT_KEY = "subject";
const propertyKey = (id: string) => `property:${id}`;

type ArgMode = "property" | "literal";

/**
 * Editor of one constraint argument: choose whether it refers to a property (or the subject) or
 * holds a literal value, then the value itself.
 */
export function ArgEditor({
    title,
    arg,
    onArgChange,
    suggestionTarget,
    literalPlaceholder,
}: {
    title: string,
    arg: ConstraintArg,
    onArgChange: (newArg: ConstraintArg) => void,
    /** Target of suggestions for the literal value. */
    suggestionTarget: SuggestionTarget,
    literalPlaceholder?: string,
}) {
    const mode: ArgMode = arg.kind === "literal" ? "literal" : "property";

    function setMode(newMode: ArgMode) {
        if (newMode === mode) return;
        onArgChange(newMode === "literal"
            ? { kind: "literal", value: "" }
            : { kind: "subject" });
    }

    return (
        <ItemCard
            title={title}
            actions={
                <SegmentedToggle
                    ariaLabel={`${title}: kind of value`}
                    value={mode}
                    onValueChange={setMode}
                    options={[
                        { value: "property", label: <><Route aria-hidden="true" />Property</> },
                        { value: "literal", label: <><Quote aria-hidden="true" />Literal</> },
                    ]}
                />
            }
        >
            {arg.kind === "literal" ? (
                <>
                    <SuggestionInput
                        value={arg.value}
                        onValueChange={(value) => onArgChange({ kind: "literal", value })}
                        target={suggestionTarget}
                        placeholder={literalPlaceholder}
                        ariaLabel={`${title}: literal value`}
                        startAddon={
                            <InputGroupAddon align="inline-start" title="Literal value">
                                <Quote aria-hidden="true" className="size-3.5 text-cyan-800 dark:text-cyan-300" />
                            </InputGroupAddon>
                        }
                    />
                    <Hint>A fixed value, used exactly as written.</Hint>
                </>
            ) : (
                <>
                    <PropertyArgSelect title={title} arg={arg} onArgChange={onArgChange} />
                    <Hint>Refers to a selected property. Its value is looked up when the query runs.</Hint>
                </>
            )}
        </ItemCard>
    );
}

function PropertyArgSelect({
    title,
    arg,
    onArgChange,
}: {
    title: string,
    arg: Exclude<ConstraintArg, { kind: "literal" }>,
    onArgChange: (newArg: ConstraintArg) => void,
}) {
    const { selection, labelOf } = useSelectorContext();

    const selectedKey = arg.kind === "subject"
        ? SUBJECT_KEY
        : findProperty(selection, arg.propertyId) ? propertyKey(arg.propertyId) : "";

    return (
        <Select
            value={selectedKey}
            onValueChange={(key) => {
                if (key === SUBJECT_KEY) {
                    onArgChange({ kind: "subject" });
                } else {
                    onArgChange({ kind: "property", propertyId: key.slice(propertyKey("").length) });
                }
            }}
        >
            <SelectTrigger
                aria-label={`${title}: property`}
                className="w-full cursor-pointer bg-neutral-100 dark:bg-neutral-800"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <Route aria-hidden="true" className="size-3.5 shrink-0" />
                    <SelectValue placeholder="(removed)" />
                </span>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
                <SelectItem value={SUBJECT_KEY} title="Subject: the item being selected">
                    Subject
                </SelectItem>
                {selection.properties.map((property) => (
                    <SelectItem
                        key={property.id}
                        value={propertyKey(property.id)}
                        title={propertyFullText(property, labelOf)}
                    >
                        <span className="truncate">{propertyShortText(property, labelOf, 60)}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
