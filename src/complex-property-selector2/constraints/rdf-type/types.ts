import type { BinaryConstraint } from "../common/binary";

/** The target item has the expected type. */
export interface RdfTypeConstraint extends BinaryConstraint {
    subType: "rdfType",
}

export const RDF_TYPE_LABEL = "Type";
export const RDF_TYPE_OPERATOR = "is";
