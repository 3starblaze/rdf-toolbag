import type { Meta, StoryObj } from '@storybook/react-vite';
import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from './complex_property_selector';
import { useState } from 'react';
import { useArgs } from 'storybook/preview-api';

const meta = {
  title: "Components/ComplexPropertySelector",
  component: ComplexPropertySelector,
} satisfies Meta<typeof ComplexPropertySelector>;

export default meta;

type Story = StoryObj<typeof meta>;

// NOTE: We are syncing args, so that storybook reflects the new structure
const syncedRender: Story["render"] = (oldArgs) => {
    const [args, setArgs] = useArgs<typeof oldArgs>();

    function onSelectionChange(selection: ComplexPropertySelection) {
        setArgs({ ...args, selection });
    }

    return (
        <ComplexPropertySelector {...{ ...args, onSelectionChange }} />
    );
};

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
