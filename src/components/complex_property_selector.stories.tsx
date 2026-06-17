import type { Meta, StoryObj } from '@storybook/react-vite';
import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from './complex_property_selector';
import { expect } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import { useState } from 'react';

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
    rdfTypeFetcher: async () => {
      return [
        { value: 'http://typeAlpha', label: ":typeAlpha" },
        { value: 'http://typeBeta', label: ":typeBeta" },
        { value: 'http://typeGamma', label: ":typeGamma" },
      ];
    },
    dataPropFetcher: async (rdfType) => {
      const finalName = rdfType?.split("//").slice(-1)[0] ?? "noClass";

      const fmtItem = (i: number) => ({
        value: `http://${finalName}/suggestedData${i}`,
        label: `${finalName}:suggestedData${i}`,
      });

      return [
        fmtItem(0),
        fmtItem(1),
        fmtItem(2),
      ];
    },
    objectPropFetcher: async (rdfType) => {
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
        dataPropFetcher: async () => {
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
        objectPropFetcher: async () => {
            return [
                { label: "cool_label", value: "cool_value" },
            ];
        },
    },
    play: async ({ canvas }) => {
      expect(await canvas.findAllByDisplayValue("cool_label")).not.toHaveLength(0);
    },
};
