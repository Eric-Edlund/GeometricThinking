
export interface NodeStruct {
  id: number
  /**
   * Top left
   */
  pos: [number, number]
  dims: [number, number]
  text: string

  factualDependencies?: number[]
}

export interface Sequence {
  id: number
  color: string
  nodes: number[]
}

export interface OptionSet {
  id: number
  root: number
  children: number[]
}

export interface InstanceSet {
  id: number
  root: number
  children: number[]
}

export interface Region {
  id: number
  root: number
  children: number[]
}


export class ObservableGraph {
  private _nodes = new Map<number, NodeStruct>()
  private _sequences: Sequence[] = []
  private _optionSets: OptionSet[] = []
  private _instanceSets: InstanceSet[] = []
  private _regions: Region[] = []
  private _listeners: (() => void)[] = []
  private _nextId = 1

  nodes() {
    return this._nodes.values()
  }

  sequences() {
    return this._sequences
  }

  optionSets() {
    return this._optionSets
  }

  instanceSets() {
    return this._instanceSets
  }

  regions() {
    return this._regions
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

  addSeq(seq: Sequence) {
    this._sequences.push(seq)
  }

  addOptionSet(set: OptionSet) {
    this._optionSets.push(set)
  }

  addInstanceSet(set: InstanceSet) {
    this._instanceSets.push(set)
  }

  addRegion(region: Region) {
    this._regions.push(region)
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
