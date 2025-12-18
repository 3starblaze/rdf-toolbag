import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export default function ExamineSparql({
    query,
}: {
    query: string,
}) {
    return (
        <Dialog>
            <DialogTrigger>
                <Button variant="outline">
                    Examine SparQL
                </Button>
            </DialogTrigger>
            <DialogContent
                className={cn(
                    "max-w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)]",
                    "max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-4rem)]",
                    "overflow-scroll",
                )}
            >
                <DialogHeader>
                    <DialogTitle>
                        SparQL Query
                    </DialogTitle>
                </DialogHeader>
                <pre>
                    {query}
                </pre>
            </DialogContent>
        </Dialog>
    );
}
