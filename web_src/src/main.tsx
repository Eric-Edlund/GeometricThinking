import { GraphEditor } from "./components/GraphEditor.tsx"
import "./App.css"
import { NodeStruct, ObservableGraph } from "./util/graph.ts"
import { DEFAULT } from "./constants.ts"

const root = document.getElementById("root")!
root.style.backgroundColor = "black"
root.style.width = "100%"
root.style.height = "100%"

const graph = new ObservableGraph()

let testGraph: NodeStruct[] | string | null = localStorage.getItem("testgraph")
if (!testGraph) {
  localStorage.setItem('testgraph', JSON.stringify(DEFAULT))
  testGraph = DEFAULT
} else {
  testGraph = JSON.parse(testGraph)
}

console.log(testGraph)

graph.addAll(testGraph as NodeStruct[])
graph.listen(() => {
  localStorage.setItem('testgraph', JSON.stringify([...graph.nodes()]))
})

setInterval(() => {
  localStorage.setItem('testgraph', JSON.stringify([...graph.nodes()]))
}, 1000)

const editor = new GraphEditor(root, graph, () => {}, {localStorageStateKey: 'grapheditor'})
// editor.moveCenter([1.0, 0.7])
editor.focus()
