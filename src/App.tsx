import { useEffect, useState } from "react";
import { db } from "./db";
import { getUniqueArchetypeCount } from "./dbUtil";

function App() {
    const [uniqueArchetypeCount, setUniqueArchetypeCount] = useState<null | number>(null);

    useEffect(() => {
        const count = getUniqueArchetypeCount(db);
        setUniqueArchetypeCount(count);
    });


    return (
        <>
            <div className="">
                <div className="p-4 bg-blue-100">
                    <h1>Archetype information</h1>
                </div>
                <div className="p-4">
                    {(uniqueArchetypeCount === null) ? (
                        <p>Count is being retrieved...</p>
                    ) : (
                        <p>Unique archtype count: {uniqueArchetypeCount}</p>
                    )}
                </div>
            </div>
        </>
    )
}

export default App
