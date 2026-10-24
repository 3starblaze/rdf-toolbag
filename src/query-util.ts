import { Parser } from '@traqula/parser-sparql-1-1';
import {
  AstTransformer,
  AstFactory,
  type ContextDefinition,
  type Pattern,
  type TripleNesting,
  type QuerySelect,
  type Expression,
} from '@traqula/rules-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import Graph from 'graphology';
import { dfsFromNode } from "graphology-traversal";
import { produce } from "immer";
import { valueEqual } from './func-util';

type Ast = ReturnType<InstanceType<(typeof Parser)>["parse"]>
// NOTE: Defining values that are encountered but not added in type definitions
type FixedAst = Ast & {
  context: ContextDefinition[],
}

export function rewriteQueryWithPrefixes({
  query,
  prefixInfo
}: {
  query: string,
  prefixInfo: { prefix: string, uri: string }[]
}): string {
  const parser = new Parser();
  const transformer = new AstTransformer();
  const F = new AstFactory();
  const generator = new Generator();

  const ast = parser.parse(query);

  const usedPrefixes = new Set<string>();

  const newAst = transformer.transformNodeSpecific<"unsafe", typeof ast>(ast, {}, {
    // NOTE: do not traverse prefix definitions to avoid overriding
    contextDef: {
      prefix: {
        preVisitor: () => {
          return {
            continue: false,
          }
        }
      },
    },
    term: {
      namedNode: {
        transform(op) {
          // NOTE: Skip already prefixed variables
          // NOTE: prefix property can exist
          if ((op as any)?.prefix !== undefined) return op;

          const maybePrefix = prefixInfo.find((it) => op.value.startsWith(it.uri));

          if (!maybePrefix) return op;

          const { prefix, uri } = maybePrefix;

          usedPrefixes.add(prefix);
          const value = op.value.slice(uri.length);

          return F.termNamed(op.loc, value, prefix);
        },
      },
    }
  }) as FixedAst;

  const alreadyDefinedPrefixes = new Set<string>(newAst
    .context
    .flatMap((it) => (it.subType === "prefix") ? it.key : []));

  // FIXME: If already-defined prefix URI does not match provided value, we have to handle it
  const prefixDecls = prefixInfo
    .filter((it) => usedPrefixes.has(it.prefix))
    .filter((it) => !alreadyDefinedPrefixes.has(it.prefix))
    .map((it) => F.contextDefinitionPrefix(
      F.gen(),
      it.prefix,
      F.termNamed(F.gen(), it.uri)
    ));

  // NOTE: merge new prefixes
  const finalAst = {
    ...newAst,
    context: [...newAst.context, ...prefixDecls],
  };

  const newQuery = generator.generate(finalAst as Ast);

  return newQuery;
}

export function findVars({
  query,
}: {
  query: string,
}): string[] {
  const parser = new Parser();
  const transformer = new AstTransformer();

  const ast = parser.parse(query);

  const vars = new Set<string>();

  transformer.visitNode(ast, {
    term: {
      visitor: (item) => {
        if (item.subType !== "variable") return;
        vars.add(item.value);
      },
    },
  });

  return [...vars];
}


/**
 * Split query with the intention of nesting into subqueries.
 *
 * @return Two parts -- preamble that can't be nested and main that can be
 */
export function splitQueryPreamble(
  query: string,
): { preamble: string, main: string } {
  const parser = new Parser({
    defaultContext: { astFactory: new AstFactory() },
    lexerConfig: { positionTracking: 'full' },
  });

  const ast = parser.parse(query);

  if (ast.type !== "query") throw "Unexpected ast type!";

  const maybeLoc = ast.context.at(-1)?.loc;

  let splitIndex: number;

  if (maybeLoc) {
    // NOTE: With full position tracking it should be impossible to have other type selected.
    if (maybeLoc.sourceLocationType !== "source") throw "Unexpected!";
    splitIndex = maybeLoc.end;
  } else {
    // NOTE: No context means no preamble and we split at the beginning.
    splitIndex = 0;
  }

  return {
    preamble: query.slice(0, splitIndex),
    main: query.slice(splitIndex),
  };
}

export function isQueryValid(query: string) {
  const parser = new Parser();
  try {
    parser.parse(query);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Find all optional patterns and ensure they are in the same line.
 **/
export function flattenOptionalPatterns(query: string): string {
  const res = query.replace(
    /OPTIONAL\s*\{\s*(.*)\s*\}/g,
    (_, pattern: string) =>
      `OPTIONAL { ${pattern.replace(/\s+/g, ' ').trim()} }`,
  );

  return res;
}

/**
 * Move optional patterns below basic graph patterns.
 *
 * This is needed because some SPARQL engines (e.g. Virtuoso) return 500 when optional attributes
 * appear above basic graph patterns, even if that's valid syntax.
 **/
export function reorderOptional(query: string): string {
  const parser = new Parser();
  const transformer = new AstTransformer();
  const generator = new Generator();

  const ast = parser.parse(query);

  const newAst = transformer.transformNodeSpecific<"unsafe", typeof ast>(ast, {}, {
    pattern: {
      group: {
        transform: (op) => {
          const targetSubtypes = ["bgp", "optional"];

          const groupedPatterns = Map.groupBy(
            op.patterns,
            ({ subType }) => targetSubtypes.includes(subType) ? subType : "rest"
          );

          const bgpPatterns = groupedPatterns.get("bgp") || [];
          const optionalPatterns = groupedPatterns.get("optional") || [];
          const restPatterns = groupedPatterns.get("rest") || [];

          const transformed: typeof op = {
            ...op,
            patterns: [...bgpPatterns, ...optionalPatterns, ...restPatterns],
          }

          return transformed;
        },
      },
    },
  });

  const newQuery = generator.generate(newAst);

  return flattenOptionalPatterns(newQuery);
}

export function dropUselessOptionals(query: string): string {
  const parser = new Parser();
  const transformer = new AstTransformer();
  const generator = new Generator();

  const ast = parser.parse(query);

  if (ast.type !== "query") return query;
  if (ast.subType !== "select") return query;

  const finalAst = transformer.transformNode<"unsafe", typeof ast>(ast, {
    query: {
      transform: (it) => {
        if (it.subType !== "select") return it;
        return dropUselessOptionalsNonRecursive(it);
      }
    },
  });

  const newQuery = generator.generate(finalAst);

  return newQuery;
}

/**
 * Simplify SELECT query by removing `OPTIONAL { ... }` that will never be used.
 *
 * In some endpoints this can improve query performance drastically.
 **/
function dropUselessOptionalsNonRecursive(select: QuerySelect): QuerySelect {
  const F = new AstFactory();

  // NOTE: Nothing is useless when everything is selected
  if (select.variables.length === 1 && select.variables[0].type === "wildcard") return select;

  // NOTE: Simplified structure that is used for gathering BGP{...} and OPIONAL{BGP{...}}
  interface SimplePattern {
    tripleNesting: TripleNesting,
    optional: boolean,
  }

  // NOTE: Ensure that every pattern is either optional or bgp and collect them in a flat list
  function flattenPatterns(
    patterns: Pattern[],
    inheritedOptional: boolean,
  ): SimplePattern[] {
    return patterns.flatMap((it) => {
      if (it.type === "pattern" && it.subType === "bgp") {
        return it.triples.map((tripleNesting) => {
          // NOTE: This type happens with blank nodes, we don't handle that
          if (tripleNesting.type === "tripleCollection") throw "unexpected";
          return ({
            tripleNesting,
            optional: inheritedOptional,
          })
        });
      }
      if (it.type === "pattern" && it.subType === "optional") {
        return flattenPatterns(it.patterns, true);
      }
      throw "unexpected";
    });
  }

  // NOTE: BIND, VALUES and FILTER are kept verbatim after the triple patterns. We only handle them
  // when they trail all triple patterns, so that moving them does not change the meaning of the group.
  const isTriplePattern = (it: Pattern) =>
    it.type === "pattern" && (it.subType === "bgp" || it.subType === "optional");
  const isBindOrValues = (it: Pattern) =>
    (it.type === "pattern" && it.subType === "values") ||
    (it.type === "pattern" && it.subType === "bind" && it.expression.type === "term");
  const isSimpleFilter = (it: Pattern) =>
    it.type === "pattern" && it.subType === "filter" && filterExpressionVars(it.expression) !== null;

  const firstExtraIndex = select.where.patterns.findIndex((it) => !isTriplePattern(it));
  const triplePatterns = firstExtraIndex === -1
    ? select.where.patterns
    : select.where.patterns.slice(0, firstExtraIndex);
  const extraPatterns = firstExtraIndex === -1
    ? []
    : select.where.patterns.slice(firstExtraIndex);

  if (!extraPatterns.every((it) => isBindOrValues(it) || isSimpleFilter(it))) return select;

  // NOTE: We are throwing unexpected when we find some edge cases that we are not ready to handle.
  // In this case we avoid optimizing.
  let simplePatterns: SimplePattern[] | null;

  try {
    simplePatterns = flattenPatterns(triplePatterns, false);
  } catch (e) {
    if (e === "unexpected") simplePatterns = null;
    else throw(e);
  }

  if (!simplePatterns) return select;

  interface GraphTriple {
    from: string,
    to: string,
    pattern: SimplePattern,
  }

  // NOTE: Variables introduced by BIND and VALUES are always bound, so they count as known
  const extraVars = extraPatterns.flatMap((it) => {
    if (it.type !== "pattern") return [];
    if (it.subType === "bind") return [it.variable.value];
    if (it.subType === "values") return it.variables.map((variable) => variable.value);
    return [];
  });

  let knownVars = simplePatterns
    .filter((it) => !it.optional)
    .flatMap((it) => [it.tripleNesting.subject, it.tripleNesting.object])
    .flatMap((it) => (it.subType === "variable") ? [it.value] : [])
    .concat(extraVars);

  function isKnown(val: string) {
    return knownVars.includes(val);
  }

  interface ProcessingAnswer {
    decision: {
      type: "discard"
    } | {
      type: "addGraph", graphTriple: GraphTriple
    } |
    {
      type: "processAgain",
    },
    pattern: SimplePattern,
  }

  function processPatterns(toProcess: SimplePattern[]): ProcessingAnswer[] {
    const discard = (pattern: SimplePattern) => ({
      decision: { type: "discard" },
      pattern,
    }) satisfies ProcessingAnswer;

    return toProcess.map((pattern): ProcessingAnswer => {
      const a = pattern.tripleNesting.subject;
      const b = pattern.tripleNesting.object;

      // NOTE: if both are not variables, they can be dropped
      if (a.subType !== "variable" || b.subType !== "variable") {
        return discard(pattern);
      } else {
        const aKnown = isKnown(a.value);
        const bKnown = isKnown(b.value);
        // NOTE: if both are known, this does not add additional information
        if (aKnown && bKnown) return discard(pattern);
        if (aKnown && !bKnown) return {
          decision: { type: "addGraph", graphTriple: { from: b.value, to: a.value, pattern } },
          pattern
        };
        if (!aKnown && bKnown) return {
          decision: { type: "addGraph", graphTriple: { from: a.value, to: b.value, pattern } },
          pattern,
        };

        // NOTE: Both are unknown and further connection might be discovered in the future
        return { decision: { type: "processAgain" }, pattern };
      }
    });
  }

  let toProcess = simplePatterns.filter((it) => it.optional);
  let processRes = processPatterns(toProcess);
  let graphTriples: GraphTriple[] = [];

  // NOTE: if non-empty array consists entirely "processAgain" items, decision will not be changed.
  // Ultimately that should mean that all the edges are dangling and are not connected to known
  // vars.
  while (processRes.some((it) => it.decision.type !== "processAgain")) {
    const addGraphItems = processRes
      .flatMap((it) => (it.decision.type === "addGraph") ? it.decision.graphTriple : []);

    graphTriples = graphTriples.concat(addGraphItems);
    knownVars = knownVars.concat(addGraphItems.flatMap((it) => [it.from, it.to]));

    toProcess = processRes
      .flatMap((it) => (it.decision.type === "processAgain") ? it.pattern : []);
    processRes = processPatterns(toProcess);
  }

  // NOTE: Multi graph, because the same pair of variables can be connected by several patterns
  const graph = new Graph<{}, { simplePattern: SimplePattern | null }, {}>({ type: "mixed", multi: true });

  for (const pattern of simplePatterns) {
    if (pattern.optional) continue;
    const a = pattern.tripleNesting.subject;
    const b = pattern.tripleNesting.object;
    if (a.subType !== "variable" || b.subType !== "variable") continue;

    // NOTE: Create nodes if they don't exist, so that addEdge doesn't throw
    graph.updateNode(a.value);
    graph.updateNode(b.value);
    graph.addUndirectedEdge(a.value, b.value, { simplePattern: pattern });
  }

  for (const { from, to, pattern } of graphTriples) {
    // NOTE: Create nodes if they don't exist, so that addEdge doesn't throw
    graph.updateNode(from);
    graph.updateNode(to);
    graph.addDirectedEdge(from, to, { simplePattern: pattern });
  }

  for (const it of extraPatterns) {
    if (it.type !== "pattern" || it.subType !== "bind") continue;
    // NOTE: BIND(term AS ?var) always binds ?var, so it is a node even when there is no edge
    graph.updateNode(it.variable.value);
    // NOTE: Literal and IRI sources are constants, so they don't connect to anything
    if (it.expression.type !== "term" || it.expression.subType !== "variable") continue;
    // NOTE: If ?var is needed, then the source variable is needed as well
    graph.updateNode(it.expression.value);
    graph.addDirectedEdge(it.variable.value, it.expression.value, { simplePattern: null });
  }

  // NOTE: Variables used by a FILTER are needed, otherwise the filter would be evaluated on different
  // bindings than the original query.
  const filterVars = extraPatterns.flatMap((it) => {
    if (it.type !== "pattern" || it.subType !== "filter") return [];
    return filterExpressionVars(it.expression) ?? [];
  });

  const keyVars = [
    ...select.variables.flatMap((it) => (it.type === "term") ? it.value : []),
    ...filterVars,
  ];

  let reachableVars: string[] = [];

  for (const keyVar of keyVars) {
    // NOTE: Variables that are not in any pattern (e.g. only in VALUES) have no edges to traverse
    if (!graph.hasNode(keyVar)) continue;
    dfsFromNode(graph, keyVar, (node) => {
      // NOTE: We have already traversed traversed this node
      if (reachableVars.includes(node)) return true;
      reachableVars.push(node);
    });
  }

  let finalSimplePatterns: SimplePattern[] = simplePatterns.filter((it) => !it.optional);

  graph.forEachEdge((_, { simplePattern }, source) => {
    // NOTE: non-optional edges are handled already
    if (simplePattern?.optional && reachableVars.includes(source)) {
      finalSimplePatterns.push(simplePattern);
    }
  });

  const finalPatterns: Pattern[] = [
    ...finalSimplePatterns.map((it) => {
      const bgp = F.patternBgp([it.tripleNesting], F.gen());
      return it.optional ? F.patternOptional([bgp], F.gen()) : bgp;
    }),
    ...extraPatterns,
  ];

  return produce(select, (draft) => {
    draft.where.patterns = finalPatterns;
  });
}

/**
 * Collect variables of a FILTER expression.
 *
 * Returns null for expressions that contain a pattern (e.g. EXISTS) or aggregate, because those are
 * not simple enough to reason about here.
 */
function filterExpressionVars(expression: Expression): string[] | null {
  if (expression.type === "term") {
    return expression.subType === "variable" ? [expression.value] : [];
  }
  if (expression.subType === "operation" || expression.subType === "functionCall") {
    const argVars = expression.args.map(filterExpressionVars);
    if (argVars.includes(null)) return null;
    return argVars.flatMap((it) => it ?? []);
  }
  return null;
}

/**
 * Check that a subquery has no solution modifiers and projects every variable used in its pattern.
 */
function isPlainFullProjection(fragment: QuerySelect): boolean {
  const { group, having, order, limitOffset } = fragment.solutionModifiers;
  if (fragment.distinct || fragment.reduced) return false;
  if (group || having || order || limitOffset) return false;
  if (!fragment.variables.every((it) => it.type === "term")) return false;

  const projected = new Set(fragment.variables.map((it) => it.value));
  const transformer = new AstTransformer();
  let allProjected = true;

  transformer.visitNode(fragment.where, {
    term: {
      visitor: (item) => {
        if (item.subType !== "variable") return;
        if (!projected.has(item.value)) allProjected = false;
      },
    },
  });

  return allProjected;
}

/**
 * Remove unnecessary subqueries.
 *
 * Especially useful in QLever-based endpoints where subqueries are expensive.
 */
export function flattenUselessSubqueries(query: string): string {
  const parser = new Parser();
  const generator = new Generator();
  const F = new AstFactory();

  const ast = parser.parse(query);

  if (ast.type !== "query") return query;
  if (ast.subType !== "select") return query;

  function isSubset(a: Set<unknown>, b: Set<unknown>): boolean {
    if (a.size === 0) return true;
    return [...a.values()].every((it) => b.has(it));
  }

  function sameVars(
    a: QuerySelect["variables"],
    b: QuerySelect["variables"],
  ): boolean {
    return valueEqual(
      a.map(({ loc, ...rest }) => rest),
      b.map(({ loc, ...rest }) => rest),
    );
  }

  function canFlatten(
    fragment: QuerySelect,
    parentSelect: QuerySelect | null,
  ): boolean {
    if (fragment.solutionModifiers.group) {
      return false;
    }

    // NOTE: REDUCED may be dropped by the engine, so it is not inherited and such subqueries are
    // kept.
    if (fragment.reduced) {
      return false;
    }

    // NOTE: Like LIMIT, DISTINCT is inherited by the parent, which is only correct if both project
    // the same variables.
    if ((fragment.distinct || fragment.solutionModifiers.limitOffset)
      && !sameVars(fragment.variables, parentSelect?.variables ?? [])
    ) {
      return false;
    }

    // NOTE: If variables are projected, we cannot flatten for sure -- extra variables may leak
    if (!fragment.variables.every((it) => it.type === "wildcard")) {
      // NOTE: Root query has to be kept
      if (!parentSelect) return false;

      // TODO: Handle patterns
      // NOTE: Only handling terms because it is easier.
      if (!parentSelect.variables.every((it) => it.type === "term")
        && !fragment.variables.every((it) => it.type === "term")) return false;

      // NOTE: A subquery without solution modifiers that projects every variable of its pattern is just
      // a join with the parent. Such a subquery can be merged into any parent, regardless of siblings.
      if (isPlainFullProjection(fragment)) return true;

      // NOTE: Only optimize the cases where a query (that might be a subquery) contains only a
      // single subquery. This is done by flattening groups and asserting that we find a single child
      // that is a subquery.
      function plainSubqueryInQuery(rootPatterns: Pattern[]): boolean {
        if (rootPatterns.length !== 1) return false;
        const pattern = rootPatterns[0];
        if (pattern.type === "query") return true;
        if (pattern.subType === "group") return plainSubqueryInQuery(pattern.patterns);
        return false;
      }

      // TODO: Handle additional (perhaps simple) case:
      // -- if no sibling is constraining an unprojected variable from the subquery, it is safe to
      // flatten. This is a useful case to consider for compact pagination's base subquery.
      if (!plainSubqueryInQuery(parentSelect.where.patterns)) return false;

      const parentVars = parentSelect.variables
        .filter((it) => it.type === "term")
        .map((it) => it.value);

      const thisVars = fragment.variables
        .filter((it) => it.type === "term")
        .map((it) => it.value);

      // NOTE: Not sure if this check is needed if `plainSubqueryInQuery` assertion is done but for
      // more general cases it may be needed.
      if (isSubset(new Set(parentVars), new Set(thisVars))) return true;

      return false;
    }

    // FIXME: inherit order
    return true;
  }

  type ParentOverride =
    | { type: "parentOverride", subType: "setLimit", value: number }
    | { type: "parentOverride", subType: "setDistinct" };

  function usePatterns(
    patternRes: (Pattern | ParentOverride)[],
    parentSelect: QuerySelect,
  ): QuerySelect {
    return produce(parentSelect, (draft) => {
      const mergeablePatterns = patternRes.filter((it) => it.type !== "parentOverride");
      const overrides = patternRes.filter((it) => it.type === "parentOverride");
      draft.where.patterns = mergeablePatterns;

      overrides.forEach((it) => {
        if (it.subType === "setLimit") {
          draft.solutionModifiers.limitOffset = F.solutionModifierLimitOffset(
            it.value,
            draft.solutionModifiers.limitOffset?.offset,
            F.gen(),
          );
        }
        if (it.subType === "setDistinct") {
          draft.distinct = true;
        }
      })
    });
  }

  function processPatterns(
    patterns: Pattern[],
    parentSelect: QuerySelect | null,
  ): (Pattern | ParentOverride)[] {
    return patterns.flatMap((it) => {
      if (it.type === "pattern" && it.subType === "group") {
        return processPatterns(it.patterns, parentSelect);
      }

      // NOTE: Each UNION block is independent of its siblings, so every branch is optimized on its
      // own. Branches have no parent select to inherit into, so they never carry parent overrides
      // (a LIMIT or DISTINCT of a branch can only be flattened when the parent is a plain subquery).
      if (it.type === "pattern" && it.subType === "union") {
        return produce(it, (draft) => {
          draft.patterns = it.patterns.flatMap((branch) =>
            processPatterns([branch], null)
              .flatMap((res) => (res.type === "parentOverride" ? [] : res)),
          ).map((pattern) => {
            // NOTE: Union requires all patterns to be groups, thus we wrap them when needed.
            if (pattern.type === "pattern" && pattern.subType === "group") return pattern;
            return F.patternGroup([pattern], F.gen())
          });
        });
      }

      // NOTE: Looks like queries seem to always be wrapped in groups. Therefore if flattening is
      // applied, group is not kept. However if query is not flattened it should have a group,
      // otherwise invalid query is generated.
      if (it.type === "query") {
        if (canFlatten(it, parentSelect)) {
          const finalLimit = Math.min(...[
            it.solutionModifiers.limitOffset?.limit,
            parentSelect?.solutionModifiers.limitOffset?.limit
          ].filter((it) => it !== undefined));

          const newParentSelect = produce(parentSelect, (draft) => {
            if (!draft) return;

            // NOTE: If subquery can be flattened, inherit smallest limit
            draft.solutionModifiers.limitOffset = F.solutionModifierLimitOffset(
              finalLimit === Infinity ? undefined : finalLimit,
              draft.solutionModifiers.limitOffset?.offset,
              F.gen(),
            );
          });

          const distinctOverrides: ParentOverride[] = it.distinct
            ? [{ type: "parentOverride", subType: "setDistinct" }]
            : [];

          return [
            ...processPatterns(it.where.patterns, newParentSelect),
            { type: "parentOverride", subType: "setLimit", value: finalLimit },
            ...distinctOverrides,
          ];
        }
        else return F.patternGroup(
          [usePatterns(processPatterns(it.where.patterns, it), it)],
          F.gen(),
        );
      }
      return it;
    });
  }

  const newAst = usePatterns(processPatterns(ast.where.patterns, ast), ast);

  const newQuery = generator.generate(newAst);
  return newQuery;
}

/**
 * Apply all query optimizations that keep the query's results unchanged.
 */
export function optimize(query: string): string {
  return dropUselessOptionals(flattenUselessSubqueries(query));
}
