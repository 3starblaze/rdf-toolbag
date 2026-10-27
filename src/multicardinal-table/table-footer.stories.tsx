import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { TableFooter } from './TableFooter';

const meta = {
  title: "multicardinal-table/TableFooter",
  component: TableFooter,
  args: {
    pagination: { pageIndex: 0, pageSize: 10 },
    onPaginationChange: fn(),
    hasNextPage: false,
  },
} satisfies Meta<typeof TableFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPageWithoutNext: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[data-current-page]")).toHaveTextContent("1");
    await expect(canvas.getByRole("button", { name: "<<" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "<" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: ">" })).toBeDisabled();
  },
};

export const FirstPageWithNext: Story = {
  args: { hasNextPage: true },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: "<<" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "<" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: ">" })).toBeEnabled();

    await userEvent.click(canvas.getByRole("button", { name: ">" }));
    await expect(args.onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 });
  },
};

export const MiddlePage: Story = {
  args: {
    pagination: { pageIndex: 2, pageSize: 20 },
    hasNextPage: true,
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[data-current-page]")).toHaveTextContent("3");
    await expect(canvas.getByRole("button", { name: "<<" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "<" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: ">" })).toBeEnabled();
  },
};

export const PreviousPage: Story = {
  args: {
    pagination: { pageIndex: 2, pageSize: 20 },
    hasNextPage: true,
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "<" }));
    await expect(args.onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 20 });
  },
};

export const FirstPageButton: Story = {
  args: {
    pagination: { pageIndex: 3, pageSize: 10 },
    hasNextPage: true,
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "<<" }));
    await expect(args.onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 });
  },
};

export const LastPageWithoutNext: Story = {
  args: {
    pagination: { pageIndex: 4, pageSize: 10 },
    hasNextPage: false,
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[data-current-page]")).toHaveTextContent("5");
    await expect(canvas.getByRole("button", { name: ">" })).toBeDisabled();
  },
};

// NOTE: There is no total count, so there is no last page button
export const NoLastPageButton: Story = {
  args: { hasNextPage: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: ">>" })).not.toBeInTheDocument();
  },
};

export const ChangePageSize: Story = {
  args: {
    pagination: { pageIndex: 2, pageSize: 10 },
    hasNextPage: true,
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox"));
    // NOTE: The options are rendered in a portal, so they are outside of the canvas
    await userEvent.click(await within(document.body).findByRole("option", { name: "50" }));
    await expect(args.onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 50 });
  },
};
