import ComplexPropertySelector, { makeDefaultSelection, type ComplexPropertySelection } from "@/components/complex_property_selector";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatQuery } from "@/misc/complex_property_query_builder";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

function CollapsedInfo({
    title,
    children
}: {
    title: string,
    children: React.ReactNode,
}) {
    return (
        <Collapsible className="group flex flex-col gap-2">
            <CollapsibleTrigger
                className="flex flex-row gap-1 items-center bg-gray-100 px-4 py-2 rounded-lg w-fit cursor-pointer"
            >
                <p>{title}</p>
                <ChevronDown
                    className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="bg-gray-100">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}

function QueryDisplay({
    selection,
}: {
    selection: ComplexPropertySelection,
}) {
    return (
        <CollapsedInfo title="Query">
            <pre>
                {formatQuery(selection)}
            </pre>
        </CollapsedInfo>
    );
}

function SelectionDisplay({
    selection,
}: {
    selection: ComplexPropertySelection,
}) {
    return (
        <CollapsedInfo title="JSON">
            <pre>
                {JSON.stringify(selection, undefined, 2)}
            </pre>
        </CollapsedInfo>
    );
}

export default function PropertyQueryBuilder() {
    const [selection, setSelection] = useState(makeDefaultSelection);

    const specialRdfType = "foobar";

    return (
        <div className="flex flex-col gap-4">
            <p>
                {"Enter type "}
                <span className="bg-blue-100">{specialRdfType}</span>
                {" for extra property suggestions."}
            </p>
            <SelectionDisplay selection={selection} />
            <QueryDisplay selection={selection} />
            <ComplexPropertySelector
                selection={selection}
                onSelectionChange={setSelection}
                rdfTypeFetcher={async () => [
                    { label: ":barbaz", value: "http://barbaz" },
                    { label: specialRdfType, value: specialRdfType },
                ]}
                dataPropFetcher={async (rdfType) => [
                    { value: "http://data0", label: ":data0" },
                    { value: "http://data1", label: ":data1" },
                    ...((rdfType === specialRdfType)
                      ? [{ value: "http://special_data0", label: ":special_data0" }]
                      : []
                    ),
                ]}
                objectPropFetcher={async (rdfType) => [
                    { value: "http://obj0", label: ":obj0" },
                    { value: "http://obj1", label: ":obj1" },
                    ...((rdfType === specialRdfType)
                        ? [{ value: "http://special_obj0", label: ":special_obj0" }]
                        : []
                    ),
                ]}
            />
        </div>
    );
}
