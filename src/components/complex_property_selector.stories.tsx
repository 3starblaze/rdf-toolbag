import type { Meta, StoryObj } from '@storybook/react-vite';
import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection, type SuggestionsFetcherContext } from './complex_property_selector';
import { expect } from 'storybook/test';
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
            rdfType: "http://myType",
            dataProps: [
                { name: "http://dataProp0" },
                { name: "http://dataProp1" },
            ],
            objectProps: [
                { name: "http://objProp0", selection: makeDefaultSelection() },
                { name: "http://objProp1", selection: makeDefaultSelection() },
                { name: "http://objProp2", selection: makeDefaultSelection() },
            ],
        },
    },
    render: syncedRender,
};


export const WithPropSuggestions: Story = {
  args: {
      suggestionsFetcher: async (ctx) => {
          const {rdfType} = ctx.selection;

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
                      const finalName = rdfType ?? "noClass";

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
                name: "http://lookDeeper",
                selection: {
                    ...makeDefaultSelection(),
                    objectProps: [{
                        name: "http://lookAgain",
                        selection: {
                            ...makeDefaultSelection(),
                            objectProps: [{
                                name: "http://andOnceAgain",
                                selection: {
                                    ...makeDefaultSelection(),
                                    objectProps: [{
                                        name: "http://okThatsIt",
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
            rdfType: "mytype",
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
            rdfType: "initialType",
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
                        rdfType: "freshType",
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
        rdfType: "initialType",
        dataProps: [],
        objectProps: [],
    });

    return (
        <>
            <button onClick={() => setSelection({ ...selection, rdfType: "freshType" })}>
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
    rdfType: "",
    dataProps: [
        { name: "alpha" },
        { name: "beta" },
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
            rdfType: "",
            dataProps: [],
            objectProps: [
                { name: "alpha", selection: makeDefaultSelection() },
                { name: "beta", selection: makeDefaultSelection() },
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
            rdfType: "",
            dataProps: [
                { name: "data_value" },
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
            rdfType: "",
            dataProps: [],
            objectProps: [
                { name: "cool_value", selection: makeDefaultSelection() },
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
            rdfType: "someType",
            dataProps: [],
            objectProps: [{
                name: "nestedPropA",
                selection: {
                    rdfType: "nestedType",
                    dataProps: [],
                    objectProps: [{
                        name: "nestedPropB",
                        selection: {
                            rdfType: "finalNested",
                            dataProps: [{ name: "finalNestedData" }],
                            objectProps: [{
                                name: "finalNestedObj",
                                selection: { rdfType: "", dataProps: [], objectProps: []},
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
                { name: "nestedPropA", index: 0, selection: level1 },
                { name: "nestedPropB", index: 0, selection: level2 },
            ];

            const expectedContext = (target: SuggestionsFetcherContext["target"]) => ({
                rootSelection: defaultSelection,
                selection: level2,
                ancestors,
                target,
            }) satisfies SuggestionsFetcherContext;

            expect(callLog).toContainEqual(expectedContext({ kind: "rdfType" }));
            expect(callLog).toContainEqual(expectedContext({ kind: "dataProp", index: 0 }));
            expect(callLog).toContainEqual(expectedContext({ kind: "objectProp", index: 0 }));
        });
    }
}
