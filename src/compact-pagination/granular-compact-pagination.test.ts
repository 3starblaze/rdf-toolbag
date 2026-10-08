import { expect, test, describe } from 'vitest'
import { formatKeyQuery, parseKeyQueryResults } from './granular-compact-pagination';
import type { SparqlTableResult, RdfTerm } from '@/sparql_queries';

describe('formatKeyQuery', () => {
  const baseQuery = `SELECT * WHERE {
    ?item <http://example.com/name> ?name .
    OPTIONAL { ?item <http://example.com/age> ?age . }
  }`;

  test('empty idVars array', () => {
    const result = formatKeyQuery({
      queryToWrap: baseQuery,
      idVars: [],
      groupOffset: 0,
      groupLimit: 10,
    });

    expect(result).toContain('SELECT DISTINCT');
    expect(result).toContain('LIMIT 10');
    expect(result).toContain('OFFSET 0');
  });

  test('queryToWrap without ORDER BY', () => {
    const result = formatKeyQuery({
      queryToWrap: baseQuery,
      idVars: ['item', 'name'],
      groupOffset: 0,
      groupLimit: 10,
    });

    expect(result).toContain('SELECT DISTINCT ?item ?name');
    expect(result).toContain('LIMIT 10');
    // Should not have ORDER BY since original query doesn't have it
    expect(result).not.toContain('ORDER BY');
  });

  test('queryToWrap with ORDER BY', () => {
    const queryWithOrder = `SELECT * WHERE {
      ?item <http://example.com/name> ?name .
      OPTIONAL { ?item <http://example.com/age> ?age . }
    } ORDER BY ?name`;

    const result = formatKeyQuery({
      queryToWrap: queryWithOrder,
      idVars: ['item', 'name'],
      groupOffset: 5,
      groupLimit: 20,
    });

    expect(result).toContain('SELECT DISTINCT ?item ?name');
    expect(result).toContain('LIMIT 20');
    expect(result).toContain('OFFSET 5');
    // Should preserve ORDER BY from original query
    expect(result).toContain('ORDER BY');
  });

  test('formatKeyQuery maintains proper pagination', () => {
    const result = formatKeyQuery({
      queryToWrap: baseQuery,
      idVars: ['item'],
      groupOffset: 100,
      groupLimit: 50,
    });

    expect(result).toContain('LIMIT 50');
    expect(result).toContain('OFFSET 100');
  });
});

describe('parseKeyQueryResults', () => {
  const createBinding = (values: Record<string, string>): Record<string, RdfTerm> => {
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        { type: 'literal' as const, value }
      ])
    );
  };

  test('idVars matches table vars exactly', () => {
    const table: SparqlTableResult = {
      head: {
        vars: ['item', 'name'],
      },
      results: {
        bindings: [
          createBinding({ item: 'item1', name: 'Alice' }),
          createBinding({ item: 'item2', name: 'Bob' }),
        ],
      },
    };

    const result = parseKeyQueryResults({
      table,
      idVars: ['item', 'name'],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      item: { type: 'literal', value: 'item1' },
      name: { type: 'literal', value: 'Alice' },
    });
    expect(result[1]).toEqual({
      item: { type: 'literal', value: 'item2' },
      name: { type: 'literal', value: 'Bob' },
    });
  });

  test('table vars are superset of idVars', () => {
    const table: SparqlTableResult = {
      head: {
        vars: ['item', 'name', 'age', 'email'],
      },
      results: {
        bindings: [
          createBinding({ item: 'item1', name: 'Alice', age: '30', email: 'alice@example.com' }),
          createBinding({ item: 'item2', name: 'Bob', age: '25', email: 'bob@example.com' }),
        ],
      },
    };

    const result = parseKeyQueryResults({
      table,
      idVars: ['item', 'name'],
    });

    expect(result).toHaveLength(2);
    // Only requested idVars should be in result
    expect(result[0]).toEqual({
      item: { type: 'literal', value: 'item1' },
      name: { type: 'literal', value: 'Alice' },
    });
    expect(result[1]).toEqual({
      item: { type: 'literal', value: 'item2' },
      name: { type: 'literal', value: 'Bob' },
    });
  });

  test('idVars contains var not in table vars throws error', () => {
    const table: SparqlTableResult = {
      head: {
        vars: ['item', 'name'],
      },
      results: {
        bindings: [
          createBinding({ item: 'item1', name: 'Alice' }),
        ],
      },
    };

    expect(() => {
      parseKeyQueryResults({
        table,
        idVars: ['item', 'name', 'nonexistent'],
      });
    }).toThrow('Results do not include all vars!');
  });

  test('handles unbound variables as null', () => {
    const table: SparqlTableResult = {
      head: {
        vars: ['item', 'name', 'optional_field'],
      },
      results: {
        bindings: [
          {
            item: { type: 'literal', value: 'item1' },
            name: { type: 'literal', value: 'Alice' },
            // optional_field is missing (unbound)
          },
        ],
      },
    };

    const result = parseKeyQueryResults({
      table,
      idVars: ['item', 'name', 'optional_field'],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      item: { type: 'literal', value: 'item1' },
      name: { type: 'literal', value: 'Alice' },
      optional_field: null,
    });
  });

  test('handles multiple results with different var values', () => {
    const table: SparqlTableResult = {
      head: {
        vars: ['id', 'type', 'label'],
      },
      results: {
        bindings: [
          {
            id: { type: 'uri', value: 'http://example.com/1' },
            type: { type: 'uri', value: 'http://example.com/Person' },
            label: { type: 'literal', value: 'Person One' },
          },
          {
            id: { type: 'uri', value: 'http://example.com/2' },
            type: { type: 'uri', value: 'http://example.com/Organization' },
            label: { type: 'literal', value: 'Org Two' },
          },
          {
            id: { type: 'uri', value: 'http://example.com/3' },
            type: { type: 'uri', value: 'http://example.com/Person' },
            label: { type: 'literal', value: 'Person Three' },
          },
        ],
      },
    };

    const result = parseKeyQueryResults({
      table,
      idVars: ['id', 'type', 'label'],
    });

    expect(result).toHaveLength(3);
    expect(result[0].id).toEqual({ type: 'uri', value: 'http://example.com/1' });
    expect(result[1].type).toEqual({ type: 'uri', value: 'http://example.com/Organization' });
    expect(result[2].label).toEqual({ type: 'literal', value: 'Person Three' });
  });

  test('preserves RDF term types correctly', () => {
    const table: SparqlTableResult = {
      head: {
        vars: ['uri', 'literal', 'bnode'],
      },
      results: {
        bindings: [
          {
            uri: { type: 'uri', value: 'http://example.com/resource' },
            literal: { type: 'literal', value: 'some text', 'xml:lang': 'en' },
            bnode: { type: 'bnode', value: '_:b1' },
          },
        ],
      },
    };

    const result = parseKeyQueryResults({
      table,
      idVars: ['uri', 'literal', 'bnode'],
    });

    expect(result[0].uri).toEqual({ type: 'uri', value: 'http://example.com/resource' });
    expect(result[0].literal).toEqual({ type: 'literal', value: 'some text', 'xml:lang': 'en' });
    expect(result[0].bnode).toEqual({ type: 'bnode', value: '_:b1' });
  });
});
