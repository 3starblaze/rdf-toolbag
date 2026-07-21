import { Parser } from '@traqula/parser-sparql-1-1';
import { AstTransformer, AstFactory, type ContextDefinition } from '@traqula/rules-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';

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
  const lineIsPrefixStatement = (line: string) => !!line.match(/\s*PREFIX/);
  const lineIsBlank = (line: string) => !!line.match(/^\s*$/);

  const lines = query.split("\n");
  const boundaryIndex = lines
    .findIndex((line) => !(lineIsPrefixStatement(line) || lineIsBlank(line)));

  return {
    preamble: lines.slice(0, boundaryIndex).join("\n"),
    main: lines.slice(boundaryIndex).join("\n"),
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

  return generator.generate(newAst)
}
