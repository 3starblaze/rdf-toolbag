import { expect, test, } from "vitest";
import { render, screen } from '@testing-library/react'
import ComplexPropertySelector, { type ComplexPropertySelection } from './complex_property_selector'

test("type is updated in UI", () => {
  const selection: ComplexPropertySelection = {
    rdfType: "mytype",
    dataProps: [],
    objectProps: [],
  };

  render(<ComplexPropertySelector selection={selection} />);
  expect(screen.queryAllByDisplayValue("mytype")).not.toHaveLength(0);
});
