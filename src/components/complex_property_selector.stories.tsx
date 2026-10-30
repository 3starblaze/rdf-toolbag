import type { Meta, StoryObj } from '@storybook/react-vite';
import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection, type SuggestionsFetcherContext } from './complex_property_selector';
import { expect, screen, userEvent } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import { useState, type ComponentProps } from 'react';
import type { Canvas } from 'storybook/internal/types';

const meta = {
  title: "Components/ComplexPropertySelector",
  component: ComplexPropertySelector,
} satisfies Meta<typeof ComplexPropertySelector>;

export default meta;

type Story = StoryObj<typeof meta>;
type Args = Parameters<NonNullable<Story["render"]>>[0];

// NOTE: We are syncing args, so that storybook reflects the new structure
const syncedRender: Story["render"] = () => {
    const [args, setArgs] = useArgs<Args>();

    function onSelectionChange(selection: ComplexPropertySelection) {
        setArgs({ ...args, selection });
    }

    // HACK: This probably causes double rendering but it works
    if (!args.onSelectionChange) {
        setArgs({ ...args, onSelectionChange })
    }

    return (
        <ComplexPropertySelector {...args} />
    );
};

function WrappedSelector({ args: oldArgs }: { args: Args }) {
    const [args, setArgs] = useState(oldArgs);

    function onSelectionChange(selection: ComplexPropertySelection) {
        setArgs({ ...args, selection });
    }

    return (
        <ComplexPropertySelector
            {...args}
            {...{ onSelectionChange }}
        />
    );
}

export const Prefilled: Story = {
    args: {
        selection: {
            rdfType: { names: ["http://myType"] },
            dataProps: [
                { names: ["http://dataProp0"], mandatory: false },
                { names: ["http://dataProp1"], mandatory: false },
            ],
            objectProps: [
                { names: ["http://objProp0"], mandatory: false, selection: makeDefaultSelection() },
                { names: ["http://objProp1"], mandatory: false, selection: makeDefaultSelection() },
                { names: ["http://objProp2"], mandatory: false, selection: makeDefaultSelection() },
            ],
        },
    },
    render: syncedRender,
};


export const WithPropSuggestions: Story = {
  args: {
      suggestionsFetcher: async (ctx) => {
          const rdfType = ctx.selection.rdfType.names[0] ?? "";

          switch (ctx.target.kind) {
              case "rdfType":
                  return [
                      { value: 'http://typeAlpha', label: ":typeAlpha" },
                      { value: 'http://typeBeta', label: ":typeBeta" },
                      { value: 'http://typeGamma', label: ":typeGamma" },
                  ];
              case "dataProp":
                  return (() => {
                      const finalName = rdfType.split("//").slice(-1)[0] ?? "noClass";

                      const fmtItem = (i: number) => ({
                          value: `http://${finalName}/suggestedData${i}`,
                          label: `${finalName}:suggestedData${i}`,
                      });

                      return [
                          fmtItem(0),
                          fmtItem(1),
                          fmtItem(2),
                      ];
                  })();
              case "objectProp":
                  return (() => {
                      const finalName = rdfType || "noClass";

                      const fmtItem = (i: number) => ({
                          value: `http://${finalName}/suggestedObj${i}`,
                          label: `${finalName}:suggestedObj${i}`,
                      });

                      return [
                          fmtItem(0),
                          fmtItem(1),
                          fmtItem(2),
                      ];
                  })();
          }
      },
  },
  render: syncedRender,
};

export const DeepRecursion: Story = {
    args: {
        selection: {
            ...makeDefaultSelection(),
            objectProps: [{
                names: ["http://lookDeeper"], mandatory: false,
                selection: {
                    ...makeDefaultSelection(),
                    objectProps: [{
                        names: ["http://lookAgain"], mandatory: false,
                        selection: {
                            ...makeDefaultSelection(),
                            objectProps: [{
                                names: ["http://andOnceAgain"], mandatory: false,
                                selection: {
                                    ...makeDefaultSelection(),
                                    objectProps: [{
                                        names: ["http://okThatsIt"], mandatory: false,
                                        selection: {
                                            ...makeDefaultSelection(),
                                        }
                                    }]
                                }
                            }]
                        }
                    }],
                }
            }],
        }
    },
    render: syncedRender,
}

export const TypeIsUpdatedInUI: Story = {
    args: {
        selection: {
            rdfType: { names: ["mytype"] },
            dataProps: [],
            objectProps: [],
        },
    },
  play: async ({ canvas }) => {
    expect(canvas.queryAllByDisplayValue("mytype")).not.toHaveLength(0);
  }
};

export const NoTypeSmearing: Story = {
    args: {
        selection: {
            rdfType: { names: ["initialType"] },
            dataProps: [],
            objectProps: [],
        },
    },
    play: async ({ args, mount }) => {
        const canvas0 = await mount(<WrappedSelector args={args} />);
        expect(canvas0.queryAllByDisplayValue("initialType")).not.toHaveLength(0);

        const canvas1 = await mount(
            <WrappedSelector
                args={{
                    ...args,
                    selection: {
                        rdfType: { names: ["freshType"] },
                        dataProps: [],
                        objectProps: [],
                    }
                }}
            />
        );

        expect(canvas1.queryAllByDisplayValue("initialType")).toHaveLength(0);
        expect(canvas1.queryAllByDisplayValue("freshType")).not.toHaveLength(0);
    }
};

function ExternalRdfTypeSetter() {
    const [selection, setSelection] = useState<ComplexPropertySelection>({
        rdfType: { names: ["initialType"] },
        dataProps: [],
        objectProps: [],
    });

    return (
        <>
            <button onClick={() => setSelection({ ...selection, rdfType: { names: ["freshType"] } })}>
                Set type
            </button>
            <ComplexPropertySelector selection={selection} onSelectionChange={setSelection} />
        </>
    );
}

// NOTE: Testing that the type combobox reflects a type that is changed from outside of the component
export const RdfTypeUpdatesFromOutside: Story = {
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(<ExternalRdfTypeSetter />);

        await step("Validate initial state", () => {
            expect(canvas.queryAllByDisplayValue("initialType")).not.toHaveLength(0);
        });

        await step("Type without committing", async () => {
            const typeInput = canvas.queryAllByDisplayValue("initialType")[0];
            await user.clear(typeInput);
            await user.type(typeInput, "uncommitted");
        });

        await step("Change type from outside", async () => {
            await user.click(canvas.getByText("Set type"));
        });

        await step("Validate final state", () => {
            expect(canvas.queryAllByDisplayValue("freshType")).not.toHaveLength(0);
            expect(canvas.queryAllByDisplayValue("uncommitted")).toHaveLength(0);
        });
    },
};

const initialSelection: ComplexPropertySelection = {
    rdfType: { names: [""] },
    dataProps: [
        { names: ["alpha"], mandatory: false },
        { names: ["beta"], mandatory: false },
    ],
    objectProps: [],
};

// NOTE: Testing a previously-found bug that didn't visually update the comboboxes when one of the
// top level object properties were removed. Called this "property smearing" because the old values
// lingered, not reacting to changes unless combobox is focus and unfocused.
export const NoDataPropertySmearing: Story = {
    args: {
        selection: initialSelection,
    },
    play: async ({ userEvent, mount, args, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(
            <WrappedSelector args={args} />
        );

        function findCombobox(value: string) {
            return canvas.getAllByRole("combobox").find((el) => (el as any).value === value)
        }

        await step("Validate initial state", () => {
            expect(findCombobox("alpha")).not.toBeUndefined();
            expect(findCombobox("beta")).not.toBeUndefined();
        });

        await step("Press delete", async () => {
            const deleteButtons = canvas.queryAllByRole("button").filter((el) => el.innerHTML === "-");
            expect(deleteButtons).toHaveLength(initialSelection.dataProps.length);

            await user.click(deleteButtons[0]);
        });

        await step("Validate final state", () => {
            expect(findCombobox("alpha")).toBeUndefined();
            expect(findCombobox("beta")).not.toBeUndefined();
        });
    },
};

// NOTE: Testing a previously-found bug that didn't visually update the comboboxes when one of the
// top level object properties were removed. Called this "property smearing" because the old values
// lingered, not reacting to changes unless combobox is focus and unfocused.
export const NoObjectPropertySmearing: Story = {
    args: {
        selection: {
            rdfType: { names: [""] },
            dataProps: [],
            objectProps: [
                { names: ["alpha"], mandatory: false, selection: makeDefaultSelection() },
                { names: ["beta"], mandatory: false, selection: makeDefaultSelection() },
            ],
        },
    },
    play: async ({ userEvent, mount, args, step }) => {
        const initialSelection = args.selection!;
        const user = userEvent.setup({});

        const canvas = await mount(
            <WrappedSelector args={args} />
        );

        function findCombobox(value: string) {
            return canvas.getAllByRole("combobox").find((el) => (el as any).value === value)
        }

        await step("Validate initial state", () => {
            expect(findCombobox("alpha")).not.toBeUndefined();
            expect(findCombobox("beta")).not.toBeUndefined();
        });

        await step("Press delete", async () => {
            const deleteButtons = canvas.queryAllByRole("button").filter((el) => el.innerHTML === "-");
            expect(deleteButtons).toHaveLength(initialSelection.objectProps.length);

            await user.click(deleteButtons[0]);
        });

        await step("Validate final state", () => {
            expect(findCombobox("alpha")).toBeUndefined();
            expect(findCombobox("beta")).not.toBeUndefined();
        });
    },
};

export const DataPropLabelsAreShown: Story = {
    args: {
        selection: {
            rdfType: { names: [""] },
            dataProps: [
                { names: ["data_value"], mandatory: false },
            ],
            objectProps: [],
        },
        suggestionsFetcher: async ({ target }) => {
            if (target.kind !== "dataProp") return [];
            return [
                { label: "data_label", value: "data_value" },
            ];
        },
    },
    play: async ({ canvas }) => {
        const labeledValues = await canvas.findAllByDisplayValue("data_label");
        expect(labeledValues).not.toHaveLength(0);
    },
};

export const ObjectPropLabelsAreShown: Story = {
    args: {
        selection: {
            rdfType: { names: [""] },
            dataProps: [],
            objectProps: [
                { names: ["cool_value"], mandatory: false, selection: makeDefaultSelection() },
            ],
        },
        suggestionsFetcher: async ({ target }) => {
            if (target.kind !== "objectProp") return [];
            return [
                { label: "cool_label", value: "cool_value" },
            ];
        },
    },
    play: async ({ canvas }) => {
      expect(await canvas.findAllByDisplayValue("cool_label")).not.toHaveLength(0);
    },
};

type SuggestionsFetcher = ComponentProps<typeof ComplexPropertySelector>["suggestionsFetcher"]

function findCombobox(canvas: Canvas, value: string) {
    return canvas.getAllByRole("combobox").find((el) => (el as any).value === value)
}

export const ContextfulSuggestions: Story = {
    args: {},
    play: async ({ canvasElement, mount, userEvent, step }) => {
        // NOTE: Testing that contextful suggestions
        // NOTE: This test does not check for the order of suggestion function invokation

        // Array of contexts that are gathered during suggestion function invokation
        const callLog: SuggestionsFetcherContext[] = [];

        const defaultSelection = {
            rdfType: { names: ["someType"] },
            dataProps: [],
            objectProps: [{
                names: ["nestedPropA"], mandatory: false,
                selection: {
                    rdfType: { names: ["nestedType"] },
                    dataProps: [],
                    objectProps: [{
                        names: ["nestedPropB"], mandatory: false,
                        selection: {
                            rdfType: { names: ["finalNested"] },
                            dataProps: [{ names: ["finalNestedData"], mandatory: false }],
                            objectProps: [{
                                names: ["finalNestedObj"], mandatory: false,
                                selection: { rdfType: { names: [""] }, dataProps: [], objectProps: []},
                            }],
                        },
                    }],
                },
            }],
        } satisfies ComplexPropertySelection;

        const suggestionsFetcher: SuggestionsFetcher = async (ctx) => {
            callLog.push(ctx);
            return [];
        }
        const canvas = await mount(
            <ComplexPropertySelector {...{ defaultSelection, suggestionsFetcher }} />
        );

        // NOTE: Open all collapsible things within the component
        async function expandAllCollapsibles() {
            const selector = '[data-state="closed"] [data-slot="collapsible-trigger"]';

            let toOpen = [...canvasElement.querySelectorAll(selector)];

            // NOTE: Looping because nested collapsible get mounted after parent collapsible is
            // opened
            while (toOpen.length > 0) {
                await Promise.all(toOpen.map((it) => userEvent.click(it)));
                toOpen = [...canvasElement.querySelectorAll(selector)];
            }
        }

        await step("Expand all collapsibles", async () => {
            await expandAllCollapsibles();
        });

        const combobox = (val: string) => {
            const res = findCombobox(canvas, "finalNested");
            if (!res) throw `unexpected missing combobox "${val}"`;
            return res;
        }

        await step("Ensure suggestion calls", async () => {
            await userEvent.click(combobox("finalNested"));
            await userEvent.click(combobox("finalNestedData"));
            await userEvent.click(combobox("finalNestedObject"));
        })

        const defaultSelectionJson = JSON.stringify(defaultSelection);
        // NOTE: rootSelection should always be the same
        expect(
            callLog.filter((ctx) => JSON.stringify(ctx.rootSelection) !== defaultSelectionJson),
        ).toHaveLength(0);

        await step("Checking contexts", () => {
            const level1 = defaultSelection.objectProps[0].selection;
            const level2 = level1.objectProps[0].selection;
            const ancestors = [
                { names: ["nestedPropA"], mandatory: false, index: 0, selection: level1 },
                { names: ["nestedPropB"], mandatory: false, index: 0, selection: level2 },
            ];

            const expectedContext = (target: SuggestionsFetcherContext["target"]) => ({
                rootSelection: defaultSelection,
                selection: level2,
                ancestors,
                target,
            }) satisfies SuggestionsFetcherContext;

            expect(callLog).toContainEqual(expectedContext({ kind: "rdfType", valueIndex: 0 }));
            expect(callLog).toContainEqual(expectedContext({ kind: "dataProp", index: 0, valueIndex: 0 }));
            expect(callLog).toContainEqual(expectedContext({ kind: "objectProp", index: 0, valueIndex: 0 }));
        });
    }
}

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

export const AddAlternativeValues: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    rdfType: { names: ["firstType"] },
                    dataProps: [{ names: ["firstProp"], mandatory: false }],
                    objectProps: [],
                }}
            />
        );

        await step("Only the primary values are shown by default", () => {
            expect(canvas.getAllByRole("combobox")).toHaveLength(2);
            expect(canvas.queryByRole("textbox", { name: "Union alias" })).toBeNull();
        });

        await step("Add an alternative type", async () => {
            await user.click(canvas.getByRole("button", { name: "Add alternative type" }));
            expect(canvas.getAllByRole("combobox")).toHaveLength(3);
            await commitCustomValue(canvas.getAllByRole("combobox")[1], "altType");
        });

        await step("Add an alternative data property", async () => {
            await user.click(canvas.getByRole("button", { name: "Add alternative" }));
            expect(canvas.getAllByRole("combobox")).toHaveLength(4);
            await commitCustomValue(canvas.getAllByRole("combobox")[3], "altProp");
        });

        await step("Alias is shown once a data property has alternatives", () => {
            expect(canvas.getAllByRole("textbox", { name: "Union alias" })).toHaveLength(1);
        });

        await step("Each alternative is labeled with OR", () => {
            // NOTE: Only the two alternatives are labeled, primary values are not
            expect(canvas.getAllByText("OR")).toHaveLength(2);
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas)).toEqual({
                rdfType: { names: ["firstType", "altType"] },
                dataProps: [{ names: ["firstProp", "altProp"], mandatory: false }],
                objectProps: [],
            });
        });
    },
};

export const SetUnionAlias: Story = {
    args: {
        selection: {
            rdfType: { names: [""] },
            dataProps: [{ names: ["firstProp", "altProp"], mandatory: false }],
            objectProps: [],
        },
    },
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    rdfType: { names: [""] },
                    dataProps: [{ names: ["firstProp", "altProp"], mandatory: false }],
                    objectProps: [],
                }}
            />
        );

        await step("Alias is empty by default", () => {
            expect(readSelectionJson(canvas).dataProps[0]?.alias).toBeUndefined();
        });

        await step("Type an alias", async () => {
            await user.type(canvas.getByRole("textbox", { name: "Union alias" }), "unionName");
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).dataProps).toEqual([
                { names: ["firstProp", "altProp"], mandatory: false, alias: "unionName" },
            ]);
        });
    },
};

export const AlternativeObjectPropHasAlias: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    rdfType: { names: [""] },
                    dataProps: [],
                    objectProps: [{
                        names: ["objProp", "altObjProp"], mandatory: false,
                        selection: makeDefaultSelection(),
                    }],
                }}
            />
        );

        await step("Alias input is shown for a union object property", async () => {
            expect(canvas.getByRole("textbox", { name: "Union alias" })).not.toBeNull();
        });

        await step("Type an alias", async () => {
            await user.type(canvas.getByRole("textbox", { name: "Union alias" }), "contact");
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).objectProps).toEqual([{
                names: ["objProp", "altObjProp"], mandatory: false,
                alias: "contact",
                selection: makeDefaultSelection(),
            }]);
        });
    },
};

export const RemoveAlternativeValues: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    rdfType: { names: ["firstType", "altType"] },
                    dataProps: [{ names: ["firstProp", "altProp"], mandatory: false, alias: "unionName" }],
                    objectProps: [],
                }}
            />
        );

        await step("Remove alternative type", async () => {
            // NOTE: The first destroy button belongs to the alternative type
            const destroyButtons = canvas.getAllByRole("button", { name: "-" });
            await user.click(destroyButtons[0]);
        });

        await step("Remove alternative data property", async () => {
            // NOTE: Alternative data property is the last destroy button
            const destroyButtons = canvas.getAllByRole("button", { name: "-" });
            await user.click(destroyButtons[destroyButtons.length - 1]);
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas)).toEqual({
                rdfType: { names: ["firstType"] },
                dataProps: [{ names: ["firstProp"], mandatory: false, alias: "unionName" }],
                objectProps: [],
            });
            expect(canvas.queryByRole("textbox", { name: "Union alias" })).toBeNull();
        });
    },
};

export const AlternativeValuesHaveContext: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        // NOTE: Records every target that suggestions were requested for
        const targetLog: SuggestionsFetcherContext["target"][] = [];
        const suggestionsFetcher: SuggestionsFetcher = async (ctx) => {
            targetLog.push(ctx.target);
            return [];
        };

        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    rdfType: { names: ["firstType", ""] },
                    dataProps: [{ names: ["firstProp", ""], mandatory: false }],
                    objectProps: [],
                }}
                suggestionsFetcher={suggestionsFetcher}
            />
        );

        await step("Request suggestions for each alternative", async () => {
            // NOTE: Comboboxes are ordered: type, type alternative, data prop, data prop alternative
            const comboboxes = canvas.getAllByRole("combobox");
            await user.click(comboboxes[1]);
            await user.click(comboboxes[3]);
        });

        await step("Validate targets", () => {
            expect(targetLog).toContainEqual({ kind: "rdfType", valueIndex: 1 });
            expect(targetLog).toContainEqual({ kind: "dataProp", index: 0, valueIndex: 1 });
        });
    },
};

export const TogglePropOptionality: Story = {
    args: {},
    play: async ({ mount, userEvent, step }) => {
        const user = userEvent.setup({});

        const canvas = await mount(
            <SelectionJsonProbe
                defaultSelection={{
                    rdfType: { names: [""] },
                    dataProps: [{ names: ["dataProp"], mandatory: false }],
                    objectProps: [{ names: ["objProp"], mandatory: false, selection: makeDefaultSelection() }],
                }}
            />
        );

        await step("Props are optional by default", () => {
            expect(canvas.getAllByRole("button", { name: "Optional" })).toHaveLength(2);
        });

        await step("Make data prop mandatory", async () => {
            await user.click(canvas.getAllByRole("button", { name: "Optional" })[0]!);
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).dataProps).toEqual([
                { names: ["dataProp"], mandatory: true },
            ]);
            expect(readSelectionJson(canvas).objectProps[0]?.mandatory).toBe(false);
        });

        await step("Button shows the new state", () => {
            expect(canvas.getByRole("button", { name: "Mandatory" })).not.toBeNull();
        });

        await step("Toggle back to optional", async () => {
            await user.click(canvas.getByRole("button", { name: "Mandatory" }));
        });

        await step("Validate selection", () => {
            expect(readSelectionJson(canvas).dataProps).toEqual([
                { names: ["dataProp"], mandatory: false },
            ]);
        });
    },
};
