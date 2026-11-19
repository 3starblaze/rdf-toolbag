import { binaryConstraintText, defaultBinaryArgs } from "../common/binary";
import type { ConstraintDefinition } from "../types";
import EditView from "./EditView";
import MainView from "./MainView";
import { rdfTypeQueryFragment } from "./query";
import { RDF_TYPE_LABEL, RDF_TYPE_OPERATOR, type RdfTypeConstraint } from "./types";

export type { RdfTypeConstraint } from "./types";

export const rdfTypeConstraint: ConstraintDefinition<RdfTypeConstraint> = {
    subType: "rdfType",
    label: RDF_TYPE_LABEL,
    description: "Target item has the expected type.",
    create: ({ id, selection }) => ({ subType: "rdfType", id, ...defaultBinaryArgs(selection) }),
    ...binaryConstraintText<RdfTypeConstraint>({ label: RDF_TYPE_LABEL, operator: RDF_TYPE_OPERATOR }),
    queryFragment: rdfTypeQueryFragment,
    MainView,
    EditView,
};
