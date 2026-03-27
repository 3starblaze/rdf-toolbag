import ComplexPropertySelector, { makeDefaultSelection } from "@/components/complex_property_selector";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
            <Collapsible className="group flex flex-col gap-2">
                <CollapsibleTrigger
                    className="flex flex-row gap-1 items-center bg-gray-100 px-4 py-2 rounded-lg w-fit cursor-pointer"
                >
                    <p>JSON</p>
                    <ChevronDown
                        className="size-4 group-data-[state=open]:rotate-180 transition-transform"
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-gray-100">
                    <pre>
                        {JSON.stringify(selection, undefined, 2)}
                    </pre>
                </CollapsibleContent>
            </Collapsible>
            <ComplexPropertySelector
                selection={selection}
                onSelectionChange={setSelection}
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
