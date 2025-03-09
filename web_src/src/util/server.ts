import { GraphDiff, ObservableGraph } from "./graph"


export class ServerProxy {
  private graphStateNum: number
  private serverAvailable = true
  private graph: ObservableGraph

  constructor(graph: ObservableGraph) {
    this.graph = graph
    this.graphStateNum = this.graph.currentState()

    this.graph.listen((stateNum, diff) => this.sendState(stateNum, diff))
    setInterval(() => {
      this.longPollUpdates()
    })
  }

  private async sendState(stateNum: number, diff: GraphDiff) {
    console.log("Send state")
    if (!this.serverAvailable) return
    if (stateNum <= this.graphStateNum) {
      return
    }
    const graphId = 1
    this.graphStateNum = stateNum
    try {
      const res = await fetch(`/apiv1/${graphId}/update`, {
        method: "POST",
        body: JSON.stringify({
          graphId: graphId,
          changed: [...diff.nodes].map((id) => this.graph.get(id)),
        }),
      })
      console.log("Update response: ", res)
    } catch {
      this.serverAvailable = false
    }
  }

  async longPollUpdates() {
    if (!this.serverAvailable) return
    const graphId = 1

    try {
      const res = await fetch(`/apiv1/${graphId}/watch`)
      console.log("Received from server: ", res)
      const obj = await res.json()
      const {
        changed: { nodes },
      } = obj

      this.graphStateNum = this.graph.applyChanges(nodes)
      this.graph.notify()
    } catch {
      this.serverAvailable = false
    }
  }
}
