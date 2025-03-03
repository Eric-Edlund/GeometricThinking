
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
  private _nextId = 1

  nodes() {
    return this._nodes.values()
  }

  entries() {
    return this._nodes.entries()
  }

  addAll(nodes: NodeStruct[]) {
    for (const n of nodes) {
      this._nodes.set(n.id, n)
      this._nextId = Math.max(this._nextId, n.id + 1)
    }
    this.notify()
  }

  add(n: NodeStruct) {
    this._nodes.set(n.id, n)
    this._nextId = Math.max(this._nextId, n.id + 1)
    this.notify()
  }

  get(id: number) {
    return this._nodes.get(id)
  }

  listen(cb: () => void) {
    this._listeners.push(cb)
  }

  nextId() {
    const result = this._nextId
    this._nextId++;
    return result
  }

  markDirty(id: number) {
    this.notify()
  }

  private notify() {
    for (const cb of this._listeners) {
      cb()
    }
  }
}
