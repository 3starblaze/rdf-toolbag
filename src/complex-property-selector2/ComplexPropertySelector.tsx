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
import { ancestorsOf, findNode, isGroup } from "./constraint-tree";
import { constraintShortName, countConstraints, groupName, plural } from "./node-text";
import { SelectorContext, type SelectorContextValue } from "./selector-context";
import {
    addConstraint,
    addGroup,
    addProperty,
    constraintsReferencing,
    moveConstraintNode,
    removeConstraintNode,
    removeProperty,
    replaceConstraintNode,
    replaceProperty,
    ungroup,
} from "./selection-ops";
import type {
    ComplexPropertySelection,
    ConstraintGroup,
    ConstraintNode,
    GroupOperator,
    SelectedProperty,
    SelectorLocation,
    Suggestion,
    SuggestionsFetcher,
} from "./shared";
import { findProperty, isPropertyUnset, makeDefaultSelection, propertyFullText, propertyShortText, stepLabels } from "./util";
import { MainView } from "./views/MainView";
import { PropertyEditView } from "./views/PropertyEditView";
import type { AddChoice } from "./views/ConstraintsSection";
import { ConstraintsSection } from "./views/ConstraintsSection";
import { LocationEditor, NegationEditor, OperatorEditor } from "./views/NodeSettings";

function locationOf(node: ConstraintNode): SelectorLocation {
    return { kind: isGroup(node) ? "group" : "constraint", id: node.id };
}

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
    const rawNode = rawLocation?.kind === "constraint" || rawLocation?.kind === "group"
        ? findNode(selection.constraints, rawLocation.id)
        : undefined;
    const node = rawNode && (rawLocation?.kind === "group") === isGroup(rawNode) ? rawNode : undefined;
    const location: SelectorLocation = (property || node) ? rawLocation : null;

    const textCtx = { selection, labelOf };
    const crumbs: Crumb[] = [{ label: "Selection", title: "Selection", location: null }];
    let title: string;
    let description: string;
    let body: ReactNode;

    const openNode = (it: ConstraintNode) => setLocation(locationOf(it));
    const moveNode = (id: string, parentId: string | null) =>
        setSelection(moveConstraintNode(selection, id, parentId));
    const addNode = (choice: AddChoice, parentId: string | null) => {
        if (choice.kind === "constraint") {
            const added = addConstraint(selection, choice.subType, parentId);
            setSelection(added.selection);
            setLocation(locationOf(added.constraint));
        } else {
            const added = addGroup(selection, choice.operator, parentId);
            setSelection(added.selection);
            setLocation(locationOf(added.group));
        }
    };

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
    } else if (node) {
        const ancestors = ancestorsOf(selection.constraints, node.id);
        const parent = ancestors[ancestors.length - 1];
        const parentLocation: SelectorLocation = parent ? locationOf(parent) : null;
        for (const group of ancestors) {
            crumbs.push({
                label: groupName(group, textCtx),
                title: groupName(group, textCtx, true),
                location: locationOf(group),
            });
        }

        const nodeSettings = {
            onNegatedChange: (negated: boolean) =>
                setSelection(replaceConstraintNode(selection, { ...node, negated })),
            onMove: (parentId: string | null) => moveNode(node.id, parentId),
            onRemove: () => {
                setSelection(removeConstraintNode(selection, node.id));
                setLocation(parentLocation);
            },
        };

        if (isGroup(node)) {
            crumbs.push({ label: groupName(node, textCtx), title: groupName(node, textCtx, true), location });
            title = groupName(node, textCtx);
            description = (node.operator === "and"
                ? "All constraints in this group must hold."
                : "At least one constraint in this group must hold.")
                + (node.negated ? " The result is then inverted." : "");
            body = (
                <GroupBody
                    group={node}
                    {...nodeSettings}
                    onOperatorChange={(operator) =>
                        setSelection(replaceConstraintNode(selection, { ...node, operator }))}
                    onUngroup={() => {
                        setSelection(ungroup(selection, node.id));
                        setLocation(parentLocation);
                    }}
                    onAdd={(choice) => addNode(choice, node.id)}
                    onOpen={openNode}
                    onMoveChild={moveNode}
                />
            );
        } else {
            const definition = definitionOf(node);
            crumbs.push({
                label: constraintShortName(node, textCtx),
                title: `${definition.label} constraint`,
                location,
            });
            title = `${definition.label} constraint`;
            description = definition.description;
            body = (
                <ConstraintBody
                    constraint={node}
                    {...nodeSettings}
                    onConstraintChange={(newConstraint) =>
                        setSelection(replaceConstraintNode(selection, newConstraint))}
                />
            );
        }
    } else {
        title = "Selection";
        description = "Properties to select and constraints on them. Select an item to edit it. "
            + "Drag a constraint onto an AND/OR group to move it in.";
        body = (
            <MainView
                onAddProperty={() => {
                    const added = addProperty(selection);
                    setSelection(added.selection);
                    setLocation({ kind: "property", id: added.property.id });
                }}
                onAddConstraint={(choice) => addNode(choice, null)}
                onOpenProperty={(id) => setLocation({ kind: "property", id })}
                onOpenConstraint={openNode}
                onMoveConstraint={moveNode}
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

/** Crumbs to show: past five, the middle ones collapse into one "…" crumb. */
function visibleCrumbs(crumbs: readonly Crumb[]): readonly Crumb[] {
    const n = crumbs.length;
    if (n <= 5) return crumbs;
    const hidden = crumbs.slice(1, n - 3);
    return [
        crumbs[0]!,
        { label: "…", title: `Hidden: ${hidden.map((it) => it.label).join(" › ")}`, location: hidden[hidden.length - 1]!.location },
        ...crumbs.slice(n - 3),
    ];
}

function SelectorHeader({
    crumbs: allCrumbs,
    onNavigate,
}: {
    crumbs: readonly Crumb[],
    onNavigate: (location: SelectorLocation) => void,
}) {
    const parent = allCrumbs[allCrumbs.length - 2];
    const crumbs = visibleCrumbs(allCrumbs);

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
    children,
}: {
    label: string,
    note?: string,
    onRemove: () => void,
    /** Further actions next to the remove button. */
    children?: ReactNode,
}) {
    return (
        <div className="flex flex-col items-start gap-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="destructive" className="cursor-pointer" onClick={onRemove}>
                    <Trash2 />
                    {label}
                </Button>
                {children}
            </div>
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
        ? `Also removes ${plural(referenceCount, "constraint")} that refer${referenceCount === 1 ? "s" : ""} to it.`
        : undefined;

    return (
        <div className="flex flex-col gap-4">
            <PropertyEditView property={property} onPropertyChange={onPropertyChange} />
            <RemoveFooter label="Remove property" note={note} onRemove={onRemove} />
        </div>
    );
}

interface NodeSettingsProps {
    onNegatedChange: (negated: boolean) => void,
    /** Move the node into a group (`null` for the top level). */
    onMove: (parentId: string | null) => void,
    onRemove: () => void,
}

function ConstraintBody({
    constraint,
    onConstraintChange,
    onNegatedChange,
    onMove,
    onRemove,
}: NodeSettingsProps & {
    constraint: Constraint,
    onConstraintChange: (newConstraint: Constraint) => void,
}) {
    const definition = definitionOf(constraint);

    return (
        <div className="flex flex-col gap-4">
            <definition.EditView constraint={constraint} onConstraintChange={onConstraintChange} />
            <NegationEditor node={constraint} onNegatedChange={onNegatedChange} />
            <LocationEditor node={constraint} onMove={onMove} />
            <RemoveFooter label="Remove constraint" onRemove={onRemove} />
        </div>
    );
}

function GroupBody({
    group,
    onNegatedChange,
    onMove,
    onRemove,
    onOperatorChange,
    onUngroup,
    onAdd,
    onOpen,
    onMoveChild,
}: NodeSettingsProps & {
    group: ConstraintGroup,
    onOperatorChange: (operator: GroupOperator) => void,
    onUngroup: () => void,
    onAdd: (choice: AddChoice) => void,
    onOpen: (node: ConstraintNode) => void,
    onMoveChild: (id: string, parentId: string | null) => void,
}) {
    const count = countConstraints(group.children);
    // NOTE: Only an AND group that is not negated can be dissolved without changing the meaning.
    const canUngroup = group.operator === "and" && !group.negated;

    return (
        <div className="flex flex-col gap-4">
            <OperatorEditor operator={group.operator} onOperatorChange={onOperatorChange} />
            <NegationEditor node={group} onNegatedChange={onNegatedChange} />
            <LocationEditor node={group} onMove={onMove} />
            <ConstraintsSection
                title="Constraints in group"
                titleHint={group.operator === "and"
                    ? "All of these must hold (AND)"
                    : "At least one of these must hold (OR)"}
                emptyText="No constraints in this group yet."
                nodes={group.children}
                containerId={group.id}
                onAdd={onAdd}
                onOpen={onOpen}
                onMove={onMoveChild}
            />
            <RemoveFooter
                label="Remove group"
                note={count > 0 ? `Also removes ${plural(count, "constraint")} inside it.` : undefined}
                onRemove={onRemove}
            >
                {canUngroup && (
                    <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        title="Move the constraints one level up and remove the group"
                        onClick={onUngroup}
                    >
                        Ungroup
                    </Button>
                )}
            </RemoveFooter>
        </div>
    );
}
