import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { definitionOf, type Constraint } from "./constraints";
import { SelectorContext, type SelectorContextValue } from "./selector-context";
import {
    addConstraint,
    addProperty,
    constraintsReferencing,
    removeConstraint,
    removeProperty,
    replaceConstraint,
    replaceProperty,
} from "./selection-ops";
import type {
    ComplexPropertySelection,
    SelectedProperty,
    SelectorLocation,
    Suggestion,
    SuggestionsFetcher,
} from "./shared";
import { findProperty, isPropertyUnset, makeDefaultSelection, propertyFullText, propertyShortText, stepLabels } from "./util";
import { MainView } from "./views/MainView";
import { PropertyEditView } from "./views/PropertyEditView";

export interface ComplexPropertySelectorProps {
    /** Selection to show. */
    selection?: ComplexPropertySelection,
    /** Callback invoked on selection change. */
    onSelectionChange?: (selection: ComplexPropertySelection) => void,
    /** Initial selection value for uncontrolled state. */
    defaultSelection?: ComplexPropertySelection,
    /** View to show. `null` is the main view. */
    location?: SelectorLocation,
    /** Callback invoked when another view is opened. */
    onLocationChange?: (location: SelectorLocation) => void,
    /** Initial view for uncontrolled state. */
    defaultLocation?: SelectorLocation,
    /** Fetch suggestions for property steps and constraint values. */
    suggestionsFetcher?: SuggestionsFetcher,
    /**
     * Label of a value (usually a URI), used in compact views before suggestions have been fetched.
     * Labels from fetched suggestions take precedence. Without a label the value itself is shown.
     */
    labelOf?: (value: string) => string | undefined,
    className?: string,
}

interface Crumb {
    label: string,
    title: string,
    location: SelectorLocation,
}

export default function ComplexPropertySelector({
    selection: controlledSelection,
    onSelectionChange,
    defaultSelection,
    location: controlledLocation,
    onLocationChange,
    defaultLocation,
    suggestionsFetcher,
    labelOf: externalLabelOf,
    className,
}: ComplexPropertySelectorProps) {
    // NOTE: We are wrapping this component with its own queryClient so that this component can be
    // used without explicitly requiring end users to use tanstack query.
    // NOTE: The client is created once per instance so that its cache survives re-renders.
    const [queryClient] = useState(() => new QueryClient());

    const [selection, setSelection] = useControllableState<ComplexPropertySelection>({
        prop: controlledSelection,
        defaultProp: defaultSelection ?? makeDefaultSelection(),
        onChange: onSelectionChange,
    });

    const [rawLocation, setLocation] = useControllableState<SelectorLocation>({
        prop: controlledLocation,
        defaultProp: defaultLocation ?? null,
        onChange: onLocationChange,
    });

    // NOTE: Labels are collected from suggestions, so that compact views can show labels instead of
    // raw values (URIs).
    const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
    const rememberLabels = useCallback((suggestions: readonly Suggestion[]) => {
        setLabels((old) => {
            const changed = suggestions.filter(({ value, label }) => old.get(value) !== label);
            if (changed.length === 0) return old;
            const updated = new Map(old);
            for (const { value, label } of changed) updated.set(value, label);
            return updated;
        });
    }, []);
    const labelOf = useCallback(
        (value: string) => labels.get(value) ?? externalLabelOf?.(value) ?? value,
        [labels, externalLabelOf],
    );

    const contextValue = useMemo<SelectorContextValue>(
        () => ({ selection, suggestionsFetcher, labelOf, rememberLabels }),
        [selection, suggestionsFetcher, labelOf, rememberLabels],
    );

    // NOTE: Fall back to the main view if the shown item is gone.
    const property = rawLocation?.kind === "property" ? findProperty(selection, rawLocation.id) : undefined;
    const constraint = rawLocation?.kind === "constraint"
        ? selection.constraints.find((c) => c.id === rawLocation.id)
        : undefined;
    const location: SelectorLocation = (property || constraint) ? rawLocation : null;

    const textCtx = { selection, labelOf };
    const crumbs: Crumb[] = [{ label: "Selection", title: "Selection", location: null }];
    let title: string;
    let description: string;
    let body: ReactNode;

    if (property) {
        const unset = isPropertyUnset(property);
        crumbs.push({
            label: propertyShortText(property, labelOf, 34),
            title: propertyFullText(property, labelOf),
            location,
        });
        title = unset ? "New property" : stepLabels(property.alternatives[0] ?? [], labelOf).join(" / ");
        description = "A path of steps from the subject. Add alternatives to make a union.";
        body = (
            <PropertyBody
                property={property}
                referenceCount={constraintsReferencing(selection, property.id).length}
                onPropertyChange={(newProperty) => setSelection(replaceProperty(selection, newProperty))}
                onRemove={() => {
                    setSelection(removeProperty(selection, property.id));
                    setLocation(null);
                }}
            />
        );
    } else if (constraint) {
        const definition = definitionOf(constraint);
        crumbs.push({
            label: definition.shortName(constraint, textCtx),
            title: `${definition.label} constraint`,
            location,
        });
        title = `${definition.label} constraint`;
        description = definition.description;
        body = (
            <ConstraintBody
                constraint={constraint}
                onConstraintChange={(newConstraint) => setSelection(replaceConstraint(selection, newConstraint))}
                onRemove={() => {
                    setSelection(removeConstraint(selection, constraint.id));
                    setLocation(null);
                }}
            />
        );
    } else {
        title = "Selection";
        description = "Properties to select and constraints on them. Select an item to edit it.";
        body = (
            <MainView
                onAddProperty={() => {
                    const added = addProperty(selection);
                    setSelection(added.selection);
                    setLocation({ kind: "property", id: added.property.id });
                }}
                onAddConstraint={(subType) => {
                    const added = addConstraint(selection, subType);
                    setSelection(added.selection);
                    setLocation({ kind: "constraint", id: added.constraint.id });
                }}
                onOpenProperty={(id) => setLocation({ kind: "property", id })}
                onOpenConstraint={(id) => setLocation({ kind: "constraint", id })}
            />
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <SelectorContext.Provider value={contextValue}>
                <div className={cn("max-w-140 rounded-[10px] border bg-background text-sm shadow-xs", className)}>
                    <SelectorHeader crumbs={crumbs} onNavigate={setLocation} />
                    <div className="flex flex-col gap-4 p-4">
                        <div>
                            <h2 className="m-0 text-base font-semibold [overflow-wrap:anywhere]">{title}</h2>
                            <p className="mt-0.5 mb-0 text-muted-foreground">{description}</p>
                        </div>
                        {body}
                    </div>
                </div>
            </SelectorContext.Provider>
        </QueryClientProvider>
    );
}

function SelectorHeader({
    crumbs,
    onNavigate,
}: {
    crumbs: readonly Crumb[],
    onNavigate: (location: SelectorLocation) => void,
}) {
    const parent = crumbs[crumbs.length - 2];

    return (
        <div className="flex items-center gap-2 rounded-t-[10px] border-b bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                aria-label="Up one level"
                title="Up one level"
                disabled={!parent}
                onClick={() => parent && onNavigate(parent.location)}
            >
                <ArrowLeft />
            </Button>
            <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex-nowrap gap-0.5 overflow-hidden sm:gap-0.5">
                    {crumbs.map((crumb, i) => {
                        const isCurrent = i === crumbs.length - 1;
                        return (
                            <BreadcrumbItem key={i} className="min-w-0 gap-0.5">
                                {i > 0 && <BreadcrumbSeparator />}
                                {isCurrent ? (
                                    <BreadcrumbPage
                                        title={crumb.title}
                                        className="max-w-90 truncate px-1.5 py-0.5 font-medium"
                                    >
                                        {crumb.label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <button
                                            type="button"
                                            title={crumb.title}
                                            className="max-w-37.5 cursor-pointer truncate rounded-md px-1.5 py-0.5 hover:bg-accent"
                                            onClick={() => onNavigate(crumb.location)}
                                        >
                                            {crumb.label}
                                        </button>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        );
                    })}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    );
}

function RemoveFooter({
    label,
    note,
    onRemove,
}: {
    label: string,
    note?: string,
    onRemove: () => void,
}) {
    return (
        <div className="flex flex-col items-start gap-2 border-t pt-4">
            <Button type="button" variant="destructive" className="cursor-pointer" onClick={onRemove}>
                <Trash2 />
                {label}
            </Button>
            {note && <p className="m-0 text-muted-foreground">{note}</p>}
        </div>
    );
}

function PropertyBody({
    property,
    referenceCount,
    onPropertyChange,
    onRemove,
}: {
    property: SelectedProperty,
    referenceCount: number,
    onPropertyChange: (newProperty: SelectedProperty) => void,
    onRemove: () => void,
}) {
    const note = referenceCount > 0
        ? `Also removes ${referenceCount} constraint${referenceCount === 1 ? "" : "s"} that refer${referenceCount === 1 ? "s" : ""} to it.`
        : undefined;

    return (
        <div className="flex flex-col gap-4">
            <PropertyEditView property={property} onPropertyChange={onPropertyChange} />
            <RemoveFooter label="Remove property" note={note} onRemove={onRemove} />
        </div>
    );
}

function ConstraintBody({
    constraint,
    onConstraintChange,
    onRemove,
}: {
    constraint: Constraint,
    onConstraintChange: (newConstraint: Constraint) => void,
    onRemove: () => void,
}) {
    const definition = definitionOf(constraint);

    return (
        <div className="flex flex-col gap-4">
            <definition.EditView constraint={constraint} onConstraintChange={onConstraintChange} />
            <RemoveFooter label="Remove constraint" onRemove={onRemove} />
        </div>
    );
}
