import type { UseQueryResult } from "@tanstack/react-query";

export default function StateGuard<T, E extends Error>({
    queryRes,
    successComponent,
}: {
    queryRes: UseQueryResult<T, E>,
    successComponent: (val: T) => React.ReactNode,
}) {
    const { isPending, isError, data, error } = queryRes;

    if (isPending) {
        return (
            <p>Pending...</p>
        );
    }

    if (isError) {
        return <p>Error: {error.message}</p>
    }

    return successComponent(data);
}
