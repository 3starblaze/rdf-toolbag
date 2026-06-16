import type { Meta, StoryObj } from '@storybook/react-vite';
import { MultiCardinalTableServer } from './multi-cardinal-table';
import { useState } from 'react';
import type { MulticardinalRow } from '@/multi-cardinal-table-util';


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

export const WithPagination: Story = {
  args: {
    rows: [],
    countPayload: { globalCount: 1000, groupedCount: 30 },
  },
  // NOTE: Disable arguments in UI that will be overriden regardless
  argTypes: {
    rows: { control: false },
    pagination: { control: false },
    onPaginationChange: { control: false },
  },
  render: ({ ...args }) => {
    type Pagination = NonNullable<Parameters<typeof MultiCardinalTableServer>[0]["pagination"]>

    const [pagination, setPagination] = useState<Pagination>({ pageIndex: 0, pageSize: 10 });

    const { pageSize, pageIndex } = pagination;

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

    return (
      <div className="">
        <MultiCardinalTableServer
          {...args}
          rows={rows}
          pagination={pagination}
          onPaginationChange={setPagination}
        />
      </div>
    );
  },
}

export const WithRowCountLimit: Story = {
  args: {
    rows: [],
    countPayload: { globalCount: 1000, groupedCount: 15 },
    rowCountLimit: 1000,
  },
}

export const CustomColumn: Story = {
    args: {
        rows: [{
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
        }],
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
}
