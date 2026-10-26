import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import type { RdfTerm } from '@/sparql_queries';
import { TermDisplay } from './TermDisplay';

// NOTE: Terms are rendered inside a fixed-width cell so that long values have to wrap or be cut off
const CONTAINER_WIDTH = 120;
const CONTAINER_TEST_ID = "term-container";

const meta = {
  title: "multicardinal-table/TermDisplay",
  component: TermDisplay,
  decorators: [
    (Story) => (
      <div data-testid={CONTAINER_TEST_ID} style={{ width: CONTAINER_WIDTH }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TermDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

const LONG_TEXT = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor";
// NOTE: A single word that cannot fit into the cell, so it can only be cut off with an ellipsis
const UNBREAKABLE_WORD = "adipiscingelitseddoeiusmodtemporincididuntutlaboreetdolore";

function getContainer(canvasElement: HTMLElement): HTMLElement {
  const container = canvasElement.querySelector<HTMLElement>(`[data-testid="${CONTAINER_TEST_ID}"]`);
  if (!container) throw new Error("Story container not found");
  return container;
}

function getTermRoot(canvasElement: HTMLElement): HTMLElement {
  const root = getContainer(canvasElement).firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("Term root not found");
  return root;
}

// NOTE: Splits the rendered text into visual lines by grouping characters with the same top position
function getVisualLines(el: HTMLElement): string[] {
  const lines: { top: number, text: string }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const data = node.textContent ?? "";
    for (let i = 0; i < data.length; i++) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const top = Math.round(range.getBoundingClientRect().top);
      const last = lines.at(-1);
      if (last && last.top === top) {
        last.text += data[i];
      } else {
        lines.push({ top, text: data[i] });
      }
    }
    node = walker.nextNode();
  }
  return lines.map((line) => line.text);
}

async function expectFitsCell(canvasElement: HTMLElement) {
  const container = getContainer(canvasElement);
  const root = getTermRoot(canvasElement);

  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  await expect(root.getBoundingClientRect().right).toBeLessThanOrEqual(container.getBoundingClientRect().right);
}

async function expectCutOffWithEllipsis(canvasElement: HTMLElement) {
  const root = getTermRoot(canvasElement);

  await expect(getComputedStyle(root).textOverflow).toBe("ellipsis");
  await expect(getComputedStyle(root).overflow).toBe("hidden");
  // NOTE: The overflowing word is clipped by the cell, so its content is wider than the box
  await expect(root.scrollWidth).toBeGreaterThan(root.clientWidth);
}

export const PlainString: Story = {
  args: { term: { type: "literal", value: "Hello" } satisfies RdfTerm },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Hello")).toBeInTheDocument();
    await expect(canvas.queryByText(/^@/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};

export const LanguageTaggedString: Story = {
  args: { term: { type: "literal", value: "Bonjour", "xml:lang": "fr" } satisfies RdfTerm },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Bonjour")).toBeInTheDocument();
    await expect(canvas.getByText("@fr")).toBeInTheDocument();
  },
};

export const TypedLiteral: Story = {
  args: {
    term: {
      type: "literal",
      value: "42",
      datatype: "http://www.w3.org/2001/XMLSchema#integer",
    } satisfies RdfTerm,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("42")).toBeInTheDocument();
    await expect(canvas.queryByText(/^@/)).not.toBeInTheDocument();
  },
};

export const Uri: Story = {
  args: { term: { type: "uri", value: "https://example.org/resource/1" } satisfies RdfTerm },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "https://example.org/resource/1" });
    await expect(link).toHaveAttribute("href", "https://example.org/resource/1");
  },
};

export const BlankNode: Story = {
  args: { term: { type: "bnode", value: "b0" } satisfies RdfTerm },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("p")?.textContent).toBe("_:b0");
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};

export const ShortStringFitsOnOneLine: Story = {
  args: { term: { type: "literal", value: "Short" } satisfies RdfTerm },
  play: async ({ canvasElement }) => {
    await expect(getVisualLines(getTermRoot(canvasElement))).toEqual(["Short"]);
    await expectFitsCell(canvasElement);
  },
};

export const LongStringWrapsAtSpaces: Story = {
  args: { term: { type: "literal", value: LONG_TEXT } satisfies RdfTerm },
  play: async ({ canvasElement }) => {
    await expectFitsCell(canvasElement);
    const lines = getVisualLines(getTermRoot(canvasElement));
    // NOTE: Every line but the last ends at a space boundary, so no word is split
    await expect(lines.length).toBeGreaterThan(1);
    await expect(lines.slice(0, -1).every((line) => line.endsWith(" "))).toBe(true);
    await expect(lines.join("")).toBe(LONG_TEXT);
  },
};

export const LongLanguageTaggedStringKeepsLanguageOnLastLine: Story = {
  args: { term: { type: "literal", value: LONG_TEXT, "xml:lang": "en" } satisfies RdfTerm },
  play: async ({ canvas, canvasElement }) => {
    await expectFitsCell(canvasElement);
    const lines = getVisualLines(getTermRoot(canvasElement));
    await expect(lines.at(-1)).toContain("@en");
    await expect(canvas.getByText("@en")).toBeInTheDocument();
  },
};

export const LongUriWrapsAtSlashes: Story = {
  args: { term: { type: "uri", value: `https://example.org/${LONG_TEXT.replaceAll(" ", "/")}` } satisfies RdfTerm },
  play: async ({ canvasElement }) => {
    await expectFitsCell(canvasElement);
    const lines = getVisualLines(getTermRoot(canvasElement));
    // NOTE: Every line but the last ends with a slash, so the URI keeps its path segments intact
    await expect(lines.length).toBeGreaterThan(1);
    await expect(lines.slice(0, -1).every((line) => line.endsWith("/"))).toBe(true);
    await expect(lines.join("")).toBe(`https://example.org/${LONG_TEXT.replaceAll(" ", "/")}`);
  },
};

export const LongUriWithUnbreakableSegmentIsCutOffWithEllipsis: Story = {
  args: { term: { type: "uri", value: `https://example.org/${UNBREAKABLE_WORD}` } satisfies RdfTerm },
  play: async ({ canvasElement }) => {
    await expectCutOffWithEllipsis(canvasElement);
    const lines = getVisualLines(getTermRoot(canvasElement));
    // NOTE: The word is never split by character, it stays whole on its own line
    await expect(lines.at(-1)).toBe(UNBREAKABLE_WORD);
    await expect(lines.slice(0, -1).every((line) => line.endsWith("/"))).toBe(true);
  },
};

export const LongBlankNodeWithoutBreakPointsIsCutOffWithEllipsis: Story = {
  args: { term: { type: "bnode", value: UNBREAKABLE_WORD } satisfies RdfTerm },
  play: async ({ canvasElement }) => {
    await expectCutOffWithEllipsis(canvasElement);
    await expect(getVisualLines(getTermRoot(canvasElement))).toEqual([`_:${UNBREAKABLE_WORD}`]);
  },
};
