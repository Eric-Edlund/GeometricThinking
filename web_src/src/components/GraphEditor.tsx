import { Add, Circle } from "@mui/icons-material"
import { Root, createRoot } from "react-dom/client"
import { add, avg, scale, subtract, Vec2 } from "../util/points"
import { Box, IconButton, TextareaAutosize, Typography } from "@mui/material"

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

// Debug
const NODE_ALPHA = 1.0
const DRAW_GRID = true

/**
 * Handles user input.
 *
 * There are client pixel coords and graph coords. No other coords!
 */
export class GraphEditor {
  private readonly el: HTMLElement
  // Node id to els
  private readonly graph = new Map<number, NodeStruct>()
  private readonly nodes = new Map<number, [HTMLElement, Root]>()
  private readonly lineCanvas: HTMLCanvasElement =
    document.createElement("canvas")
  private readonly overlayDiv = document.createElement("div")
  private readonly overlayReact: Root = createRoot(this.overlayDiv)
  // In graph coordinates
  private readonly center: [number, number] = [0, 0]
  // Width of the client in graph units.
  private width: number

  private readonly publishGraphCb: (graph: NodeStruct[]) => void

  private mouseDown = false

  constructor(el: HTMLElement, publishGraph: (node: NodeStruct[]) => void) {
    if (this.lineCanvas.getContext("2d") == null) {
      console.error("Could not create 2d drawing context for canvas.")
      throw new Error()
    }

    this.el = el
    // Fit 3 40ch blocks
    this.width = el.clientWidth / (10 * 40)
    this.initEl()
    this.publishGraphCb = publishGraph
    this.draw()
  }

  /**
   * Set the new center in graph coords.
   */
  moveCenter(center: Vec2) {
    this.center[0] = center[0]
    this.center[1] = center[1]
    this.draw()
  }

  setGraph(nodes: NodeStruct[]) {
    // Clean
    this.el.replaceChildren(this.lineCanvas, this.overlayDiv)
    this.graph.clear()
    this.nodes.clear()

    // Add new
    for (const n of nodes) {
      this.graph.set(n.id, n)
      const nEl = newNodeEl()
      nEl.style.zIndex = "1"
      this.el.appendChild(nEl)
      this.nodes.set(n.id, [nEl, createRoot(nEl)])
    }

    // Let the nodes attach to the dom and render so we know their size.
    // TODO: Watch their sizes and redraw when needed.
    setTimeout(() => this.draw(), 100)
  }

  private initEl() {
    this.el.style.backgroundColor = "rgba(0.1, 0.1, 0.1, 1.0)"

    this.el.append(this.lineCanvas, this.overlayDiv)

    this.el.style.zIndex = "-5"
    this.lineCanvas.style.zIndex = "-4"
    // Nodes are z = 1
    this.overlayDiv.style.zIndex = "2"

    this.el.addEventListener(
      "mousedown",
      (ev) => {
        this.mouseDown = true
        ev.preventDefault()
      },
      { passive: false },
    )
    this.el.addEventListener("mouseup", () => {
      this.mouseDown = false
    })
    this.el.addEventListener("mousemove", (ev) => {
      if (this.mouseDown) {
        const scaleFactor = this.width / this.el.clientWidth
        this.center[0] -= ev.movementX * scaleFactor
        this.center[1] -= ev.movementY * scaleFactor
        this.draw()
      }
    })

    this.el.addEventListener(
      "touchstart",
      (ev) => {
        console.log("touch")
        if (ev.touches.length > 1) {
          // TODO: Handle multi-touch
          ev.preventDefault()
        }
      },
      { passive: false },
    )

    document.addEventListener(
      "wheel",
      (ev) => {
        const clientToGraph = this.width / this.el.clientWidth
        // Client pixels
        let deltaX: number, deltaY: number
        switch (ev.deltaMode) {
          case ev.DOM_DELTA_PIXEL:
            deltaX = ev.deltaX // Random constant, idk bro
            deltaY = ev.deltaY
            break
          case ev.DOM_DELTA_LINE:
            deltaX = ev.deltaX * 16 // Random constant
            deltaY = ev.deltaY * 16
            break
          case ev.DOM_DELTA_PAGE:
            // TODO: Is this legit?
            deltaX = ev.deltaX
            deltaY = ev.deltaY
            break
        }

        if (ev.ctrlKey) {
          const preCursorPos = this.intoGraphSpace([ev.clientX, ev.clientY])
          this.width *= 1.1 ** ev.deltaY
          // Max pixel width per graph unit
          this.width = Math.max(this.el.clientWidth / 500, this.width)
          const postCursorPos = this.intoGraphSpace([ev.clientX, ev.clientY])
          const deltaCursorPos = subtract(postCursorPos, preCursorPos)
          // Move center so that the point under the cursor didn't move
          this.center[0] -= deltaCursorPos[0]
          this.center[1] += deltaCursorPos[1]
        } else {
          this.center[0] -= -ev.deltaX * clientToGraph
          this.center[1] -= -ev.deltaY * clientToGraph
        }

        ev.preventDefault()
        this.draw()
      },
      { passive: false },
    )

    const resizeLayers = () => {
      this.lineCanvas.style.width = `${this.el.clientWidth}px`
      this.lineCanvas.style.height = `${this.el.clientHeight}px`
      this.lineCanvas.width = this.el.clientWidth
      this.lineCanvas.height = this.el.clientHeight
      this.overlayDiv.style.width = `${this.el.clientWidth}px`
      this.overlayDiv.style.height = `${this.el.clientHeight}px`
    }
    resizeLayers()
    window.addEventListener("resize", () => {
      // Increase the width so the scale stays the same
      this.width *= this.el.clientWidth / this.lineCanvas.clientWidth
      resizeLayers()
      this.draw()
    })
  }

  private intoGraphSpace(clientPos: Vec2): Vec2 {
    return [
      this.center[0] +
        ((clientPos[0] / this.el.clientWidth) * 2 - 1) * (this.width / 2),
      this.center[1] +
        ((1 - clientPos[1] / this.el.clientHeight) * 2 - 1) * (this.width / 2),
    ]
  }

  private intoClientSpace(graphPos: Vec2): Vec2 {
    const scaleFactor = this.el.clientWidth / this.width
    return [
      // Distance from the center of the client in graph coords *-> in client coords + client width
      (graphPos[0] - this.center[0]) * scaleFactor + this.el.clientWidth / 2,
      (graphPos[1] - this.center[1]) * scaleFactor + this.el.clientHeight / 2,
    ]
  }

  private draw() {
    this.overlayReact.render(<EditorOverlay />)

    // Determine scale
    let semanticScale: "readable" | "word" = "readable"
    const charsPerGraphUnit = this.el.clientWidth / this.width / 12
    if (charsPerGraphUnit > 30) {
      semanticScale = "readable"
    } else {
      semanticScale = "word"
    }

    for (const [id, node] of this.graph.entries()) {
      const [nEl, root] = this.nodes.get(id)!
      const clientCoords = this.intoClientSpace(node.pos)
      const graphToClient = this.el.clientWidth / this.width

      if (semanticScale == "readable") {
        const margin = 8
        applyCss(nEl, {
          width: px(node.dims[0] * graphToClient),
          height: px(node.dims[1] * graphToClient),
          left: px(clientCoords[0]),
          top: px(clientCoords[1]),
          boxSizing: "border-box",
          padding: px(margin),
        })
        root.render(
          <NodeReact
            node={node}
            width={nEl.clientWidth - 2 * margin}
            height={nEl.clientHeight - 2 * margin}
          />,
        )
      } else {
        const iconWidth = 24
        const centerClientPos = this.intoClientSpace(
          add(node.pos, scale(0.5, node.dims)),
        )
        const tlClientPos = subtract(
          centerClientPos,
          scale(0.5, [iconWidth, iconWidth]),
        )

        applyCss(nEl, {
          boxSizing: "content-box",
          padding: "0",
          width: px(iconWidth),
          height: px(iconWidth),
          left: px(tlClientPos[0]),
          top: px(this.el.clientHeight - tlClientPos[1]),
        })
        root.render(
          <Circle
            color="primary"
            sx={{
              width: nEl.clientWidth,
              height: nEl.clientHeight,
              margin: 0,
              padding: 0,
            }}
          />,
        )
      }
    }

    const ctx = this.lineCanvas.getContext("2d")!
    ctx.clearRect(0, 0, this.lineCanvas.width, this.lineCanvas.height)

    if (DRAW_GRID) {
      ctx.lineWidth = 1
      ctx.strokeStyle = "darkslategray"
      let maxX = Math.floor(this.center[0] + this.width * 0.5) + 1
      let minX = Math.floor(this.center[0] - this.width * 0.5)
      let jump = Math.max(Math.ceil((maxX - minX) / 10), 1)
      // Find the nearest power of 2
      jump = 2 ** Math.floor(Math.log2(jump))
      // Align minx to 0 + n * jump
      minX = Math.floor(minX / jump) * jump
      for (let i = minX; i < maxX; i += jump) {
        const pos = this.intoClientSpace([i, 0])
        ctx.moveTo(pos[0], 0)
        ctx.lineTo(pos[0], this.el.clientHeight)
        ctx.stroke()
      }
      const aspectRatio = this.el.clientHeight / this.el.clientWidth
      let maxY = Math.floor(this.center[1] + this.width * aspectRatio * 0.5) + 1
      let minY = Math.floor(this.center[1] - this.width * aspectRatio * 0.5)
      minY = Math.floor(minY / jump) * jump
      for (let i = minY; i < maxY; i += jump) {
        const pos = this.intoClientSpace([0, i])
        ctx.moveTo(0, pos[1])
        ctx.lineTo(this.el.clientWidth, pos[1])
        ctx.stroke()
      }
    }

    for (const [id, node] of this.graph.entries()) {
      const nEl = this.nodes.get(id)![0]
      for (const depId of node.factualDependencies) {
        const dep = this.nodes.get(depId)![0]

        const srcPos: Vec2 = [
          dep.offsetLeft + 0.5 * dep.clientWidth,
          dep.offsetTop + 0.5 * dep.clientHeight,
        ]
        const destPos: Vec2 = [
          nEl.offsetLeft + 0.5 * nEl.clientWidth,
          nEl.offsetTop + 0.5 * nEl.clientHeight,
        ]

        ctx.lineWidth = 5
        ctx.strokeStyle = "white"
        ctx.fillStyle = "white"

        ctx.beginPath()
        ctx.moveTo(srcPos[0], srcPos[1])
        const midPt = avg(srcPos, destPos)
        ctx.bezierCurveTo(
          midPt[0],
          midPt[1],
          midPt[0],
          midPt[1],
          destPos[0],
          destPos[1],
        )
        ctx.stroke()
      }
    }
  }
}

export function EditorOverlay() {
  return (
    <>
      <Box sx={{ position: "absolute", bottom: 1, width: "100%" }}>
        <IconButton>
          <Add color="primary" fontSize="large" />
        </IconButton>
      </Box>
    </>
  )
}

interface Props {
  node: NodeStruct
  width: number
  height: number
}

/**
 * Rendered node needs to be exactly the given width and height.
 */
export function NodeReact({ node, width, height }: Props) {
  return (
    <>
      <Box
        sx={{
          backgroundColor: "lightblue",
          border: "white 0.2em solid",
          borderRadius: "0.5em",
          paddingLeft: "0.5em",
          paddingRight: "0.5em",
          paddingBottom: "0.5em",
          // Don't let padding increase client width
          boxSizing: "border-box",
          width: width,
          height: height,
        }}
      >
        <Typography variant="body1">id: {node.id}</Typography>
        <TextareaAutosize
          value={node.text}
          minRows={6}
          maxRows={8}
          style={{ width: "100%" }}
        />
      </Box>
    </>
  )
}

function newNodeEl() {
  const nEl = document.createElement("div")
  nEl.style.opacity = "" + NODE_ALPHA
  nEl.style.position = "absolute"
  return nEl
}

function px(a: number) {
  return `${a}px`
}

const applyCss = (el: HTMLElement, config: Partial<CSSStyleDeclaration>) => {
  for (const [key, value] of Object.entries(config)) {
    // @ts-ignore
    el.style[key] = value
  }
}
