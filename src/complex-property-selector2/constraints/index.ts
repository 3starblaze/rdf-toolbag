import { langMatchesConstraint, type LangMatchesConstraint } from "./lang-matches";
import { rdfTypeConstraint, type RdfTypeConstraint } from "./rdf-type";
import type { ConstraintDefinition } from "./types";

export type { RdfTypeConstraint } from "./rdf-type";
export type { LangMatchesConstraint } from "./lang-matches";
export type * from "./types";

/**
 * Every constraint that a selection can hold, discriminated by `subType`.
 *
 * NOTE: To add a constraint kind, create a folder next to this file (see `rdf-type/`), add its type
 * to this union and its definition to `constraintDefinitions`.
 */
export type Constraint = RdfTypeConstraint | LangMatchesConstraint;

export type ConstraintSubType = Constraint["subType"];

type ConstraintDefinitions = {
    [K in ConstraintSubType]: ConstraintDefinition<Extract<Constraint, { subType: K }>>
};

export const constraintDefinitions: ConstraintDefinitions = {
    rdfType: rdfTypeConstraint,
    langMatches: langMatchesConstraint,
};

/** Constraint kinds in the order they are offered to the user. */
export const constraintSubTypes: readonly ConstraintSubType[] = ["rdfType", "langMatches"];

/**
 * Definition of the constraint's kind.
 *
 * NOTE: The return type is widened so that the definition can be used with any constraint. It is
 * only ever called with the constraint whose `subType` it was looked up by.
 */
export function definitionOf<C extends Constraint>(constraint: C): ConstraintDefinition<C> {
    return constraintDefinitions[constraint.subType] as unknown as ConstraintDefinition<C>;
}
