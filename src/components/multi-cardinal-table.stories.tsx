import type { Meta, StoryObj } from '@storybook/react-vite';
import { defaultColumn } from './multi-cardinal-table';
import { MultiCardinalTableServer } from './MultiCardinalTableServer2';
import { useState, useRef } from 'react';
import type { MulticardinalRow } from '@/multi-cardinal-table-util';
import { expect, waitForElementToBeRemoved } from 'storybook/test';
import type { SparqlTableResult } from '@/sparql_queries';
import type { PaginationState } from '@tanstack/react-table';

const meta = {
  title: "components/MultiCardinalTable",
  component: MultiCardinalTableServer,
} satisfies Meta<typeof MultiCardinalTableServer>;

export default meta;
type Story = StoryObj<typeof meta>;

function withRows(rows: { [key: string]: string }[]): SparqlTableResult {
  if (rows.length === 0) return ({ head: { vars: [] }, results: { bindings: [] } });
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  return {
    head: { vars: keys },
    results: { bindings: rows.map((row) => {
      const entries = Object.entries(row)
        .map(([k, v]) => [k, { type: "string", value: v }] as const);
      return Object.fromEntries(entries);
    }) },
  }
}

// Source - https://stackoverflow.com/a/43053803
// Retrieved 2026-07-06, License - CC BY-SA 4.0
function cartesian <T>(...a: T[][]): T[][] {
  // NOTE: the solution comment mentions the N = 1 case being broken and thus we handle this
  // explicitly
  if (a.length === 1) return a[0].map((it) => [it]);
  // NOTE: Casting to any because it should work
  return a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())) as any) as any;
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


function withGroupedRows(groupedRows: MulticardinalRow[]): SparqlTableResult {
    return withRows(groupedRows.flatMap(({
        idCols,
        idValues,
        restCols,
        restValues,
    }) => {
        const entries = Object.entries(restValues);
        const entryProduct = cartesian(...entries.map(([_, v]) => v));
        return entryProduct.map((restValuesArr) => {
            return {
                ...idValues,
              ...Object.fromEntries(entries.map(([k], i) => [k, restValuesArr[i]] as const)),
            };
        });
    }));
}

function isCounterQuery(query: string) {
  return query.includes("?__global_count")
}

function counterPayload({
  globalCount,
  groupedCount,
}: {
  globalCount: number,
  groupedCount: number,
}) {
    return withRows([{
      "__global_count": globalCount.toString(),
      "__grouped_count": groupedCount.toString(),
    }])
}

const defaultArgs: Omit<Story["args"], "queryCallback"> = {
    baseQuery: "",
    counterLimit: 10_000_000,
    rawRowLimit: 100_000,
    idVars: [],
}

export const Empty: Story = {
  args: {
    ...defaultArgs,
    queryCallback: async () => withRows([]),
  },
};

export const WithData: Story = {
    args: {
        ...defaultArgs,
        queryCallback: async ({ query }) => {
            if (isCounterQuery(query)) return counterPayload({
              groupedCount: 1,
              globalCount: 1000,
            });

            return withGroupedRows([
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
            ]);
        }
    }
}


export const WithPagination: Story = {
  args: {
    ...defaultArgs,
    idVars: [":key0", ":key1"],
    queryCallback: async () => withRows([]),
  },
  // NOTE: Disable arguments in UI that will be overriden regardless
  argTypes: {
    pagination: { control: false },
    onPaginationChange: { control: false },
  },
  render: ({ ...args }) => {
    type Pagination = NonNullable<Parameters<typeof MultiCardinalTableServer>[0]["pagination"]>

    const [pagination, setPagination] = useState<Pagination>({ pageIndex: 0, pageSize: 10 });

    const queryCallback: Story["args"]["queryCallback"] = async ({ query }) => {
          if (isCounterQuery(query)) return counterPayload({ globalCount: 1000, groupedCount: 30 });

          const maybePaginationInfo = inferPagination(query);

          if (!maybePaginationInfo) throw new Error("unexpected missing pagination");

          const { pageSize, pageIndex } = maybePaginationInfo;

          const rows: MulticardinalRow[] = Array(pageSize)
              .fill(undefined)
              .map((_, i) => ({
                  idCols: [":key0", ":key1"],
                  idValues: {
                      ":key0": `A${pageIndex}`,
                      ":key1": `B${i}`,
                  },
                  restCols: [":value0", ":valueConst"],
                  restValues: {
                      ":value0": ["Something", `page-${pagination.pageIndex}`],
                      ":valueConst": ["i stay the same"]
                  },
              }));

          return withGroupedRows(rows);
      };

    return (
      <div className="">
        <MultiCardinalTableServer
          {...args}
          queryCallback={queryCallback}
          pagination={pagination}
          onPaginationChange={setPagination}
        />
      </div>
    );
  },
}

export const WithRowCountLimit: Story = {
  args: {
    ...defaultArgs,
    counterLimit: 1000,
    queryCallback: async ({ query }) => {
      if (isCounterQuery(query)) return counterPayload({ globalCount: 1000, groupedCount: 15 });
      return withRows([]);
    },
  },
}

export const CustomColumn: Story = {
    args: {
        ...defaultArgs,
        idVars: ["ns3:key0", "ns2:key1"],
        queryCallback: async ({ query }) => {
            if (isCounterQuery(query)) return counterPayload({ globalCount: 1000, groupedCount: 1 });
            return withGroupedRows([{
                idCols: ["ns3:key0", "ns2:key1"],
                idValues: {
                    "ns3:key0": `AA`,
                    "ns2:key1": `BB`,
                },
                restCols: ["ns1:value0", "ns0:valueConst"],
                restValues: {
                    "ns1:value0": ["val0", "val1", "val2"],
                    "ns0:valueConst": ["i stay the same"]
                },
            }]);
        },
        renderHeader: (name) => {
            function colorCn(key: string): string {
                switch (key) {
                    case "ns3:key0": return "bg-red-500";
                    case "ns2:key1": return "bg-blue-500";
                    case "ns1:value0": return "bg-green-400";
                    case "ns0:valueConst": return "bg-yellow-400";
                }
                return "";
            }

            function renderText(key: string) {
                const [ns, prop] = key.split(":");
                return (
                    <p>
                        <span className="font-normal">{ns}:</span>
                        <span className="text-lg">{prop}</span>
                    </p>
                )
            }

            return (
                <div className="flex items-center gap-2 p-2">
                    <div className={`size-4 rounded-sm ${colorCn(name)}`} />
                    {renderText(name)}
                    <div className={`size-4 rounded-sm ${colorCn(name)}`} />
                </div>
            );
        },
    },
};

export const CanOverpageOnNoSizeInformation: Story = {
    args: {
        ...defaultArgs,
        queryCallback: async () => withRows([]),
    },
    play: async ({ canvas, userEvent, canvasElement, step }) => {
        const currentPageNumberInitial = canvasElement.querySelector('[data-current-page]');
        const nextPageButton = canvas.getByText(">");

        await step("Assert initial state", () => {
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
}

export const CanOverpageOnPartialSizeInformation: Story = {
    args: {
      ...defaultArgs,
      queryCallback: async ({ query }) => {
        return isCounterQuery(query)
          ? counterPayload({ globalCount: 1000, groupedCount: 11 })
          : withRows([]);
      },
      counterLimit: 1000,
    },
    play: async ({ canvas, userEvent, canvasElement, step }) => {
        // NOTE: This test's groupedCount must exceed pageSize in order to also test last page
        // button
        const expectedPageCount = 2;

        const currentPageNumber = canvasElement.querySelector('[data-current-page]');
        if (!currentPageNumber) throw new Error("Unexpected missing item!");
        const nextPageButton = canvas.getByText(">");
        const lastPageButton = canvas.getByText(">>");

        await step("Assert initial state", () => {
            expect(nextPageButton).not.toBeDisabled();

            // NOTE: Should not be disabled because
            expect(lastPageButton).not.toBeDisabled();

            expect(currentPageNumber).toBeInTheDocument();
            expect(currentPageNumber).toHaveTextContent("1");
        });

        await step("Can go to last (known) page", async () => {
            await userEvent.click(lastPageButton);
            expect(currentPageNumber).toHaveTextContent(`${expectedPageCount}`);
            expect(lastPageButton).toBeDisabled();
        })

        await step("Can go beyond last (known) page", async () => {
            await userEvent.click(nextPageButton);

            expect(currentPageNumber).toHaveTextContent(`${expectedPageCount + 1}`);
        });
    },
}

export const Resizable: Story = {
    args: {
      ...defaultArgs,
      idVars: [":key0", ":key1"],
      queryCallback: async ({ query }) => {
        if (isCounterQuery(query)) throw new Error("no count");
        return withGroupedRows([
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
        ])
      },
    },
    play: async ({ userEvent, canvas, canvasElement, step }) => {
        const spinner = canvas.queryByRole("status");
        await waitForElementToBeRemoved(spinner);

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
                { coords: to, target: dragHandle, },
                { keys: '[/MouseLeft]' },
            ]);

            expect(col.clientWidth).toBe(defaultColumn.minSize);
        });
    },
}

function delayPromise(delay: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, delay);
    })
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

export const QueryFailure: Story = {
    args: {
      ...defaultArgs,
      queryCallback: delayed(1000, () => { throw new Error("failure") }),
    },
    play: async ({ canvas }) => {
        const errorMsg = await canvas.findByText("error", { exact: false });
        expect(errorMsg).toBeInTheDocument();

        const resetButton = canvas.getByText("retry", { exact: false });
        expect(resetButton).toBeInTheDocument();
    },
}

export const SlowSuccessfulQuery: Story = {
  args: {
    ...defaultArgs,
    idVars: [":key0", ":key1"],
    queryCallback: async ({ query }) => {
        if (isCounterQuery(query)) throw new Error("no count");
        return await delayed(1000, async () => {
            const groupedRows = withGroupedRows([{
                idCols: [":key0", ":key1"],
                idValues: {
                    ":key0": "AA",
                    ":key1": "BB",
                },
                restCols: [":value0"],
                restValues: {
                  ":value0": ["query successful"],
                },
            }]);
          return groupedRows;
})();
    },
  },
  play: async ({ canvas }) => {
    const spinner = canvas.queryByRole("status");
    expect(spinner).toBeInTheDocument();

    await waitForElementToBeRemoved(spinner);
    const tableItem = canvas.queryByText("query successful");
    expect(tableItem).toBeInTheDocument();
  },
};

export const SlowQueryFailThenSucceed: Story = {
    args: {
      ...defaultArgs,
      idVars: [":key0", ":key1"],
      queryCallback: async () => {
        throw new Error("shouldn't be called");
      }
    },
    render: (args) => {
        const callCountRef = useRef(0);

        const res: MulticardinalRow[] = [{
            idCols: [":key0", ":key1"],
            idValues: {
                ":key0": "AA",
                ":key1": "BB",
            },
            restCols: [":value0"],
            restValues: {
                ":value0": ["query successful"],
            },
        }];

        const queryCallback: Story["args"]["queryCallback"] = async ({ query }) => {
            if (isCounterQuery(query)) throw new Error("no count");
            return await delayed(1000, async () => {

                callCountRef.current += 1;

                const callCount = callCountRef.current;

                if (callCount < 2) throw new Error("womp womp");

                return withGroupedRows(res);
            })();
        }

        return (
            <MultiCardinalTableServer {...{ ...args, queryCallback }} />
        );
    },
    play: async ({ canvas, userEvent, step }) => {
        await step("Wait for error", async () => {
            const spinner0 = canvas.queryByRole("status");
            expect(spinner0).toBeInTheDocument();

            await waitForElementToBeRemoved(spinner0);

            const errorMsg = canvas.queryByText("error", { exact: false });
            expect(errorMsg).toBeInTheDocument();
        });

        await step("Wait for data", async () => {
            const resetButton = canvas.getByText("retry", { exact: false });
            await userEvent.click(resetButton);

            const spinner1 = await canvas.findByRole("status");
            await waitForElementToBeRemoved(spinner1);

            const tableItem = canvas.queryByText("query successful");
            expect(tableItem).toBeInTheDocument();
        });
    },
};
