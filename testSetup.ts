import { expect } from 'vitest';
import * as matchers from 'jest-extended';
import { Parser } from '@traqula/parser-sparql-1-1';

expect.extend({
  ...matchers,
  toBeValidSparqlQuery(received: string) {
    const parser = new Parser();

    try {
      parser.parse(received);
      return {
        pass: true,
        message: () => "ok",
      };
    } catch (e) {
      return {
        pass: false,
        message: () => `${e}\n${received}`,
      };
    }
  },
});
