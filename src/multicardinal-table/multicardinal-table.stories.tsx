import type { Meta, StoryObj } from '@storybook/react-vite';
import { MultiCardinalTableServer } from './index';
import { defaultColumn, type Props } from './shared';
import { useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import type { SparqlTableResult, RdfTerm } from '@/sparql_queries';
import type { PaginationState } from '@tanstack/react-table';

const meta = {
  title: "multicardinal-table/MultiCardinalTable",
  component: MultiCardinalTableServer,
} satisfies Meta<typeof MultiCardinalTableServer>;

export default meta;
type Story = StoryObj<typeof meta>;

type QueryCallback = Props["queryCallback"];

// NOTE: Mirrors the variable names used by `MulticardinalTableBody`'s cell queries
const PROP_NAME_VAR = "__propName";
const PROP_VAL_VAR = "__propVal";

interface Group {
  idValues: { [k: string]: RdfTerm },
  restValues: { [k: string]: RdfTerm[] },
}

const lit = (v: string): RdfTerm => ({ type: "literal", value: v });

function withKeys(idVars: string[], keys: Group["idValues"][]): SparqlTableResult {
  return {
    head: { vars: idVars },
    results: { bindings: keys },
  };
}

// NOTE: Cell queries return one row per (key, column, value), see `formatPaginatedQuery`
function withCells(groups: Group[]): SparqlTableResult {
  const rows = groups.flatMap(({ idValues, restValues }) => {
    return Object.entries(restValues).flatMap(([column, values]) => values.map((v) => ({
      ...Object.fromEntries(Object.entries(idValues).map(([k, t]) => [k, t.value])),
      [PROP_NAME_VAR]: column,
      [PROP_VAL_VAR]: v.value,
    })));
  });

  if (rows.length === 0) return { head: { vars: [] }, results: { bindings: [] } };

  return {
    head: { vars: Object.keys(rows[0]) },
    results: { bindings: rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, { type: "literal", value: v }] as const),
    )) },
  };
}

function inferPagination(query: string): PaginationState | null {
  const reRes = query.match(/LIMIT\s+(\d+)\s+OFFSET\s+(\d+)/);

  if (!reRes) return null;

  const pageSize = Number(reRes[1]);

  return {
    pageIndex: Number(reRes[2]) / pageSize,
    pageSize,
  };
}

/**
 * Serves key queries (paginated by LIMIT/OFFSET) and cell queries from an in-memory dataset.
 */
function datasetCallback(idVars: string[], groups: Group[]): QueryCallback {
  return async ({ query }) => {
    if (query.includes(PROP_NAME_VAR)) return withCells(groups);

    const pagination = inferPagination(query);
    const keys = groups.map((it) => it.idValues);
    const pageKeys = pagination
      ? keys.slice(pagination.pageIndex * pagination.pageSize, (pagination.pageIndex + 1) * pagination.pageSize)
      : keys;

    return withKeys(idVars, pageKeys);
  };
}

function waitForLoaded(canvas: { queryByRole: (role: string) => HTMLElement | null }) {
  return waitFor(() => expect(canvas.queryByRole("status")).not.toBeInTheDocument());
}

function delayPromise(delay: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

function delayed<T>(
  delay: number,
  cb: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    await delayPromise(delay);
    return await cb();
  };
}

// NOTE: Its projected variables decide which columns get requested, and it has to parse because
// the key and cell queries are formatted from it. The mock ignores it otherwise.
const defaultBaseQuery = `SELECT ?key0 ?key1 ?value0 ?value1 ?value2 ?valueConst WHERE {
  ?s ?p ?o
  BIND(?s AS ?key0)
  BIND(?p AS ?key1)
  BIND(?o AS ?value0)
  BIND(?o AS ?value1)
  BIND(?o AS ?value2)
  BIND(?o AS ?valueConst)
}`;

const defaultArgs: Omit<Story["args"], "queryCallback"> = {
  baseQuery: defaultBaseQuery,
  counterLimit: 10_000_000,
  rawRowLimit: 100_000,
  idVars: [],
};

// NOTE: 25 keys so that there are 3 pages at page size 10
function pagedGroups(): Group[] {
  return Array(25)
    .fill(undefined)
    .map((_, i) => ({
      idValues: {
        "key0": lit("A"),
        "key1": lit(`B${i}`),
      },
      restValues: {
        "value0": [lit("Something")],
        "valueConst": [lit("i stay the same")],
      },
    }));
}

const dataWithTwoKeys: Group[] = [
  {
    idValues: { "key0": lit("AA"), "key1": lit("BB") },
    restValues: {
      "value0": [lit("Something")],
      "value1": [lit("One thing"), lit("Or another")],
      "value2": [lit("I'm fine")],
    },
  },
  {
    idValues: { "key0": lit("AA"), "key1": lit("CC") },
    restValues: {
      "value0": [lit("This"), lit("one"), lit("has"), lit("a"), lit("few"), lit("items")],
      "value1": [lit("nothing in the next column")],
      "value2": [],
    },
  },
  {
    idValues: { "key0": lit("AA"), "key1": lit("DD") },
    restValues: {
      "value0": [lit("Something")],
      "value1": [lit("One thing"), lit("Or another")],
      "value2": [lit("I'm fine")],
    },
  },
  {
    idValues: { "key0": lit("BB"), "key1": lit("CC") },
    restValues: {
      "value0": [lit("Something")],
      "value1": [lit("One thing"), lit("Or another")],
      "value2": [lit("I'm fine")],
    },
  },
  {
    idValues: { "key0": lit("BB"), "key1": lit("DD") },
    restValues: {
      "value0": [lit("Something")],
      "value1": [lit("One thing"), lit("Or another")],
      "value2": [lit("I'm fine")],
    },
  },
];

export const Empty: Story = {
  args: {
    ...defaultArgs,
    queryCallback: datasetCallback([], []),
  },
  play: async ({ canvas }) => {
    const emptyMsg = await canvas.findByText("No results.");
    expect(emptyMsg).toBeInTheDocument();
  },
};

export const WithData: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: datasetCallback(["key0", "key1"], dataWithTwoKeys),
  },
  play: async ({ canvas, step }) => {
    await waitForLoaded(canvas);

    // NOTE: Cells are loaded after the keys, so their content can appear later than the spinner
    // going away.
    await step("Id values are shown", async () => {
      // NOTE: Keys repeat across rows, so they are matched by all occurrences
      expect(await canvas.findAllByText("AA")).not.toHaveLength(0);
      expect(canvas.getAllByText("BB")).not.toHaveLength(0);
    });

    await step("Cell values are shown", async () => {
      expect(await canvas.findByText("nothing in the next column")).toBeInTheDocument();
      expect(canvas.getAllByText("Something")).not.toHaveLength(0);
      expect(canvas.getAllByText("One thing")).not.toHaveLength(0);
    });

    await step("No empty state", () => {
      expect(canvas.queryByText("No results.")).not.toBeInTheDocument();
    });
  },
};

export const WithPagination: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: async () => withKeys([], []),
  },
  // NOTE: Disable arguments in UI that will be overriden regardless
  argTypes: {
    pagination: { control: false },
    onPaginationChange: { control: false },
  },
  render: ({ ...args }) => {
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

    return (
      <MultiCardinalTableServer
        {...args}
        queryCallback={datasetCallback(["key0", "key1"], pagedGroups())}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    );
  },
  play: async ({ canvas, userEvent, canvasElement, step }) => {
    const currentPageNumber = canvasElement.querySelector('[data-current-page]');
    const nextPageButton = canvas.getByText(">");

    await waitForLoaded(canvas);

    await step("First page is shown", async () => {
      expect(currentPageNumber).toHaveTextContent("1");
      expect(await canvas.findByText("B0")).toBeInTheDocument();
      expect(canvas.queryByText("B10")).not.toBeInTheDocument();
    });

    await step("Next page is shown", async () => {
      await userEvent.click(nextPageButton);

      expect(currentPageNumber).toHaveTextContent("2");
      // NOTE: Rows are remounted while the page is loading, so the element is looked up on every try
      await waitFor(() => expect(canvas.getByText("B10")).toBeInTheDocument());
      expect(canvas.queryByText("B0")).not.toBeInTheDocument();
    });
  },
};

export const CustomColumn: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: datasetCallback(["key0", "key1"], [{
      idValues: {
        "key0": lit("AA"),
        "key1": lit("BB"),
      },
      restValues: {
        "value0": [lit("val0"), lit("val1"), lit("val2")],
        "valueConst": [lit("i stay the same")],
      },
    }]),
    renderHeader: (name) => {
      function colorCn(key: string): string {
        switch (key) {
          case "key0": return "bg-red-500";
          case "key1": return "bg-blue-500";
          case "value0": return "bg-green-400";
          case "valueConst": return "bg-yellow-400";
        }
        return "";
      }

      return (
        <div className="flex items-center gap-2 p-2">
          <div className={`size-4 rounded-sm ${colorCn(name)}`} />
          <p className="text-lg">{name}</p>
          <div className={`size-4 rounded-sm ${colorCn(name)}`} />
        </div>
      );
    },
  },
  play: async ({ canvas, step }) => {
    await step("Custom headers are rendered", async () => {
      expect(await canvas.findByText("key0")).toBeInTheDocument();
      // NOTE: Value columns are only known once their cells are loaded
      expect(await canvas.findByText("valueConst")).toBeInTheDocument();
    });

    await step("Custom cell values are rendered", async () => {
      expect(await canvas.findByText("val1")).toBeInTheDocument();
    });
  },
};

export const CanOverpageOnNoSizeInformation: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: datasetCallback(["key0", "key1"], pagedGroups()),
  },
  play: async ({ canvas, userEvent, canvasElement, step }) => {
    const currentPageNumberInitial = canvasElement.querySelector('[data-current-page]');
    const nextPageButton = canvas.getByText(">");

    await step("Assert initial state", async () => {
      await waitForLoaded(canvas);

      expect(nextPageButton).not.toBeDisabled();

      const lastPageButton = canvas.getByText(">>");

      // NOTE: Page count is not known and neither is the last page
      expect(lastPageButton).toBeDisabled();

      expect(currentPageNumberInitial).toBeInTheDocument();
      expect(currentPageNumberInitial).toHaveTextContent("1");
    });

    await step("Page can be changed", async () => {
      await userEvent.click(nextPageButton);

      expect(currentPageNumberInitial).toHaveTextContent("2");
    });
  },
};

export const Resizable: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: datasetCallback(["key0", "key1"], dataWithTwoKeys),
  },
  play: async ({ userEvent, canvas, canvasElement, step }) => {
    await waitForLoaded(canvas);
    await canvas.findAllByText("AA");

    const columnIndex = 1;
    const dragHandle = canvasElement.querySelector(`[data-column-index="${columnIndex}"]`);
    if (!dragHandle) throw "Unexpected missing drag handle!";

    const col = canvasElement.querySelector(
      `table > thead > tr > :nth-child(${columnIndex + 1})`
    );

    if (!col) throw "Unexpected missing column element!";

    const from = { clientX: 800, clientY: 100 };
    const to = { clientX: 10, clientY: 10 };

    // NOTE: How much we move horizontally (signed)
    const dx = to.clientX - from.clientX;
    // NOTE: minimal amount of delta to apply to reach smallest size (signed)
    const minimalDx = defaultColumn.minSize - defaultColumn.size;

    await step("Initial checks", () => {
      expect(dx).toBeLessThanOrEqual(minimalDx);
      expect(col.clientWidth).toBe(defaultColumn.size);
    });

    await step("Resizing", async () => {
      await userEvent.pointer([
        { keys: '[MouseLeft>]', coords: from, target: dragHandle },
        { coords: to, target: dragHandle },
        { keys: '[/MouseLeft]' },
      ]);

      expect(col.clientWidth).toBe(defaultColumn.minSize);
    });
  },
};

export const QueryFailure: Story = {
  args: {
    ...defaultArgs,
    queryCallback: async () => {
      throw new Error("failure");
    },
  },
  play: async ({ canvas }) => {
    // NOTE: Query is retried by the query client before the error is shown
    const errorMsg = await canvas.findByText("error", { exact: false }, { timeout: 15_000 });
    expect(errorMsg).toBeInTheDocument();

    const retryButton = canvas.getByText("retry", { exact: false });
    expect(retryButton).toBeInTheDocument();
  },
};

export const SlowSuccessfulQuery: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: delayed(1000, async () => {
      return withCells([{
        idValues: { "key0": lit("AA"), "key1": lit("BB") },
        restValues: { "value0": [lit("query successful")] },
      }]);
    }),
  },
  play: async ({ canvas, step }) => {
    await step("Spinner is shown while loading", async () => {
      const spinner = await canvas.findByRole("status");
      expect(spinner).toBeInTheDocument();
    });

    await step("Data is shown after loading", async () => {
      const tableItem = await canvas.findByText("query successful", {}, { timeout: 5_000 });
      expect(tableItem).toBeInTheDocument();

      await waitForLoaded(canvas);
    });
  },
};

// NOTE: Shared between the query callback and play function of `SlowQueryFailThenSucceed`
const flakyQuery = { failing: true };

export const SlowQueryFailThenSucceed: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: delayed(1000, async () => {
      if (flakyQuery.failing) throw new Error("womp womp");

      return withCells([{
        idValues: { "key0": lit("AA"), "key1": lit("BB") },
        restValues: { "value0": [lit("query successful")] },
      }]);
    }),
  },
  play: async ({ canvas, userEvent, step }) => {
    flakyQuery.failing = true;

    await step("Wait for error", async () => {
      const errorMsg = await canvas.findByText("error", { exact: false }, { timeout: 15_000 });
      expect(errorMsg).toBeInTheDocument();
    });

    await step("Wait for data", async () => {
      flakyQuery.failing = false;

      const retryButton = canvas.getByText("retry", { exact: false });
      await userEvent.click(retryButton);

      // NOTE: Keys and then cells are fetched, each with a delay
      const tableItem = await canvas.findByText("query successful", {}, { timeout: 5_000 });
      expect(tableItem).toBeInTheDocument();
    });
  },
};

// NOTE: Delays keys and cells separately so that each loading stage can be observed
function stagedCallback(keyDelay: number, cellDelay: number, callback: QueryCallback): QueryCallback {
  return async (args) => {
    await delayPromise(args.query.includes(PROP_NAME_VAR) ? cellDelay : keyDelay);
    return callback(args);
  };
}

export const LoadingSpinners: Story = {
  args: {
    ...defaultArgs,
    idVars: ["key0", "key1"],
    queryCallback: stagedCallback(1000, 2000, datasetCallback(["key0", "key1"], [{
      idValues: { "key0": lit("AA"), "key1": lit("BB") },
      restValues: { "value0": [lit("query successful")] },
    }])),
  },
  play: async ({ canvas, step }) => {
    await step("Spinner is shown while keys and rest values are loading", async () => {
      expect(await canvas.findByRole("status")).toBeInTheDocument();
      expect(canvas.queryByText("AA")).not.toBeInTheDocument();
      expect(canvas.queryByText("query successful")).not.toBeInTheDocument();
    });

    await step("Keys are shown with spinner in rest values while rest values are loading", async () => {
      expect(await canvas.findByText("AA")).toBeInTheDocument();
      expect(canvas.getByRole("status")).toBeInTheDocument();
      expect(canvas.queryByText("query successful")).not.toBeInTheDocument();
    });

    await step("No spinner is shown when everything is loaded", async () => {
      expect(await canvas.findByText("query successful", {}, { timeout: 5_000 })).toBeInTheDocument();
      // NOTE: Every column is fetched separately, so the spinner can outlast the first cell
      await waitForLoaded(canvas);
    });
  },
};
