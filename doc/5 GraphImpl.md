The visual representation of the graph needs to be easy for humans.

- Nodes are visually distinct
- Nodes stay in the same place so user doesn't need to keep rereading them
- Node types are visually communicated
- Nodes are visually grouped into small numbers. This solution works because
  it lets us greedily build up solutions. We need to make explicit dependencies
  between groups so they can be cleanly separated.
- Graphs can be read in chunks. Chunks can't depend on each other both ways.
  They need an ordering.

- Dependencies are clear
- Updates are replayable


