import { GraphDiff, ObservableGraph } from "./graph"

function host(): string {
  return import.meta.env.VITE_BACKEND_HOST
}

export class ServerProxy {
  private graphStateNum: number
  private serverStateNumber: number = -1
  private serverAvailable = true
  private graph: ObservableGraph

  constructor(graph: ObservableGraph) {
    this.graph = graph
    this.graphStateNum = this.graph.currentState()
  }

  async initialSync() {
    const graphId = 1
    const res = await fetch(`${host()}/apiv1/${graphId}/get`)
    const obj = await res.json()

    this.serverStateNumber = obj.changeId

    this.graph.applyChanges(obj.nodes)
    this.graph.notify()

    this.graph.listen((stateNum, diff) => this.sendState(stateNum, diff))
    this.longPollUpdates()
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
      changed: {
        nodes: [...diff.nodes].map((id) => this.graph.get(id))
      },
    })

    try {
      const res = await fetch(`${host()}/apiv1/${graphId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: msg,
      })
      const json = await res.json()
      this.serverStateNumber = json.changeId
    } catch {
      this.serverAvailable = false
    }
  }

  async longPollUpdates() {
    if (!this.serverAvailable) return
    const graphId = 1

    try {
      const res = await fetch(
        `${host()}/apiv1/${graphId}/watch/${this.serverStateNumber}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      )
      const obj = await res.json()
      const {
        changed: { nodes },
      } = obj

      if (this.serverStateNumber != obj.changeId) {
        this.serverStateNumber = obj.changeId
        this.graphStateNum = this.graph.applyChanges(nodes)
        this.graph.notify()
      }
      
      setTimeout(() => {
        this.longPollUpdates()
      }, 10)
    } catch (e) {
      this.serverAvailable = false
    }
  }
}
