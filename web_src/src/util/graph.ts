
export interface NodeStruct {
  id: number
  /**
   * Top left
   */
  pos: [number, number]
  dims: [number, number]
  text: string

  factualDependencies: number[]
}


export class ObservableGraph {
  private _nodes = new Map<number, NodeStruct>()
  private _listeners: (() => void)[] = []

  nodes() {
    return this._nodes.values()
  }

  entries() {
    return this._nodes.entries()
  }

  addAll(nodes: NodeStruct[]) {
    for (const n of nodes) {
      this._nodes.set(n.id, n)
    }
    this.notify()
  }

  listen(cb: () => void) {
    this._listeners.push(cb)
  }

  private notify() {
    for (const cb of this._listeners) {
      cb()
    }
  }
}
