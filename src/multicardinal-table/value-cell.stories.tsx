import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import type { RdfTerm } from '@/sparql_queries';
import { ValueCell } from './ValueCell';

const meta = {
  title: "multicardinal-table/ValueCell",
  component: ValueCell,
  args: {
    values: [],
  },
} satisfies Meta<typeof ValueCell>;

export default meta;
type Story = StoryObj<typeof meta>;

const VALUES: RdfTerm[] = [
  { type: "literal", value: "Hello" },
  { type: "uri", value: "https://example.org/resource/1" },
  { type: "bnode", value: "b0" },
];

export const Empty: Story = {
  args: { values: [] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(0);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

export const Values: Story = {
  args: { values: VALUES },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(VALUES.length);
    await expect(canvas.getByText("Hello")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "https://example.org/resource/1" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const WithIncreaseLimitButton: Story = {
  args: { values: VALUES, onIncreaseLimit: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onIncreaseLimit).toHaveBeenCalledTimes(1);
  },
};

export const Loading: Story = {
  args: { values: VALUES, loading: true, onIncreaseLimit: fn() },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    // NOTE: While loading, neither the values nor the button are shown
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(0);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
