import { Ellipsis } from "lucide-react";
import type { RdfTerm } from "@/sparql_queries";
import { Spinner } from "@/components/ui/spinner";
import { TermDisplay } from "./TermDisplay";

// NOTE: Shows the values of one cell. It only depends on its props, so the table decides
// whether the cell is loading and whether its limit can be increased.
export function ValueCell({
  values,
  loading = false,
  onIncreaseLimit,
}: {
  values: RdfTerm[],
  loading?: boolean,
  /** When provided, a button is shown that calls it to load more values. */
  onIncreaseLimit?: () => void,
}): React.ReactNode {
  // NOTE: A cell whose limit was just increased shows its spinner in place of its values
  if (loading) {
    return <Spinner role="status" />;
  }

  return (
    <ul className="flex flex-col gap-2 overflow-hidden">
      {values.map((item, i) => (
        <li
          key={i}
          className="list-disc ml-4"
        >
          {item ? <TermDisplay term={item} /> : <div></div>}
        </li>
      ))}
      {onIncreaseLimit && (
        <button
          className="w-fit px-2 border-2 rounded-md cursor-pointer"
          onClick={onIncreaseLimit}
        >
          <Ellipsis />
        </button>
      )}
    </ul>
  );
}
