import type { ComplexPropertySelection } from "@/components/complex_property_selector";

export interface PropFetchTarget {
    targetItem: "dataProp" | "objectProp",
    propIndex: number,
}

interface RdfTypeFetchTarget {
    targetItem: "rdfType",
}

export type FetchTarget = PropFetchTarget | RdfTypeFetchTarget;

export interface SuggestionsFetcherContext {
    rootSelection: ComplexPropertySelection,
    /** Selected item. */
    fetchTarget: FetchTarget,
    // NOTE: Only objectProp items can be parent fetch targets
    /** Additional fetch targets that are needed to reach the final fetchTarget  */
    parentFetchTargets: (FetchTarget & { targetItem: "objectProp" })[],
}

export type SuggestionsFetcher = (ctx: SuggestionsFetcherContext) => Promise<{
    value: string,
    label: string
}[]>;

export function getThisSelection(
  ctx: Pick<SuggestionsFetcherContext, "rootSelection" | "parentFetchTargets">
): ComplexPropertySelection {
  return ctx.parentFetchTargets
    .reduce(
      (nowSelection, { propIndex }) => nowSelection.objectProps[propIndex].selection,
      ctx.rootSelection,
    );
}

interface TargetItemToValue {
  "rdfType": string,
  "dataProp": ComplexPropertySelection["dataProps"][number],
  "objectProp": ComplexPropertySelection["objectProps"][number],
}

export function getFetchTargetValue<TargetItem extends FetchTarget["targetItem"]>(
  ctx: SuggestionsFetcherContext & { fetchTarget: { targetItem: TargetItem } },
): TargetItemToValue[TargetItem] {
  const thisSelection = getThisSelection(ctx);

  // NOTE: This implementation is really finnicky because type narrowing doesn't work on
  // `TargetItem` but I still want to preserve the type logic.

  // NOTE: Without cast, type narrowing doesn't work
  const fetchTarget = ctx.fetchTarget as FetchTarget;

  // NOTE: To make return casts shorter
  type Res<T extends keyof TargetItemToValue> = TargetItemToValue[T];

  // NOTE: Adding "satisfies" to catch issues that may be missed since "as" is rather lenient.
  if (fetchTarget.targetItem === "rdfType") {
    return thisSelection.rdfType satisfies Res<"rdfType"> as Res<TargetItem>;
  } else if (fetchTarget.targetItem === "dataProp") {
    const res = thisSelection.dataProps[fetchTarget.propIndex];
    return res satisfies Res<"dataProp"> as Res<TargetItem>;
  } else if (fetchTarget.targetItem === "objectProp") {
    const res = thisSelection.objectProps[fetchTarget.propIndex];
    return res satisfies Res<"objectProp"> as Res<TargetItem>;
  } else {
    // NOTE: Even though our if-else is exhaustive (the value is "never"), type checks fail and we
    // have to throw something.
    throw "unexpected";
  }
}
