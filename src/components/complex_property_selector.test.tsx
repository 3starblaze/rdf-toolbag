import { expect, test } from "vitest";
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event';
import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from './complex_property_selector'
import { useState } from "react";

test("type is updated in UI", () => {
  const selection: ComplexPropertySelection = {
    rdfType: "mytype",
    dataProps: [],
    objectProps: [],
  };

  render(<ComplexPropertySelector selection={selection} />);
  expect(screen.queryAllByDisplayValue("mytype")).not.toHaveLength(0);
});

test("no type smearing", async () => {
  const initialSelection: ComplexPropertySelection = {
    rdfType: "initialType",
    dataProps: [],
    objectProps: [],
  };

  const newSelection: ComplexPropertySelection = {
    rdfType: "freshType",
    dataProps: [],
    objectProps: [],
  };

  const { rerender } = render(
    <ComplexPropertySelector selection={initialSelection} />
  );

  expect(screen.queryAllByDisplayValue("initialType")).not.toHaveLength(0);

  rerender(
    <ComplexPropertySelector selection={newSelection} />
  );

  expect(screen.queryAllByDisplayValue("initialType")).toHaveLength(0);
  expect(screen.queryAllByDisplayValue("freshType")).not.toHaveLength(0);
});

// NOTE: Testing a previously-found bug that didn't visually update the comboboxes when one of the
// top level object properties were removed. Called this "property smearing" because the old values
// lingered, not reacting to changes unless combobox is focus and unfocused.
test("no object property smearing", async () => {
  const user = userEvent.setup();

  function SelectionWrapper({
    initialValue,
  }: {
    initialValue: ComplexPropertySelection
  }) {
    const [selection, setSelection] = useState(initialValue);

    return (
      <ComplexPropertySelector
        selection={selection}
        onSelectionChange={setSelection}
      />
    );
  }

  const initialSelection: ComplexPropertySelection = {
    rdfType: "",
    dataProps: [],
    objectProps: [
      { name: "alpha", selection: makeDefaultSelection() },
      { name: "beta", selection: makeDefaultSelection() },
    ],
  };

  render(<SelectionWrapper initialValue={initialSelection} />);

  function findCombobox(value: string) {
    return screen.getAllByRole("combobox").find((el) => (el as any).value === value)
  }

  expect(findCombobox("alpha")).not.toBeUndefined();
  expect(findCombobox("beta")).not.toBeUndefined();

  const deleteButtons = screen.queryAllByRole("button").filter((el) => el.innerHTML === "-");
  expect(deleteButtons).toHaveLength(initialSelection.objectProps.length);

  await user.click(deleteButtons[0]);

  expect(findCombobox("alpha")).toBeUndefined();
  expect(findCombobox("beta")).not.toBeUndefined();
});
