import { describe, it, expect } from 'vitest'
import { ObservableGraph } from "./graph";


function testGraph() {
  const graph = new ObservableGraph()

  graph.add({
    id: 1,
    pos: [0,0],
    dims: [0,0],
    text: "Text",
  })
  graph.notify()

  return graph
}



describe('ObservableGraph', () => {
  it('Notify works', () => {
    const graph = testGraph()

    let listener1 = false, listener2 = false;
    let l1State = graph.currentState(), l2State = graph.currentState();
    graph.listen((stateNum, _) => {
      if (l1State >= stateNum) {
        return
      }
      listener1 = true
    })

    graph.listen((stateNum, diff) => {
      if (l2State >= stateNum) {
        return
      }

      console.log(diff)
      expect(diff).toEqual({nodes: new Set([1])})

      listener2 = true
    })

    // Listener one creates a change and notifies it
    l1State = graph.markDirty(1)
    graph.notify()
    expect(listener1).toEqual(false)
    expect(listener2).toEqual(true)
  })

  it('Can add nodes', () => {
    const graph = testGraph()
    const numNodes = graph.numNodes()

    const nextId = graph.nextId()
    expect(nextId).toEqual(-1)

    graph.add({
      id: nextId,
      pos: [0,0],
      dims: [0,0],
      text: "Text",
    })

    expect(graph.numNodes()).toEqual(numNodes + 1)

  })
})
