import { GraphDiff, ObservableGraph } from "./graph"

function host(): string {
  return import.meta.env.VITE_BACKEND_HOST
}

export class ServerProxy {
  private graphStateNum: number
  private serverAvailable = true
  private graph: ObservableGraph

  constructor(graph: ObservableGraph) {
    this.graph = graph
    this.graphStateNum = this.graph.currentState()

    this.graph.listen((stateNum, diff) => this.sendState(stateNum, diff))
    // setInterval(() => {
    //   this.longPollUpdates()
    // })
  }

  async initialSync() {
    const graphId = 1
    const res = await fetch(`${host()}/apiv1/${graphId}/get`)
    const obj = await res.json()
    console.log(obj)

    this.graph.applyChanges(obj.nodes)
    this.graph.notify()
  }

  private async sendState(stateNum: number, diff: GraphDiff) {
    if (!this.serverAvailable) return
    if (stateNum <= this.graphStateNum) {
      return
    }
    const graphId = 1
    this.graphStateNum = stateNum

    const msg = JSON.stringify({
      graphId: graphId,
      changed: [...diff.nodes].map((id) => this.graph.get(id)),
    })
    console.log('Sending to server:', msg)

    try {
      const res = await fetch(`${host()}/apiv1/${graphId}/update`, {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: msg,
      })
    } catch {
      this.serverAvailable = false
    }
  }

  async longPollUpdates() {
    if (!this.serverAvailable) return
    const graphId = 1

    try {
      const res = await fetch(`${host()}/apiv1/${graphId}/watch`)
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
