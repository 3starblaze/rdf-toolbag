import { afterEach, expect, test } from "vitest";
import { render, screen, cleanup } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event';
import ComplexPropertySelector, {
  makeDefaultSelection,
  type ComplexPropertySelection,
  type PropFetcher,
} from './complex_property_selector'
import { useState } from "react";

afterEach(() => {
  cleanup();
});

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

test("no data property smearing", async () => {
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
    dataProps: [
      { name: "alpha" },
      { name: "beta" },
    ],
   objectProps: [],
  };

  render(<SelectionWrapper initialValue={initialSelection} />);

  function findCombobox(value: string) {
    return screen.getAllByRole("combobox").find((el) => (el as any).value === value)
  }

  expect(findCombobox("alpha")).not.toBeUndefined();
  expect(findCombobox("beta")).not.toBeUndefined();

  const deleteButtons = screen.queryAllByRole("button").filter((el) => el.innerHTML === "-");
  expect(deleteButtons).toHaveLength(initialSelection.dataProps.length);

  await user.click(deleteButtons[0]);

  expect(findCombobox("alpha")).toBeUndefined();
  expect(findCombobox("beta")).not.toBeUndefined();
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

// NOTE: This hack is required to await immediately scheduled async functions.
// NOTE: This function was created for combobox that is combined with async suggestion function. It
// works but I can't guarantee there aren't race conditions. I imagine the suggestion function is
// scheduled before user.click and that's why it works.
async function waitAsync(user: UserEvent): Promise<void> {
  await user.click(document.body);
}

test("data prop labels are shown", async () => {
  const user = userEvent.setup();

  const selection: ComplexPropertySelection = {
    rdfType: "",
    dataProps: [
      { name: "data_value" },
    ],
    objectProps: [],
  };

  const dataPropFetcher: PropFetcher = async () => {
    return [
      { label: "data_label", value: "data_value" },
    ];
  };

  render(<ComplexPropertySelector {...{selection, dataPropFetcher}} />);

  await waitAsync(user);

  expect(screen.queryAllByDisplayValue("data_label")).not.toHaveLength(0);
});

test("object prop labels are shown", async () => {
  const user = userEvent.setup();

  const selection: ComplexPropertySelection = {
    rdfType: "",
    dataProps: [],
    objectProps: [
      { name: "cool_value", selection: makeDefaultSelection() },
    ],
  };

  const objectPropFetcher: PropFetcher = async () => {
    return [
      { label: "cool_label", value: "cool_value" },
    ];
  };

  render(<ComplexPropertySelector {...{selection, objectPropFetcher}} />);

  await waitAsync(user);

  expect(screen.queryAllByDisplayValue("cool_label")).not.toHaveLength(0);
});
