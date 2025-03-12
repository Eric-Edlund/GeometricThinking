import { GraphDiff, ObservableGraph } from "./graph"

function host(): string {
  return import.meta.env.VITE_BACKEND_HOST
}

export class ServerProxy {
  private graphStateNum: number
  private serverStateNumber: number = -1
  private serverAvailable = true
  private graph: ObservableGraph

  private waitingForUpdateResponse = false
  private onUpdateResponse: (() => void) | null = null

  constructor(graph: ObservableGraph) {
    this.graph = graph
    this.graphStateNum = this.graph.currentState()
  }

  async initialSync() {
    const graphId = 1
    let res, obj;
    try {
      res = await fetch(`${host()}/apiv1/${graphId}/get`)
      obj = await res.json()
    } catch (e) {
      this.markServerUnavailable("Problem during initial get" + e)
      console.error(e)
      return
    }

    this.serverStateNumber = obj.changeId

    this.graph.applyChanges(obj.nodes)
    this.graph.notify()

    this.graph.listen((stateNum, diff) => {this.sendState(stateNum, diff)})
    this.longPollUpdates()
  }

  private markServerUnavailable(reason: string) {
    console.log("=== Server unavailable! ===")
    console.error(reason)
    this.serverAvailable = false
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
      this.waitingForUpdateResponse = true
      const res = await fetch(`${host()}/apiv1/${graphId}/update`, {
        method: "POST",
        headers: {"Content-Type": "application/json" },
        body: msg,
      })
      const json = await res.json()
      this.serverStateNumber = json.changeId
    } catch {
      this.markServerUnavailable("Problem sending update")
    } finally {
      this.waitingForUpdateResponse = false
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
          // headers: { "Content-Type": "application/json" },
        },
      )
      const obj = await res.json()
      const {
        changed: { nodes },
      } = obj

      if (this.waitingForUpdateResponse) {
        await new Promise<void>((res, _rej) => {
          this.onUpdateResponse = () => {
            this.onUpdateResponse = null
            res()
          }
        })
      }

      if (this.serverStateNumber < obj.changeId) {
        this.serverStateNumber = obj.changeId
        this.graphStateNum = this.graph.applyChanges(nodes)
        this.graph.notify()
      }
      
      setTimeout(() => {
        this.longPollUpdates()
      }, 10)
    } catch (e) {
      // this.markServerUnavailable("Problem watching for update " + e)
      throw e
    }
  }
}
