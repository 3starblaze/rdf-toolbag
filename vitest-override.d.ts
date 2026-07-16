import 'vitest';

interface CustomMatchers<T> {
  toBeValidSparqlQuery: () => T,
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
