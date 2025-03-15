import { GraphEditor } from "./components/editor/GraphEditor.tsx"
import "./App.css"
import { GraphDiff, InstanceSet, NodeStruct, ObservableGraph, OptionSet, Region, Sequence } from "./util/graph.ts"
import { DEFAULT } from "./constants.ts"
import { ServerProxy } from "./util/server.ts"

const root = document.getElementById("root")!
root.style.backgroundColor = "black"
root.style.width = "100%"
root.style.height = "100%"

const graph = new ObservableGraph()

function loadGraphFromLocalStorage() {
  let testGraph: NodeStruct[] | string | null =
    localStorage.getItem("testgraph")
  if (!testGraph) {
    localStorage.setItem("testgraph", JSON.stringify(DEFAULT))
    testGraph = DEFAULT
  } else {
    testGraph = JSON.parse(testGraph)
  }

  console.log(testGraph)

  graph.addAll(testGraph as NodeStruct[])
  graph.notify()

  // Save locally
  graph.listen((_stateNum: number, _diff: GraphDiff) => {
    localStorage.setItem("testgraph", JSON.stringify([...graph.nodes()]))
  })
}

// graph.addSeq({
//   id: 1,
//   color: 'lightblue',
//   nodes: [37, 38, 39, 43, 44, 46,48,51],
// } satisfies Sequence)
// graph.addSeq({
//   id: 2,
//   color: 'lightblue',
//   nodes: [57,58,78],
// } satisfies Sequence)
// graph.addOptionSet({
//   id: 1,
//   root: 17,
//   children: [18, 19, 20],
// } satisfies OptionSet)
// graph.addInstanceSet({
//   id: 1,
//   root: 58,
//   children: [59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77],
// } satisfies InstanceSet)
// graph.addRegion({
//   id: 1,
//   root: 57,
//   children: [],
// } satisfies Region)

const server = new ServerProxy(graph)
server.initialSync()

// loadGraphFromLocalStorage()
// graph.notify()

const editor = new GraphEditor(root, graph, () => {}, {
  localStorageStateKey: "grapheditor",
})
editor.focus()
