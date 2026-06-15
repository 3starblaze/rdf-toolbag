import type { Meta, StoryObj } from '@storybook/react-vite';
import { MultiCardinalTableServer } from './multi-cardinal-table';


const meta = {
  title: "components/MultiCardinalTable",
  component: MultiCardinalTableServer,
} satisfies Meta<typeof MultiCardinalTableServer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    rows: [],
  },
};

export const WithData: Story = {
  args: {
    rows: [
      {
        idCols: [":key0", ":key1"],
        idValues: {
          ":key0": "AA",
          ":key1": "BB",
        },
        restCols: [":value0", ":value1", ":value2"],
        restValues: {
          ":value0": ["Something"],
          ":value1": ["One thing", "Or another"],
          ":value2": ["I'm fine"],
        },
      },
      {
        idCols: [":key0", ":key1"],
        idValues: {
          ":key0": "AA",
          ":key1": "CC",
        },
        restCols: [":value0", ":value1", ":value2"],
        restValues: {
          ":value0": ["This", "one", "has", "a", "few", "items"],
          ":value1": ["nothing in the next column"],
          ":value2": [],
        },
      },
      {
        idCols: [":key0", ":key1"],
        idValues: {
          ":key0": "AA",
          ":key1": "DD",
        },
        restCols: [":value0", ":value1", ":value2"],
        restValues: {
          ":value0": ["Something"],
          ":value1": ["One thing", "Or another"],
          ":value2": ["I'm fine"],
        },
      },
      {
        idCols: [":key0", ":key1"],
        idValues: {
          ":key0": "BB",
          ":key1": "CC",
        },
        restCols: [":value0", ":value1", ":value2"],
        restValues: {
          ":value0": ["Something"],
          ":value1": ["One thing", "Or another"],
          ":value2": ["I'm fine"],
        },
      },
      {
        idCols: [":key0", ":key1"],
        idValues: {
          ":key0": "BB",
          ":key1": "DD",
        },
        restCols: [":value0", ":value1", ":value2"],
        restValues: {
          ":value0": ["Something"],
          ":value1": ["One thing", "Or another"],
          ":value2": ["I'm fine"],
        },
      },
    ],
  },
};
