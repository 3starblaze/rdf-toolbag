import type { ComplexPropertySelection, ConstraintArg, SelectedProperty } from "./shared";

/** Maps a value (usually a URI) to a human readable label. */
export type LabelOf = (value: string) => string;

export function makeDefaultSelection(): ComplexPropertySelection {
    return { properties: [], constraints: [] };
}

/**
 * Creates an id of the form `<prefix><n>` that is not in `existingIds`. Ids are never reused while
 * a higher one exists, so a removed id is not immediately handed out again.
 */
export function makeId(prefix: string, existingIds: readonly string[]): string {
    let max = 0;
    for (const id of existingIds) {
        if (!id.startsWith(prefix)) continue;
        const n = Number(id.slice(prefix.length));
        if (Number.isInteger(n) && n > max) max = n;
    }
    return `${prefix}${max + 1}`;
}

export function replaceAt<T>(items: readonly T[], i: number, item: T): T[] {
    return [...items.slice(0, i), item, ...items.slice(i + 1)];
}

export function removeAt<T>(items: readonly T[], i: number): T[] {
    return [...items.slice(0, i), ...items.slice(i + 1)];
}

export function findProperty(
    selection: ComplexPropertySelection,
    id: string,
): SelectedProperty | undefined {
    return selection.properties.find((p) => p.id === id);
}

/** Whether no step of any alternative has been filled in yet. */
export function isPropertyUnset(property: SelectedProperty): boolean {
    return property.alternatives.every((steps) => steps.every((step) => !step));
}

/** Shorten a single term: keep its tail when it has a path or fragment, else cut the end. */
export function shortTerm(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = Math.max(text.lastIndexOf("/"), text.lastIndexOf("#"));
    if (cut >= 0 && cut < text.length - 1) {
        const tail = "…/" + text.slice(cut + 1);
        if (tail.length <= max) return tail;
    }
    return text.slice(0, Math.max(1, max - 1)) + "…";
}

/** Shorten a path of steps: keep the first and last step, then only the last, then cut. */
export function shortPath(segments: readonly string[], budget: number): string {
    const full = segments.join(" / ");
    if (full.length <= budget) return full;
    const last = segments[segments.length - 1]!;
    if (segments.length > 2) {
        const short = `${segments[0]} / … / ${last}`;
        if (short.length <= budget) return short;
    }
    if (segments.length > 1) {
        const short = `… / ${last}`;
        if (short.length <= budget) return short;
        return "… / " + shortTerm(last, Math.max(4, budget - 4));
    }
    return shortTerm(segments[0] ?? "", budget);
}

export function stepLabels(steps: readonly string[], labelOf: LabelOf): string[] {
    return steps.map((step) => (step ? labelOf(step) : "?"));
}

/** Short text of a property's first alternative. */
export function propertyShortText(
    property: SelectedProperty,
    labelOf: LabelOf,
    budget: number,
): string {
    if (isPropertyUnset(property)) return "New property";
    return shortPath(stepLabels(property.alternatives[0] ?? [], labelOf), budget);
}

/** Full text of a property, listing all alternatives. */
export function propertyFullText(property: SelectedProperty, labelOf: LabelOf): string {
    if (isPropertyUnset(property)) return "New property";
    return property.alternatives
        .map((steps) => stepLabels(steps, labelOf).join(" / "))
        .join("  |  ");
}

export interface ArgText {
    /** Whether the argument is a literal (as opposed to the subject or a property). */
    isLiteral: boolean,
    /** Text shortened to the budget. */
    text: string,
    /** Full text, e.g. for hover. */
    full: string,
}

export function argText(
    arg: ConstraintArg,
    selection: ComplexPropertySelection,
    labelOf: LabelOf,
    budget: number,
): ArgText {
    switch (arg.kind) {
        case "subject":
            return { isLiteral: false, text: "Subject", full: "Subject: the item being selected" };
        case "property": {
            const property = findProperty(selection, arg.propertyId);
            if (!property) {
                return {
                    isLiteral: false,
                    text: "(removed)",
                    full: "The referenced property was removed",
                };
            }
            return {
                isLiteral: false,
                text: propertyShortText(property, labelOf, budget),
                full: propertyFullText(property, labelOf),
            };
        }
        case "literal": {
            if (!arg.value) {
                return { isLiteral: true, text: "(not set)", full: "Literal value not set" };
            }
            const label = labelOf(arg.value);
            return {
                isLiteral: true,
                text: `"${shortTerm(label, Math.max(4, budget - 2))}"`,
                full: `"${label}"` + (label !== arg.value ? ` = ${arg.value}` : ""),
            };
        }
    }
}

/** Ids of the properties that the arguments refer to. */
export function argPropertyIds(args: readonly ConstraintArg[]): string[] {
    return args.flatMap((arg) => (arg.kind === "property" ? [arg.propertyId] : []));
}
