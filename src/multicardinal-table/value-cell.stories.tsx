import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import type { RdfTerm } from '@/sparql_queries';
import { ValueCell } from './ValueCell';

const meta = {
  title: "multicardinal-table/ValueCell",
  component: ValueCell,
  args: {
    value: { data: [], isPending: false, isError: false },
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
  args: { value: { data: [], isPending: false, isError: false } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(0);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

export const Values: Story = {
  args: { value: { data: VALUES, isPending: false, isError: false } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(VALUES.length);
    await expect(canvas.getByText("Hello")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "https://example.org/resource/1" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const WithIncreaseLimitButton: Story = {
  args: { value: { data: VALUES, isPending: false, isError: false }, onIncreaseLimit: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onIncreaseLimit).toHaveBeenCalledTimes(1);
  },
};

export const Loading: Story = {
  args: { value: { data: VALUES, isPending: true, isError: false }, onIncreaseLimit: fn() },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    // NOTE: While loading, neither the values nor the button are shown
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(0);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  args: { value: { data: [], isPending: false, isError: true }, onRetry: fn(), onIncreaseLimit: fn() },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Could not get data")).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(0);
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
    // NOTE: Only the retry button is shown, there is no limit to increase
    await expect(canvas.getAllByRole("button")).toHaveLength(1);
  },
};

export const ErrorRetry: Story = {
  args: { value: { data: [], isPending: false, isError: true }, onRetry: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const ErrorWithoutRetry: Story = {
  args: { value: { data: [], isPending: false, isError: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Could not get data")).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
