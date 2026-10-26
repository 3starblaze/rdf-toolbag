import { Fragment } from "react";
import type { RdfTerm } from "@/sparql_queries";

// NOTE: Browsers do not break lines after "/" by default, so a zero-width <wbr /> is placed after each one
function withSlashBreaks(value: string) {
  const parts = value.split("/");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (<>/<wbr /></>)}
    </Fragment>
  ));
}

// NOTE: Text wraps at normal break points (spaces, slashes). A single word too wide for the cell is never
// split by character, it is cut off with an ellipsis instead.
export function TermDisplay({
  term,
}: {
  term: RdfTerm,
}): React.ReactNode {
  if (term.type === "uri") {
    return (
      <p className="overflow-hidden text-ellipsis">
        <a href={term.value} className="underline">
          {withSlashBreaks(term.value)}
        </a>
      </p>
    );
  }
  if (term.type === "literal") {
    return (
      <p className="overflow-hidden text-ellipsis">
        {withSlashBreaks(term.value)}
        {term["xml:lang"] && (<span className="text-gray-400">@{term["xml:lang"]}</span>)}
      </p>
    );
  }

  if (term.type === "bnode") {
    return (
      <p className="overflow-hidden text-ellipsis">
        <span className="whitespace-nowrap text-gray-400">_:</span>
        {withSlashBreaks(term.value)}
      </p>
    );
  }
}
