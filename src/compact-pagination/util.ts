import { Parser } from '@traqula/parser-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import { type SolutionModifierOrder } from '@traqula/rules-sparql-1-1';

export const indentation = "  ";
export const indent = (line: string) => `${indentation}${line}`;
export const fmtVars = (vars: string[]) => vars.map((it) => `?${it}`).join(" ");
export const lineAwareIndent = (src: string) => src.split("\n").map(indent).join("\n");

export function getOrderModifier(query: string): SolutionModifierOrder | undefined {
  const parser = new Parser();
  const ast = parser.parse(query);
  if (!(ast.type === "query" && ast.subType === "select")) return undefined;
  return ast.solutionModifiers.order;
}

export function injectOrderBy({
  queryToWrap,
  newQuery,
}: {
  queryToWrap: string,
  newQuery: string,
}): string {
  const orderModifier = getOrderModifier(queryToWrap);
  // NOTE: Nothing to inject and thus we can return the query as is
  if (!orderModifier) return newQuery;

  const parser = new Parser();
  const generator = new Generator();

  const ast = parser.parse(newQuery);

  if (!(ast.type === "query" && ast.subType === "select")) {
    throw new Error("Expected SELECT query, got something else!")
  }

  const newAst: typeof ast = {
    ...ast,
    solutionModifiers: {
      ...ast.solutionModifiers,
      order: orderModifier,
    },
  };

  return generator.generate(newAst);
}
