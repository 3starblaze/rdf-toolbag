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
