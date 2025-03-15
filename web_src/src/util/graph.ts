export interface NodeStruct {
  id: number
  /**
   * Top left
   */
  pos: [number, number]
  dims: [number, number]
  text: string

  type?: string
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

export interface GraphDiff {
  /**
   * Set of changed nodes which will need to be reloaded.
   */
  nodes: Set<number>
}

export class ObservableGraph {
  private _nodes = new Map<number, NodeStruct>()
  private _sequences: Sequence[] = []
  private _optionSets: OptionSet[] = []
  private _instanceSets: InstanceSet[] = []
  private _regions: Region[] = []
  private _listeners: ((stateNum: number, changes: GraphDiff) => void)[] = []
  private _nextId = -1

  private readonly _pendingDiff: GraphDiff = {nodes: new Set()}

  // Increases by one every time the state is changed.
  // Used to prevent looping.
  private _stateNumber = 0

  currentState() {
    return this._stateNumber
  }

  numNodes() {
    return this._nodes.size
  }

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

  addAll(nodes: NodeStruct[]): number {
    for (const n of nodes) {
      this._nodes.set(n.id, n)
      this._pendingDiff.nodes.add(n.id)
      if (n.id < this._nextId)
        this._nextId = n.id - 1
    }
    return ++this._stateNumber
  }

  add(n: NodeStruct): number {
    this._nodes.set(n.id, n)
    this._pendingDiff.nodes.add(n.id)
      if (n.id < this._nextId)
        this._nextId = n.id - 1
    return ++this._stateNumber
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

  listen(cb: (stateNum: number, diff: GraphDiff) => any) {
    this._listeners.push(cb)
  }

  nextId() {
    return this._nextId--
  }

  /**
   * Returns the new state id after thes changes are applied.
   */
  applyChanges(changedNodes: NodeStruct[]): number {
    for (const node of changedNodes) {
      if (this._nodes.has(node.id)) {
        const shared = this._nodes.get(node.id)!
        shared.pos = node.pos
        shared.dims = node.dims
        shared.text = node.text
      } else {
        this._nodes.set(node.id, node)
      }
      this._pendingDiff.nodes.add(node.id)
    }

    return ++this._stateNumber
  }

  /**
   * The node's content has changed.
   */
  markDirty(id: number): number {
    this._pendingDiff.nodes.add(id)
    return ++this._stateNumber
  }

  notify() {
    for (const cb of this._listeners) {
      cb(this._stateNumber, this._pendingDiff)
    }

    this._pendingDiff.nodes.clear()
  }
}
