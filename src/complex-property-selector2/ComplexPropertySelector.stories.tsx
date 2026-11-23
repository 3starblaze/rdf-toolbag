import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import type { Canvas } from 'storybook/internal/types';
import ComplexPropertySelector from './ComplexPropertySelector';
import type { ComplexPropertySelection, SuggestionsFetcher } from './shared';

const meta = {
    title: "complex-property-selector2/ComplexPropertySelector",
    component: ComplexPropertySelector,
} satisfies Meta<typeof ComplexPropertySelector>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = Parameters<NonNullable<Story["render"]>>[0];

// NOTE: We are syncing args, so that storybook reflects the new structure
const syncedRender: Story["render"] = () => {
    const [args, setArgs] = useArgs<Args>();
    return (
        <ComplexPropertySelector
            {...args}
            onSelectionChange={(selection) => setArgs({ ...args, selection })}
        />
    );
};

const ex = (name: string) => `http://example.org/${name}`;

const exampleSuggestions: SuggestionsFetcher = async ({ target }) => {
    const iri = (name: string) => ({ value: ex(name), label: `ex:${name}` });
    if (target.kind === "propertyStep") {
        return ["name", "birthDate", "dateOfBirth", "email", "phone", "knows", "worksAt", "livesIn", "memberOf"].map(iri);
    }
    if (target.arg === "target") {
        return ["name", "knows", "worksAt"].map(iri);
    }
    switch (target.subType) {
        case "rdfType":
            return ["Person", "Organization", "City"].map(iri);
        case "langEquals":
        case "langMatches":
            return ["en", "lv", "de", "fr", "es", "ru"].map((lang) => ({ value: lang, label: lang }));
    }
};

const exampleLabelOf = (value: string) => value.startsWith(ex(""))
    ? `ex:${value.slice(ex("").length)}`
    : undefined;

const exampleSelection: ComplexPropertySelection = {
    properties: [
        { id: "p1", alternatives: [[ex("name")]], mandatory: true },
        { id: "p2", alternatives: [[ex("birthDate")], [ex("dateOfBirth")]], alias: "born", mandatory: false },
        { id: "p3", alternatives: [[ex("email")]], mandatory: false },
        { id: "p4", alternatives: [[ex("knows")]], mandatory: false },
        { id: "p5", alternatives: [[ex("knows"), ex("name")]], mandatory: false },
        { id: "p6", alternatives: [[ex("knows"), ex("worksAt")]], mandatory: false },
        { id: "p7", alternatives: [[ex("knows"), ex("worksAt"), ex("name")]], mandatory: false },
        { id: "p8", alternatives: [[ex("worksAt")], [ex("memberOf")]], alias: "employer", mandatory: false },
        { id: "p9", alternatives: [[ex("livesIn")]], mandatory: false },
    ],
    constraints: [
        { subType: "rdfType", id: "c1", target: { kind: "subject" }, value: { kind: "literal", value: ex("Person") } },
        { subType: "rdfType", id: "c2", negated: true, target: { kind: "subject" }, value: { kind: "literal", value: ex("Organization") } },
        {
            subType: "group", id: "g1", operator: "or", children: [
                { subType: "langEquals", id: "c3", target: { kind: "property", propertyId: "p1" }, value: { kind: "literal", value: "en" } },
                { subType: "langEquals", id: "c4", target: { kind: "property", propertyId: "p1" }, value: { kind: "literal", value: "lv" } },
            ],
        },
        {
            subType: "group", id: "g2", operator: "or", children: [
                {
                    subType: "group", id: "g3", operator: "and", children: [
                        { subType: "rdfType", id: "c5", target: { kind: "property", propertyId: "p4" }, value: { kind: "literal", value: ex("Person") } },
                        {
                            subType: "group", id: "g4", operator: "or", children: [
                                { subType: "langMatches", id: "c6", target: { kind: "property", propertyId: "p5" }, value: { kind: "literal", value: "en" } },
                                { subType: "langMatches", id: "c7", target: { kind: "property", propertyId: "p5" }, value: { kind: "literal", value: "lv" } },
                            ],
                        },
                    ],
                },
                { subType: "rdfType", id: "c8", negated: true, target: { kind: "property", propertyId: "p6" }, value: { kind: "literal", value: ex("Organization") } },
            ],
        },
        { subType: "group", id: "g5", operator: "and", negated: true, children: [] },
    ],
};

export const Empty: Story = {
    args: {},
};

export const Prefilled: Story = {
    args: {
        selection: exampleSelection,
        suggestionsFetcher: exampleSuggestions,
        labelOf: exampleLabelOf,
    },
    render: syncedRender,
};

export const PropertyEditView: Story = {
    args: {
        defaultSelection: exampleSelection,
        defaultLocation: { kind: "property", id: "p2" },
        suggestionsFetcher: exampleSuggestions,
        labelOf: exampleLabelOf,
    },
};

export const ConstraintEditView: Story = {
    args: {
        defaultSelection: exampleSelection,
        defaultLocation: { kind: "constraint", id: "c5" },
        suggestionsFetcher: exampleSuggestions,
        labelOf: exampleLabelOf,
    },
};

export const GroupEditView: Story = {
    args: {
        defaultSelection: exampleSelection,
        defaultLocation: { kind: "group", id: "g3" },
        suggestionsFetcher: exampleSuggestions,
        labelOf: exampleLabelOf,
    },
};

/**
 * Keeps the selection in state and serializes it, so that stories can assert on the whole selection.
 */
function SelectionJsonProbe({
    defaultSelection,
    suggestionsFetcher,
}: {
    defaultSelection: ComplexPropertySelection,
    suggestionsFetcher?: SuggestionsFetcher,
}) {
    const [selection, setSelection] = useState(defaultSelection);

    return (
        <>
            <ComplexPropertySelector
                selection={selection}
                onSelectionChange={setSelection}
                suggestionsFetcher={suggestionsFetcher}
            />
            <output data-testid="selection-json">{JSON.stringify(selection)}</output>
        </>
    );
}

function readSelectionJson(canvas: Canvas): ComplexPropertySelection {
    return JSON.parse(canvas.getByTestId("selection-json").textContent ?? "null");
}

// NOTE: Popups are portaled to the document body, so they are looked up through `screen`.
async function commitCustomValue(input: HTMLElement, value: string) {
    const user = userEvent.setup({});
    await user.clear(input);
    await user.type(input, value);
    await user.click(await screen.findByRole("option", { name: `Use "${value}"` }));
}

export const AddProperty: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe defaultSelection={{ properties: [], constraints: [] }} />
        );

        await step("Adding a property opens its edit view", async () => {
            await user.click(canvas.getByRole("button", { name: "Add property" }));
            expect(canvas.getByRole("heading", { name: "New property" })).toBeInTheDocument();
        });

        await step("Fill in a path of two steps", async () => {
            await commitCustomValue(canvas.getByRole("combobox", { name: "Step 1" }), "knows");
            await user.click(canvas.getByRole("button", { name: "Add step" }));
            await commitCustomValue(canvas.getByRole("combobox", { name: "Step 2" }), "name");
        });

        await step("Make it mandatory", async () => {
            await user.click(canvas.getByRole("radio", { name: "Mandatory" }));
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas)).toEqual({
                properties: [{ id: "p1", alternatives: [["knows", "name"]], mandatory: true }],
                constraints: [],
            });
        });

        await step("Go back to the main view", async () => {
            await user.click(canvas.getByRole("button", { name: "Up one level" }));
            expect(canvas.getByRole("button", { name: "Edit property knows / name" })).toBeInTheDocument();
            expect(canvas.getByRole("img", { name: "Mandatory" })).toBeInTheDocument();
        });
    },
};

export const AlternativePaths: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [{ id: "p1", alternatives: [["birthDate"]], mandatory: false }],
                    constraints: [],
                }}
            />
        );

        await user.click(canvas.getByRole("button", { name: "Edit property birthDate" }));

        await step("Alias is only shown for unions", async () => {
            expect(canvas.queryByRole("textbox", { name: "Union alias" })).toBeNull();
            await user.click(canvas.getByRole("button", { name: "Add alternative path" }));
            expect(canvas.getByText("OR")).toBeInTheDocument();
        });

        await step("Fill in the alternative and the alias", async () => {
            await commitCustomValue(canvas.getByRole("combobox", { name: "Step 1 of alternative 2" }), "dateOfBirth");
            await user.type(canvas.getByRole("textbox", { name: "Union alias" }), "born");
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).properties).toEqual([{
                id: "p1",
                alternatives: [["birthDate"], ["dateOfBirth"]],
                alias: "born",
                mandatory: false,
            }]);
        });

        await step("Main view shows the number of extra alternatives", async () => {
            await user.click(canvas.getByRole("button", { name: "Selection" }));
            expect(canvas.getByText("+1")).toBeInTheDocument();
        });
    },
};

export const AddConstraint: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [{ id: "p1", alternatives: [["knows"]], mandatory: false }],
                    constraints: [],
                }}
                suggestionsFetcher={exampleSuggestions}
            />
        );

        await step("Pick a constraint kind", async () => {
            await user.click(canvas.getByRole("button", { name: "Add constraint or group" }));
            await user.click(await screen.findByRole("menuitem", { name: /^LangEquals/ }));
            expect(canvas.getByRole("heading", { name: "LangEquals constraint" })).toBeInTheDocument();
        });

        await step("Pick the expected language", async () => {
            await user.click(canvas.getByRole("combobox", { name: "Expected language: literal value" }));
            await user.click(await screen.findByRole("option", { name: "lv" }));
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).constraints).toEqual([{
                subType: "langEquals",
                id: "c1",
                target: { kind: "property", propertyId: "p1" },
                value: { kind: "literal", value: "lv" },
            }]);
        });

        await step("Main view shows the compact constraint", async () => {
            await user.click(canvas.getByRole("button", { name: "Up one level" }));
            expect(canvas.getByRole("button", { name: /^Edit constraint LangEquals: knows equals "lv"/ }))
                .toBeInTheDocument();
        });
    },
};

export const SwitchArgumentKind: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [{ id: "p1", alternatives: [["worksAt"]], mandatory: false }],
                    constraints: [{
                        subType: "rdfType",
                        id: "c1",
                        target: { kind: "subject" },
                        value: { kind: "literal", value: "Organization" },
                    }],
                }}
            />
        );

        await user.click(canvas.getByRole("button", { name: /^Edit constraint Type/ }));

        await step("Point the target at a property", async () => {
            await user.click(canvas.getByRole("combobox", { name: "Target item: property" }));
            await user.click(await screen.findByRole("option", { name: "worksAt" }));
            expect(readSelectionJson(canvas).constraints[0]).toMatchObject({
                target: { kind: "property", propertyId: "p1" },
            });
        });

        await step("Make the target a literal", async () => {
            const toggle = canvas.getByRole("group", { name: "Target item: kind of value" });
            await user.click(within(toggle).getByRole("radio", { name: "Literal" }));
            expect(readSelectionJson(canvas).constraints[0]).toMatchObject({
                target: { kind: "literal", value: "" },
            });
            expect(canvas.getByRole("combobox", { name: "Target item: literal value" })).toBeInTheDocument();
        });
    },
};

export const RemovePropertyRemovesConstraints: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [
                        { id: "p1", alternatives: [["knows"]], mandatory: false },
                        { id: "p2", alternatives: [["name"]], mandatory: false },
                    ],
                    constraints: [
                        { subType: "rdfType", id: "c1", target: { kind: "property", propertyId: "p1" }, value: { kind: "literal", value: "Person" } },
                        { subType: "langEquals", id: "c2", target: { kind: "property", propertyId: "p2" }, value: { kind: "literal", value: "en" } },
                    ],
                }}
            />
        );

        await user.click(canvas.getByRole("button", { name: "Edit property knows" }));

        await step("Note warns about the referencing constraint", () => {
            expect(canvas.getByText("Also removes 1 constraint that refers to it.")).toBeInTheDocument();
        });

        await step("Remove the property", async () => {
            await user.click(canvas.getByRole("button", { name: "Remove property" }));
        });

        await step("Validate selection", async () => {
            await waitFor(() => expect(readSelectionJson(canvas)).toEqual({
                properties: [{ id: "p2", alternatives: [["name"]], mandatory: false }],
                constraints: [
                    { subType: "langEquals", id: "c2", target: { kind: "property", propertyId: "p2" }, value: { kind: "literal", value: "en" } },
                ],
            }));
            expect(canvas.getByRole("heading", { name: "Selection" })).toBeInTheDocument();
        });
    },
};

export const SuggestionTargets: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const targets: unknown[] = [];
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [{ id: "p1", alternatives: [["a"], ["b", ""]], mandatory: false }],
                    constraints: [{ subType: "rdfType", id: "c1", target: { kind: "subject" }, value: { kind: "literal", value: "" } }],
                }}
                suggestionsFetcher={async (ctx) => {
                    targets.push(ctx.target);
                    return [];
                }}
            />
        );

        await step("Property steps", async () => {
            await user.click(canvas.getByRole("button", { name: /^Edit property/ }));
            await user.click(canvas.getByRole("combobox", { name: "Step 2 of alternative 2" }));
            expect(targets).toContainEqual({ kind: "propertyStep", propertyId: "p1", alternativeIndex: 1, stepIndex: 1 });
        });

        await step("Constraint value", async () => {
            await user.keyboard("{Escape}");
            await user.click(canvas.getByRole("button", { name: "Up one level" }));
            await user.click(canvas.getByRole("button", { name: /^Edit constraint/ }));
            await user.click(canvas.getByRole("combobox", { name: "Expected type: literal value" }));
            expect(targets).toContainEqual({ kind: "constraintArg", constraintId: "c1", subType: "rdfType", arg: "value" });
        });
    },
};

export const GroupsAndNegation: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [{ id: "p1", alternatives: [["label"]], mandatory: false }],
                    constraints: [
                        { subType: "langEquals", id: "c1", target: { kind: "property", propertyId: "p1" }, value: { kind: "literal", value: "en" } },
                    ],
                }}
            />
        );

        await step("Add an OR group, which opens its edit view", async () => {
            await user.click(canvas.getByRole("button", { name: "Add constraint or group" }));
            await user.click(await screen.findByRole("menuitem", { name: /^OR group/ }));
            expect(canvas.getByRole("heading", { name: "OR group" })).toBeInTheDocument();
            expect(canvas.getByText("No constraints in this group yet.")).toBeInTheDocument();
        });

        await step("Negate the group", async () => {
            await user.click(within(canvas.getByRole("group", { name: "Negation" })).getByRole("radio", { name: "NOT" }));
            expect(canvas.getByRole("heading", { name: "NOT OR group" })).toBeInTheDocument();
        });

        await step("Add a constraint inside the group", async () => {
            await user.click(canvas.getByRole("button", { name: "Add constraint or group" }));
            await user.click(await screen.findByRole("menuitem", { name: /^LangMatches/ }));
            expect(canvas.getByRole("button", { name: "NOT OR group" })).toBeInTheDocument();
        });

        await step("Move the top-level constraint into the group", async () => {
            await user.click(canvas.getByRole("button", { name: "Selection" }));
            await user.click(canvas.getByRole("button", { name: /^Edit constraint LangEquals/ }));
            await user.click(canvas.getByRole("combobox", { name: "Group that contains this item" }));
            await user.click(await screen.findByRole("option", { name: /^NOT OR group/ }));
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).constraints).toEqual([{
                subType: "group",
                id: "g1",
                operator: "or",
                negated: true,
                children: [
                    { subType: "langMatches", id: "c2", target: { kind: "property", propertyId: "p1" }, value: { kind: "literal", value: "" } },
                    { subType: "langEquals", id: "c1", target: { kind: "property", propertyId: "p1" }, value: { kind: "literal", value: "en" } },
                ],
            }]);
        });

        await step("Main view shows the group and NOT labels", async () => {
            await user.click(canvas.getByRole("button", { name: "Selection" }));
            expect(canvas.getByRole("button", { name: "Edit negation" })).toBeInTheDocument();
            expect(canvas.getByRole("button", { name: "Edit NOT OR group" })).toBeInTheDocument();
        });
    },
};

export const Ungroup: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const leaf = (id: string) => ({
            subType: "rdfType" as const, id, target: { kind: "subject" as const }, value: { kind: "literal" as const, value: id },
        });
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [],
                    constraints: [
                        leaf("c1"),
                        { subType: "group", id: "g1", operator: "and", children: [leaf("c2"), leaf("c3")] },
                        { subType: "group", id: "g2", operator: "or", children: [leaf("c4")] },
                    ],
                }}
            />
        );

        await step("OR group cannot be ungrouped", async () => {
            await user.click(canvas.getByRole("button", { name: "Edit OR group" }));
            expect(canvas.getByText("Also removes 1 constraint inside it.")).toBeInTheDocument();
            expect(canvas.queryByRole("button", { name: "Ungroup" })).toBeNull();
        });

        await step("Ungroup the AND group", async () => {
            await user.click(canvas.getByRole("button", { name: "Selection" }));
            await user.click(canvas.getByRole("button", { name: "Edit AND group" }));
            await user.click(canvas.getByRole("button", { name: "Ungroup" }));
            expect(canvas.getByRole("heading", { name: "Selection" })).toBeInTheDocument();
            expect(readSelectionJson(canvas).constraints.map((it) => it.id)).toEqual(["c1", "c2", "c3", "g2"]);
        });
    },
};

export const RemovingNestedConstraint: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});
        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    properties: [],
                    constraints: [{
                        subType: "group", id: "g1", operator: "and", children: [{
                            subType: "group", id: "g2", operator: "or", children: [
                                { subType: "rdfType", id: "c1", target: { kind: "subject" }, value: { kind: "literal", value: "T" } },
                            ],
                        }],
                    }],
                }}
            />
        );

        await step("Breadcrumb lists the groups", async () => {
            await user.click(canvas.getByRole("button", { name: /^Edit constraint Type/ }));
            const nav = canvas.getByRole("navigation", { name: "breadcrumb" });
            expect(within(nav).getByRole("button", { name: "AND group" })).toBeInTheDocument();
            expect(within(nav).getByRole("button", { name: "OR group" })).toBeInTheDocument();
        });

        await step("Removing goes up to the containing group", async () => {
            await user.click(canvas.getByRole("button", { name: "Remove constraint" }));
            expect(canvas.getByRole("heading", { name: "OR group" })).toBeInTheDocument();
            expect(readSelectionJson(canvas).constraints).toEqual([{
                subType: "group", id: "g1", operator: "and", children: [
                    { subType: "group", id: "g2", operator: "or", children: [] },
                ],
            }]);
        });
    },
};
