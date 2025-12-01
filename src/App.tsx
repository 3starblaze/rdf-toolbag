import SparqlEndpoint from "./sections/sparql_endpoint";

function App() {
    return (
        <div className="">
            <div className="p-4 border-b border-gray-500">
                <h1 className="text-lg font-bold">RDF Toolbag</h1>
            </div>

            <div className="p-4 max-w-prose">
                <SparqlEndpoint />
            </div>
        </div>
    )
}

export default App
