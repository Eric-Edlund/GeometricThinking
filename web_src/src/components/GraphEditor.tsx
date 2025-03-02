import { Add } from "@mui/icons-material"
import { Root, createRoot } from "react-dom/client"
import { add, avg, distance, scale, subtract, Vec2 } from "../util/points"
import { Box, IconButton, TextareaAutosize, Typography } from "@mui/material"
import { useRef } from "react"
import { ScalarAnimation, Vec2Animation } from "../util/animation"
import { ObservableGraph, NodeStruct } from "../util/graph"

type SemanticScale = "readable" | "structural" | "constellation"


// Debug
const NODE_ALPHA = 1.0
const DRAW_GRID = true
const DRAW_MODE_INDICATOR = true
const DRAW_CUR_GRAPH_POS = true

const ANIMATION_DURATION = 200

enum Mode {
  View = "view",
  Edit = "edit",
}

/**
 * Handles user input.
 *
 * There are client pixel coords and graph coords. No other coords!
 *
 * Both graph and client coords are 0,0 in the top left.
 */
export class GraphEditor implements HasTryEnterEdit {
  private readonly el: HTMLElement
  // Node id to els
  private graph = new ObservableGraph()
  private readonly nodes = new Map<number, [HTMLElement, Root]>()
  private readonly lineCanvas: HTMLCanvasElement =
    document.createElement("canvas")
  private readonly overlayDiv = document.createElement("div")
  private readonly overlayReact: Root = createRoot(this.overlayDiv)
  // In graph coordinates
  private get center(): [number, number] {
    return this.centerAnimation.valueNow()
  }
  // Width of the client in graph units.
  private get width(): number {
    return this.widthAnimation.valueNow()
  }

  // Null indicates that the last frame drawn did not request that another frame
  // be drawn.
  private lastFrameTime: number | null = null

  private mouseDown = false
  private mouseDownPos: Vec2 | null = null
  private mouseUpPos: Vec2 | null = null
  private mouseDownOnBackground = false
  private mousePos: Vec2 | null = null

  private widthAnimation = new ScalarAnimation(0, {
    duration: ANIMATION_DURATION,
  })
  private centerAnimation = new Vec2Animation([0, 0], {
    duration: ANIMATION_DURATION,
  })
  private nextFrameTimer: number | null = null
  private requestAnimationFrame() {
    if (!this.nextFrameTimer) {
      this.nextFrameTimer = setTimeout(() => {
        this.nextFrameTimer = null
        this.draw()
      }, 30)
    }
  }

  private mode = Mode.View

  constructor(el: HTMLElement, g: Graph, _publishGraph: (g: ObservableGraph) => void) {
    if (this.lineCanvas.getContext("2d") == null) {
      console.error("Could not create 2d drawing context for canvas.")
      throw new Error()
    }

    this.el = el
    this.graph = g
    this.graph.listen(() => this.readGraphState())
    this.readGraphState()
    // Fit 3 40ch blocks
    this.widthAnimation.setTarget(el.clientWidth / (10 * 40))
    this.widthAnimation.finishNow()
    this.initEl()
    this.draw()
  }

  /**
   * Set the new center in graph coords.
   */
  moveCenter(center: Vec2, animate?: boolean) {
    this.centerAnimation.setTarget(center)
    if (!animate) {
      this.centerAnimation.finishNow()
    }
    this.draw()
  }

  focus() {
    this.el.focus()
  }

  private readGraphState() {
    // Clean
    this.el.replaceChildren(this.lineCanvas, this.overlayDiv)
    this.nodes.clear()

    // Add new
    for (const n of this.graph.nodes()) {
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
    // Accepts focus (and key presses)
    this.el.setAttribute("tabindex", "-1")

    this.el.append(this.lineCanvas, this.overlayDiv)

    this.el.style.zIndex = "-5"
    this.lineCanvas.style.zIndex = "-4"
    // Nodes are z = 1
    this.overlayDiv.style.zIndex = "2"

    this.el.addEventListener(
      "mousedown",
      (ev) => {
        this.mouseDown = true
        this.mouseDownPos = [ev.clientX, ev.clientY]
        if (this.mode == Mode.View) {
          // This is for us moving the graph only.
          // This prevents highlighting the nodes
          ev.preventDefault()
          this.el.focus()
        }
      },
      { passive: false, capture: true },
    )

    this.el.addEventListener(
      "mousedown",
      (ev) => {
        this.mouseDown = true
        this.mouseDownOnBackground = true
        this.mouseDownPos = [ev.clientX, ev.clientY]
        if (this.mode == Mode.Edit) {
        }
      },
      { passive: false },
    )
    this.el.addEventListener("mouseup", (ev) => {
      this.mouseDownOnBackground = false
      this.mouseDown = false
      this.mouseUpPos = [ev.clientX, ev.clientY]
      if (this.mode == Mode.View) {
        const travel = distance(this.mouseDownPos!, [ev.clientX, ev.clientY])
        if (travel < 5) {
          // It's a stationary click
          // TODO: If it was an attempt to edit a node, switch to edit mode
          // and pass a click event to the correct node
        }
      }
    })
    this.el.addEventListener("mousemove", (ev) => {
      this.mousePos = this.intoGraphSpace([ev.clientX, ev.clientY])
      if (DRAW_CUR_GRAPH_POS) {
        this.draw()
      }
      const applyMovement = () => {
        const scaleFactor = this.width / this.el.clientWidth
        this.centerAnimation.cancel()
        this.centerAnimation.setTarget([
          this.center[0] - ev.movementX * scaleFactor,
          this.center[1] - ev.movementY * scaleFactor,
        ])
        this.centerAnimation.finishNow()
        this.draw()
      }
      if (this.mode === Mode.View) {
        if (this.mouseDown) {
          applyMovement()
        }
      } else if (this.mode === Mode.Edit) {
        if (this.mouseDownOnBackground) {
          applyMovement()
        }
      }
    })

    this.el.addEventListener(
      "keydown",
      (ev) => {
        if (this.mode == Mode.View) {
          if (ev.key == "i") {
            this.mode = Mode.Edit
            this.draw()
            ev.preventDefault()
          }
        } else if (this.mode == Mode.Edit) {
          if (ev.key == "Escape") {
            this.mode = Mode.View
            this.draw()
            ev.preventDefault()
          }
        }
      },
      { passive: false },
    )
    this.el.addEventListener("mouseleave", () => {
      this.mousePos = null
      this.mouseDownOnBackground = false
      this.mouseDown = false
      this.mouseUpPos = null
    })

    this.el.addEventListener(
      "touchstart",
      (ev) => {
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
        let deltaX: number, deltaY: number, deltaZoom: number
        switch (ev.deltaMode) {
          case ev.DOM_DELTA_PIXEL:
            deltaX = ev.deltaX // Random constant, idk bro
            deltaY = ev.deltaY
            deltaZoom = ev.deltaY
            break
          case ev.DOM_DELTA_LINE:
            deltaX = ev.deltaX * 16 // Random constant to pixels
            deltaY = ev.deltaY * 16
            deltaZoom = ev.deltaY / 1.1
            break
          case ev.DOM_DELTA_PAGE:
            // TODO: Is this legit?
            deltaX = ev.deltaX
            deltaY = ev.deltaY
            deltaZoom = ev.deltaY
            break
          default:
            console.error("This shouldn't happen.")
            return
        }

        if (ev.ctrlKey) {
          const preCursorPos = this.intoGraphSpace([ev.clientX, ev.clientY])
          // Max pixel width per graph unit
          const minWidth = this.el.clientWidth / 500
          let targetWidth = Math.max(minWidth, this.width * 1.1 ** deltaZoom)
          this.widthAnimation.setTarget(targetWidth)

          const postCursorPos = this.intoGraphSpace(
            [ev.clientX, ev.clientY],
            targetWidth,
          )
          const deltaCursorPos = subtract(postCursorPos, preCursorPos)
          // Move center so that the point under the cursor didn't move
          this.centerAnimation.setTarget([
            this.center[0] - deltaCursorPos[0],
            this.center[1] - deltaCursorPos[1],
          ])
          if (Math.abs(targetWidth / this.width - 1) < 0.3) {
            this.widthAnimation.finishNow()
            this.centerAnimation.finishNow()
          }
        } else {
          this.centerAnimation.cancel()
          this.centerAnimation.setTarget([
            this.center[0] - -deltaX * clientToGraph,
            this.center[1] - -deltaY * clientToGraph,
          ])
          this.centerAnimation.finishNow()
        }

        ev.preventDefault()
        this.draw()
      },
      { passive: false },
    )

    this.el.addEventListener("click", () => {}, {
      passive: false,
      capture: true,
    })

    this.el.addEventListener(
      "click",
      (ev) => {
        // This only gets called if a click is not consumed by a node or earlier
        const travel = distance(this.mouseDownPos!, [ev.clientX, ev.clientY])
        if (travel < 5 && this.mode == Mode.Edit) {
          this.mode = Mode.View
          this.draw()
        }
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
      const newWidth =
        (this.width * this.el.clientWidth) / this.lineCanvas.clientWidth
      this.widthAnimation.setTarget(newWidth)
      this.widthAnimation.finishNow()
      resizeLayers()
      this.draw()
    })
  }

  tryEnterEdit(_nodeId: number, cb: () => void) {
    const clickTravel = distance(this.mouseDownPos!, this.mouseUpPos!)
    if (this.mode == Mode.View && clickTravel < 5) {
      this.mode = Mode.Edit
      this.draw()
      cb()
    }
  }

  createNode() {
    console.log("Create node")
    this.graph
    this.draw()
  }

  private intoGraphSpace(clientPos: Vec2, customGraphWidth?: number): Vec2 {
    // Find the clientToGraph scale coefficient (graph dist/client dist)
    // Take the centerPos (graph vec2)
    // Find the distance vector from the center in pixels (client vec2)
    //
    // return centerPos + distVector * clientToGraph

    const clientToGraph = (customGraphWidth ?? this.width) / this.el.clientWidth
    const clientCenter = [this.el.clientWidth / 2, this.el.clientHeight / 2]
    return [
      this.center[0] + (clientPos[0] - clientCenter[0]) * clientToGraph,

      this.center[1] + (clientPos[1] - clientCenter[1]) * clientToGraph,
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
    let requestFrame = false
    const now = Date.now()
    const deltaTime = now - (this.lastFrameTime ?? now)

    if (this.widthAnimation.inProgress()) {
      this.widthAnimation.passTime(deltaTime)
      if (this.widthAnimation.inProgress()) {
        requestFrame = true
      }
    }
    if (this.centerAnimation.inProgress()) {
      this.centerAnimation.passTime(deltaTime)
      if (this.centerAnimation.inProgress()) {
        requestFrame = true
      }
    }

    this.overlayReact.render(
      <EditorOverlay
        mode={this.mode}
        curGraphPos={this.mousePos}
        editor={this}
      />,
    )

    // Determine scale
    let semanticScale: SemanticScale = "readable"
    const cssPixelsPerGraphUnit = this.el.clientWidth / this.width
    if (cssPixelsPerGraphUnit > 96) {
      semanticScale = "readable"
    } else if (cssPixelsPerGraphUnit > 50) {
      semanticScale = "structural"
    } else {
      semanticScale = "constellation"
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
        ctx.beginPath()
        ctx.moveTo(pos[0], 0)
        ctx.lineTo(pos[0], this.el.clientHeight)
        ctx.closePath()
        ctx.stroke()
      }
      const aspectRatio = this.el.clientHeight / this.el.clientWidth
      let maxY = Math.floor(this.center[1] + this.width * aspectRatio * 0.5) + 1
      let minY = Math.floor(this.center[1] - this.width * aspectRatio * 0.5)
      minY = Math.floor(minY / jump) * jump
      for (let i = minY; i < maxY; i += jump) {
        const pos = this.intoClientSpace([0, i])
        ctx.beginPath()
        ctx.moveTo(0, pos[1])
        ctx.lineTo(this.el.clientWidth, pos[1])
        ctx.closePath()
        ctx.stroke()
      }
    }

    for (const [id, node] of this.graph.entries()) {
      const [nEl, root] = this.nodes.get(id)!
      const clientCoords = this.intoClientSpace(node.pos)
      const graphToClient = this.el.clientWidth / this.width

      if (["readable", "structural"].includes(semanticScale)) {
        // When we zoom out, the margin should be reduced to improve positional accuracy
        const margin = Math.min(8, 0.5 * graphToClient)
        applyCss(nEl, {
          width: px(node.dims[0] * graphToClient),
          height: px(node.dims[1] * graphToClient),
          left: px(clientCoords[0]),
          top: px(clientCoords[1]),
          padding: px(margin),
          display: "block",
        })
        root.render(
          <NodeReact
            node={node}
            semanticScale={semanticScale}
            width={nEl.clientWidth - 2 * margin}
            height={nEl.clientHeight - 2 * margin}
            tryEnterEdit={this}
          />,
        )
      } else {
        const nodeWidth = node.dims[0] * graphToClient
        const nodeCenter = this.intoClientSpace(
          add(node.pos, scale(0.5, node.dims)),
        )
        const nodeTl = subtract(nodeCenter, scale(0.5, [nodeWidth, nodeWidth]))

        applyCss(nEl, {
          padding: "0",
          width: px(nodeWidth),
          height: px(nodeWidth),
          left: px(nodeTl[0]),
          top: px(nodeTl[1]),
          display: "none",
        })
        ctx.lineWidth = 5
        ctx.strokeStyle = "white"
        ctx.fillStyle = "white"

        ctx.moveTo(nodeTl[0], nodeCenter[1])
        ctx.beginPath()
        ctx.arc(
          nodeCenter[0],
          nodeCenter[1],
          Math.max(1, nodeWidth * 0.5 - 4),
          0,
          2 * Math.PI,
        )
        ctx.closePath()
        ctx.fill()
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

        ctx.lineWidth = semanticScale == "constellation" ? 1 : 5
        ctx.strokeStyle = "white"

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
        ctx.closePath()
        ctx.stroke()
      }
    }

    if (requestFrame) {
      this.lastFrameTime = now
      this.requestAnimationFrame()
    } else {
      this.lastFrameTime = null
    }
  }
}

interface OverlayProps {
  mode: Mode
  curGraphPos: Vec2 | null
  editor: GraphEditor
}

export function EditorOverlay({ mode, curGraphPos, editor }: OverlayProps) {
  let modeColor
  switch (mode) {
    case Mode.View:
      modeColor = "blue"
      break
    case Mode.Edit:
      modeColor = "green"
      break
  }
  const boxShadow = DRAW_MODE_INDICATOR ? `inset 0 0 8px ${modeColor}` : ""

  return (
    <Box
      sx={{
        boxShadow: boxShadow,
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      {DRAW_CUR_GRAPH_POS ? (
        <Typography
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            color: "white",
          }}
          variant="h5"
        >
          Cur: {(curGraphPos ?? [])[0]?.toFixed(1)},{" "}
          {(curGraphPos ?? [])[1]?.toFixed(1)}
        </Typography>
      ) : null}
      <Box sx={{ position: "absolute", bottom: 1, width: "100%" }}>
        <IconButton onMouseDown={editor.createNode}>
          <Add color="primary" fontSize="large" />
        </IconButton>
      </Box>
    </Box>
  )
}

interface HasTryEnterEdit {
  tryEnterEdit(nodeId: number, startEdit: () => void): void
}

interface Props {
  node: NodeStruct
  semanticScale: SemanticScale
  width: number
  height: number
  /**
   * When a node is clicked in a way that looks like the user wants to
   * edit it, calls this function.
   */
  tryEnterEdit: HasTryEnterEdit
}

/**
 * Rendered node needs to be exactly the given width and height.
 */
export function NodeReact({
  node,
  semanticScale,
  width,
  height,
  tryEnterEdit,
}: Props) {
  const title = useRef(null)
  const margin = 8
  const border = 4

  const textAreaHeight =
    height - 2 * margin - 2 * border - (title.current?.clientHeight ?? 0)

  return (
    <>
      <Box
        sx={{
          backgroundColor: "lightblue",
          border: `white ${border}px solid`,
          borderRadius: "0.5em",
          paddingLeft: px(margin),
          paddingRight: px(margin),
          paddingBottom: px(margin),
          // Don't let padding increase client width
          boxSizing: "border-box",
          width: width,
          height: height,
        }}
      >
        {semanticScale == "readable" ? (
          <>
            <Typography ref={title} variant="body1">
              id: {node.id}
            </Typography>
            {title.current && textAreaHeight > 0 ? (
              <TextareaAutosize
                onClick={(ev) => {
                  tryEnterEdit.tryEnterEdit(node.id, () => {
                    ev.target.focus()
                    const mouseDown = new MouseEvent("mousedown", {
                      clientX: ev.clientX,
                      clientY: ev.clientY,
                    })
                    ev.target.dispatchEvent(mouseDown)
                    const mouseUp = new MouseEvent("mouseup", {
                      clientX: ev.clientX,
                      clientY: ev.clientY,
                    })
                    ev.target.dispatchEvent(mouseUp)

                    ev.target.dispatchEvent(
                      new MouseEvent("click", {
                        clientX: ev.clientX,
                        clientY: ev.clientY,
                      }),
                    )
                  })
                }}
                onChange={(e) => {
                  node.text = e.target.value
                }}
                defaultValue={node.text}
                style={{
                  width: width - 2 * margin - 2 * border,
                  minHeight: textAreaHeight,
                  maxHeight: textAreaHeight,
                  boxSizing: "border-box",
                }}
              />
            ) : null}
          </>
        ) : null}
      </Box>
    </>
  )
}

function newNodeEl() {
  const nEl = document.createElement("div")
  nEl.style.opacity = "" + NODE_ALPHA
  nEl.style.position = "absolute"
  nEl.style.boxSizing = "border-box"
  nEl.addEventListener(
    "click",
    (ev) => {
      console.log("Node stopped click")
      ev.stopPropagation()
    },
    { passive: false },
  )
  nEl.addEventListener("mousedown", (ev) => {
    // Capture mouse down
    ev.stopPropagation()
  })
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
