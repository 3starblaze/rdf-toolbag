import { Ellipsis } from "lucide-react";
import type { RdfTerm } from "@/sparql_queries";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { TermDisplay } from "./TermDisplay";

/** Shape of a query result, so that a cell can be rendered from the state of its query. */
export interface ValueCellQuery {
  data?: RdfTerm[],
  isPending: boolean,
  isError: boolean,
}

// NOTE: Shows the values of one cell. It only depends on its props, so the table decides
// whether the cell is loading, failed, and whether its limit can be increased.
export function ValueCell({
  value,
  onIncreaseLimit,
  onRetry,
}: {
  value: ValueCellQuery,
  /** When provided, a button is shown that calls it to load more values. */
  onIncreaseLimit?: () => void,
  /** When provided, a retry button is shown in place of the values if they could not be obtained. */
  onRetry?: () => void,
}): React.ReactNode {
  // NOTE: A cell whose limit was just increased shows its spinner in place of its values
  if (value.isPending) {
    return <Spinner role="status" />;
  }

  if (value.isError) {
    return (
      <div className="flex flex-col gap-1 items-start">
        <p className="text-gray-500">Could not get data</p>
        {onRetry && (
          <Button
            size="xs"
            variant="outline"
            className="cursor-pointer"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 overflow-hidden">
      {(value.data ?? []).map((item, i) => (
        <li
          key={i}
          className="list-disc ml-4"
        >
          {item ? <TermDisplay term={item} /> : <div></div>}
        </li>
      ))}
      {onIncreaseLimit && (
        <button
          aria-label="Show more values"
          className="w-fit px-2 border-2 rounded-md cursor-pointer"
          onClick={onIncreaseLimit}
        >
          <Ellipsis />
        </button>
      )}
    </ul>
  );
}
