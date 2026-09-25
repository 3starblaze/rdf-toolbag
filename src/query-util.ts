import { Parser } from '@traqula/parser-sparql-1-1';
import {
  AstTransformer,
  AstFactory,
  type ContextDefinition,
  type Pattern,
  type TripleNesting,
} from '@traqula/rules-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import Graph from 'graphology';
import { dfsFromNode } from "graphology-traversal";

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

/**
 * Simplify SELECT query by removing `OPTIONAL { ... }` that will never be used.
 *
 * In some endpoints this can improve query performance drastically.
 **/
export function dropUselessOptionals(query: string): string {
  const parser = new Parser();
  const F = new AstFactory();
  const generator = new Generator();

  const ast = parser.parse(query);

  if (ast.type !== "query") return query;
  if (ast.subType !== "select") return query;

  // NOTE: Nothing is useless when everything is selected
  if (ast.variables.length === 1 && ast.variables[0].type === "wildcard") return query;

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

  // NOTE: We are throwing unexpected when we find some edge cases that we are not ready to handle.
  // In this case we avoid optimizing.
  let simplePatterns: SimplePattern[] | null;

  try {
    simplePatterns = flattenPatterns(ast.where.patterns, false);
  } catch (e) {
    if (e === "unexpected") simplePatterns = null;
    else throw(e);
  }

  if (!simplePatterns) return query;

  interface GraphTriple {
    from: string,
    to: string,
    pattern: SimplePattern,
  }

  let knownVars = simplePatterns
    .filter((it) => !it.optional)
    .flatMap((it) => [it.tripleNesting.subject, it.tripleNesting.object])
    .flatMap((it) => (it.subType === "variable") ? [it.value] : []);

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

  const graph = new Graph<{}, { simplePattern: SimplePattern }, {}>({ type: "mixed" });

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

  // FIXME: Handle pattern binds
  const keyVars = ast.variables.flatMap((it) => (it.type === "term") ? it.value : []);

  let reachableVars: string[] = [];

  for (const keyVar of keyVars) {
    dfsFromNode(graph, keyVar, (node) => {
      // NOTE: We have already traversed traversed this node
      if (reachableVars.includes(node)) return true;
      reachableVars.push(node);
    });
  }

  let finalSimplePatterns: SimplePattern[] = simplePatterns.filter((it) => !it.optional);

  graph.forEachEdge((_, { simplePattern }, source) => {
    // NOTE: non-optional edges are handled already
    if (simplePattern.optional &&reachableVars.includes(source)) {
      finalSimplePatterns.push(simplePattern);
    }
  });

  const finalPatterns: Pattern[] = finalSimplePatterns.map((it) => {
    const bgp = F.patternBgp([it.tripleNesting], F.gen());
    return it.optional ? F.patternOptional([bgp], F.gen()) : bgp;
  });

  const newAst = structuredClone(ast);
  newAst.where.patterns = finalPatterns;

  const newQuery = generator.generate(newAst);
  return newQuery;
}
