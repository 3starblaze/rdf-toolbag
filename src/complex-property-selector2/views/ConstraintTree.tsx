import { useRef, type ComponentProps, type CSSProperties } from "react";
import { DragDropProvider, DragOverlay, useDragOperation, useDraggable, useDroppable } from "@dnd-kit/react";
import { ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { definitionOf, type Constraint } from "../constraints";
import { canMoveNode, findNode, isGroup, selfAndDescendantIds } from "../constraint-tree";
import { RowButton } from "../components/primitives";
import { describeConstraint, groupName } from "../node-text";
import { useSelectorContext } from "../selector-context";
import type { ConstraintGroup, ConstraintNode } from "../shared";

/** Width of one gutter cell (a group bracket or a NOT label), in px. */
const GUTTER_WIDTH = 18;
const ROOT_KEY = "\u0000root";

const keyOf = (parentId: string | null) => parentId ?? ROOT_KEY;

/** Data of a drop target: the group that a dropped constraint is moved into. */
interface DropData {
    [key: string]: unknown,
    parentId: string | null,
}

/** A group or a NOT, covering the rows from `start` to `end` (inclusive). */
interface Span {
    type: "group" | "not",
    start: number,
    end: number,
    node: ConstraintNode,
}

type FlatRow =
    | { kind: "constraint", node: Constraint, spans: Span[] }
    | { kind: "empty", node: ConstraintGroup, spans: Span[] };

/**
 * Flatten the tree into one-line rows. Every group and every NOT becomes a span over the rows it
 * covers, and each row draws one gutter cell per span that covers it.
 */
function flatten(nodes: readonly ConstraintNode[]): FlatRow[] {
    const rows: FlatRow[] = [];
    const walk = (list: readonly ConstraintNode[], inherited: readonly Span[]) => {
        for (const node of list) {
            const spans = [...inherited];
            const own: Span[] = [];
            if (node.negated) own.push({ type: "not", start: rows.length, end: rows.length, node });
            if (isGroup(node)) own.push({ type: "group", start: rows.length, end: rows.length, node });
            spans.push(...own);

            if (!isGroup(node)) rows.push({ kind: "constraint", node, spans });
            else if (node.children.length === 0) rows.push({ kind: "empty", node, spans });
            else walk(node.children, spans);

            for (const span of own) span.end = rows.length - 1;
        }
    };
    walk(nodes, []);
    return rows;
}

/** Group that a row belongs to: its innermost group, or the list's own group. */
function parentOfRow(row: FlatRow, containerId: string | null): string | null {
    const groups = row.spans.filter((span) => span.type === "group");
    return groups.length > 0 ? groups[groups.length - 1]!.node.id : containerId;
}

export interface ConstraintTreeProps {
    /** Nodes to show. */
    nodes: readonly ConstraintNode[],
    /** Group whose children are shown, `null` for the top level. */
    containerId: string | null,
    onOpen: (node: ConstraintNode) => void,
    /** Move a constraint into a group (`null` for the top level). */
    onMove: (id: string, parentId: string | null) => void,
}

/**
 * List of constraints. Groups are drawn as bracket lines with a vertical AND / OR label, negation as
 * a vertical NOT label to the left. Constraints can be dragged onto a group to move them into it.
 */
export function ConstraintTree(props: ConstraintTreeProps) {
    const { selection } = useSelectorContext();

    // NOTE: Handlers can be called after a re-render, so they read the latest props through a ref.
    const latest = useRef({ props, selection });
    latest.current = { props, selection };

    return (
        <DragDropProvider
            onDragEnd={({ operation, canceled }) => {
                if (canceled || !operation.source || !operation.target) return;
                const { props, selection } = latest.current;
                const id = String(operation.source.id);
                const { parentId } = operation.target.data as DropData;
                if (canMoveNode(selection.constraints, id, parentId)) props.onMove(id, parentId);
            }}
        >
            <TreeRows {...props} />
            <DragOverlay dropAnimation={null}>
                {(source) => <DragPreview id={String(source.id)} />}
            </DragOverlay>
        </DragDropProvider>
    );
}

interface DragState {
    /** Id of the dragged constraint. */
    sourceId: string | null,
    /** Ids of the dragged node and its contents. */
    banned: readonly string[],
    /** Key of the group that the constraint would be moved into, if the drop is allowed. */
    hotKey: string | null,
}

function useDragState(): DragState {
    const { selection } = useSelectorContext();
    const { source, target } = useDragOperation();
    if (!source) return { sourceId: null, banned: [], hotKey: null };

    const sourceId = String(source.id);
    const sourceNode = findNode(selection.constraints, sourceId);
    const parentId = (target?.data as DropData | undefined)?.parentId;
    const valid = target != null && parentId !== undefined && canMoveNode(selection.constraints, sourceId, parentId);
    return {
        sourceId,
        banned: sourceNode ? selfAndDescendantIds(sourceNode) : [sourceId],
        hotKey: valid ? keyOf(parentId) : null,
    };
}

function TreeRows({ nodes, containerId, onOpen }: ConstraintTreeProps) {
    const drag = useDragState();
    const rows = flatten(nodes);

    return (
        <div
            data-hot={drag.hotKey === keyOf(containerId)}
            className="flex flex-col rounded-lg outline-offset-4 data-[hot=true]:outline-2 data-[hot=true]:outline-blue-600 data-[hot=true]:outline-dashed"
        >
            {rows.map((row, i) => (
                <TreeRow
                    key={row.node.id}
                    row={row}
                    index={i}
                    parentId={parentOfRow(row, containerId)}
                    drag={drag}
                    onOpen={onOpen}
                />
            ))}
        </div>
    );
}

function TreeRow({
    row,
    index,
    parentId,
    drag,
    onOpen,
}: {
    row: FlatRow,
    index: number,
    parentId: string | null,
    drag: DragState,
    onOpen: (node: ConstraintNode) => void,
}) {
    const data: DropData = { parentId };
    const { ref } = useDroppable({ id: `row:${row.node.id}`, data });
    const hot = drag.hotKey !== null && row.spans.some(
        (span) => span.type === "group" && keyOf(span.node.id) === drag.hotKey,
    );

    return (
        <div
            ref={ref}
            data-hot={hot}
            className="flex min-w-0 items-stretch [--halo:var(--background)] data-[hot=true]:bg-blue-50 data-[hot=true]:[--halo:var(--color-blue-50)] dark:data-[hot=true]:bg-blue-950 dark:data-[hot=true]:[--halo:var(--color-blue-950)]"
        >
            {row.spans.map((span) => (
                <GutterCell
                    key={`${span.type}:${span.node.id}`}
                    span={span}
                    index={index}
                    drag={drag}
                    onOpen={() => onOpen(span.node)}
                />
            ))}
            {row.kind === "constraint"
                ? <ConstraintRow constraint={row.node} onOpen={() => onOpen(row.node)} />
                : <EmptyGroupRow group={row.node} onOpen={() => onOpen(row.node)} />}
        </div>
    );
}

function GutterCell({
    span,
    index,
    drag,
    onOpen,
}: {
    span: Span,
    index: number,
    drag: DragState,
    onOpen: () => void,
}) {
    const first = index === span.start;
    const last = index === span.end;
    // NOTE: The label is centred on the whole span: on the middle row for an odd number of rows,
    // on the boundary between the two middle rows for an even number.
    const count = span.end - span.start + 1;
    const odd = count % 2 === 1;
    const labelIndex = odd ? span.start + (count - 1) / 2 : span.start + count / 2 - 1;
    const labelTop = odd ? "50%" : "100%";

    if (span.type === "not") {
        return (
            <div className="relative flex-none self-stretch" style={{ width: GUTTER_WIDTH }}>
                {index === labelIndex && (
                    <VerticalLabel
                        top={labelTop}
                        height={28}
                        className="border border-red-600/40 bg-red-50 text-[10px] leading-4 tracking-[.06em] text-red-700 hover:bg-red-100 dark:border-red-400/40 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                        aria-label="Edit negation"
                        title="NOT: inverts what is to its right"
                        onClick={onOpen}
                    >
                        NOT
                    </VerticalLabel>
                )}
            </div>
        );
    }

    const group = span.node as ConstraintGroup;
    return <GroupGutterCell group={group} first={first} last={last} showLabel={index === labelIndex} labelTop={labelTop} drag={drag} onOpen={onOpen} />;
}

function GroupGutterCell({
    group,
    first,
    last,
    showLabel,
    labelTop,
    drag,
    onOpen,
}: {
    group: ConstraintGroup,
    first: boolean,
    last: boolean,
    showLabel: boolean,
    labelTop: string,
    drag: DragState,
    onOpen: () => void,
}) {
    const { selection, labelOf } = useSelectorContext();
    const op = group.operator.toUpperCase();
    const hot = drag.hotKey === keyOf(group.id);
    const armed = drag.sourceId !== null && !drag.banned.includes(group.id);
    const lineColor = hot
        ? "bg-blue-600 dark:bg-blue-400"
        : armed ? "bg-blue-300 dark:bg-blue-700" : "bg-muted-foreground";
    const lineStyle: CSSProperties = {
        top: first ? "calc(50% - 1px)" : 0,
        bottom: last ? "calc(50% - 1px)" : 0,
    };

    return (
        <div className="relative flex-none self-stretch" style={{ width: GUTTER_WIDTH }}>
            <div aria-hidden="true" className={cn("absolute left-2 w-0.5 rounded-[1px]", lineColor)} style={lineStyle} />
            {(first || last) && (
                <div aria-hidden="true" className={cn("absolute top-[calc(50%-1px)] left-2 h-0.5 w-2.5 rounded-[1px]", lineColor)} />
            )}
            {showLabel && (
                <VerticalLabel
                    top={labelTop}
                    height={op === "AND" ? 30 : 22}
                    className={cn(
                        "text-[11px] leading-[18px] tracking-[.08em]",
                        hot
                            ? "bg-blue-600 text-white hover:bg-blue-600 hover:text-white"
                            : "bg-background text-neutral-600 dark:text-neutral-400",
                    )}
                    aria-label={`Edit ${groupName(group, { selection, labelOf })}`}
                    title={`${op} group: ${op === "AND" ? "all" : "at least one"} of the constraints beside this line must hold`}
                    onClick={onOpen}
                >
                    {op}
                </VerticalLabel>
            )}
        </div>
    );
}

function VerticalLabel({
    top,
    height,
    className,
    ...props
}: Omit<ComponentProps<"button">, "type" | "style"> & { top: string, height: number }) {
    return (
        <button
            type="button"
            style={{ top, height }}
            className={cn(
                "absolute left-0 z-[2] box-border w-[18px] -translate-y-1/2 rotate-180 cursor-pointer rounded-sm border-0 p-0 text-center font-semibold shadow-[0_0_0_3px_var(--halo)] outline-none [writing-mode:vertical-rl] hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                className,
            )}
            {...props}
        />
    );
}

function ConstraintRow({ constraint, onOpen }: { constraint: Constraint, onOpen: () => void }) {
    const { selection, labelOf } = useSelectorContext();
    const { ref, handleRef, isDragSource } = useDraggable({ id: constraint.id });
    const definition = definitionOf(constraint);
    const full = describeConstraint(constraint, { selection, labelOf });

    return (
        <div
            ref={ref}
            className={cn("my-0.5 flex min-w-0 flex-1 items-center gap-0.5", isDragSource && "opacity-40")}
        >
            <button
                type="button"
                ref={handleRef}
                aria-label={`Move constraint ${full}`}
                title="Drag onto an AND/OR group to move this constraint into it"
                className="flex w-[18px] flex-none cursor-grab touch-none items-center justify-center self-stretch rounded-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
            >
                <GripVertical aria-hidden="true" className="size-3.5" />
            </button>
            <RowButton title={full} aria-label={`Edit constraint ${full}`} onClick={onOpen}>
                <definition.MainView constraint={constraint} />
            </RowButton>
        </div>
    );
}

function EmptyGroupRow({ group, onOpen }: { group: ConstraintGroup, onOpen: () => void }) {
    const { selection, labelOf } = useSelectorContext();
    const name = groupName(group, { selection, labelOf });

    return (
        <div className="my-0.5 ml-5 flex min-w-0 flex-1">
            <RowButton
                className="border-dashed shadow-none"
                title={`${name} has no constraints yet`}
                aria-label={`Edit ${name}`}
                onClick={onOpen}
            >
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    Empty {name}: drop constraints here
                </span>
            </RowButton>
        </div>
    );
}

/** Row that follows the pointer while a constraint is dragged. */
function DragPreview({ id }: { id: string }) {
    const { selection } = useSelectorContext();
    const node = findNode(selection.constraints, id);
    if (!node || isGroup(node)) return null;
    const definition = definitionOf(node);

    return (
        <div className="flex h-9 w-120 max-w-[80vw] items-center gap-2 overflow-hidden rounded-lg border bg-background pr-2.5 pl-3 text-sm shadow-md">
            <definition.MainView constraint={node} />
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </div>
    );
}
