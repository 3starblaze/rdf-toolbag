import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    useControllableState
} from "@radix-ui/react-use-controllable-state";

/**
 * String array input which is ideal for collecting properties.
 */
export function PropertySelector({
    value: controlledValue,
    defaultValue,
    onValueChange,
}: {
    value?: string[],
    defaultValue?: string[],
    onValueChange?: (newValue: string[]) => void,
}) {
    const [selectedProperties, setSelectedProperties] = useControllableState<string[]>({
        prop: controlledValue,
        defaultProp: defaultValue ?? [],
        onChange: onValueChange,
    });

    return (
        <div className="max-w-prose flex flex-col gap-2">
            <div className="flex flex-col gap-1">
                {selectedProperties.map((item, i) => (
                    <div
                        key={i}
                        className="flex gap-2"
                    >
                        <Input
                            className="border-2"
                            value={item}
                            onChange={(ev) => setSelectedProperties([
                                ...selectedProperties.slice(0, i),
                                ev.target.value,
                                ...selectedProperties.slice(i + 1),
                            ])}
                        />
                        <Button
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={() => setSelectedProperties([
                                ...selectedProperties.slice(0, i),
                                ...selectedProperties.slice(i + 1),
                            ])}
                        >
                            -
                        </Button>
                    </div>
                ))}
            </div>
            <Button
                className="cursor-pointer"
                variant="outline"
                onClick={() => setSelectedProperties((old) => [...old, ""])}
            >
                +
            </Button>
        </div>
    );
}
