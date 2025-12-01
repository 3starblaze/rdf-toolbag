import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SparqlEndpoint from "./sections/sparql_endpoint";

const queryClient = new QueryClient();


function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Main />
        </QueryClientProvider>
    );
}

function Main() {
    return (
        <div className="">
            <div className="p-4 border-b border-gray-500">
                <h1 className="text-lg font-bold">RDF Toolbag</h1>
            </div>

            <div className="p-4">
                <SparqlEndpoint />
            </div>
        </div>
    )
}

export default App
