import { Add } from "@mui/icons-material"
import { Root, createRoot } from "react-dom/client"
import { add, avg, distance, scale, subtract, Vec2 } from "../util/points"
import { Box, IconButton, TextareaAutosize, Typography } from "@mui/material"
import { useRef } from "react"
import { ScalarAnimation, Vec2Animation } from "../util/animation"
import { ObservableGraph, NodeStruct, GraphDiff } from "../util/graph"
import { NodeEl, NodeHintsReceiver } from "./Node"

export type SemanticScale = "readable" | "structural" | "constellation"

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

export interface EditorConfig {
  /**
   * If present, used to store the position and zoom of the editor.
   */
  localStorageStateKey?: string
}

/**
 * Handles user input.
 *
 * There are client pixel coords and graph coords. No other coords!
 *
 * Both graph and client coords are 0,0 in the top left.
 */
export class GraphEditor implements NodeHintsReceiver {
  private readonly localStorageKey: string | null = null
  private readonly el: HTMLElement
  private graph = new ObservableGraph()
  private graphStateNum: number = this.graph.currentState()
  // Node id to els
  private readonly nodes = new Map<number, [HTMLElement, NodeEl]>()
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
  private movingNode: number | null = null

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

  private mode = Mode.Edit

  constructor(
    el: HTMLElement,
    g: ObservableGraph,
    _publishGraph: (g: ObservableGraph) => void,
    config?: Partial<EditorConfig>,
  ) {
    if (this.lineCanvas.getContext("2d") == null) {
      console.error("Could not create 2d drawing context for canvas.")
      throw new Error()
    }

    if (config?.localStorageStateKey) {
      this.localStorageKey = config?.localStorageStateKey
    }

    this.el = el
    this.graph = g
    this.graph.listen((changeNum, diff) => this.readGraphState(changeNum, diff))
    this.readGraphState()
    let initWidth = el.clientWidth / (10 * 40)
    let initCenter: Vec2 = [0, 0]
    if (this.localStorageKey) {
      const storage = JSON.parse(localStorage.getItem(this.localStorageKey)!)
      if (storage?.width) {
        initWidth = storage!.width
      }
      if (storage?.center) {
        initCenter = storage!.center
      }
    }
    // Fit 3 40ch blocks
    this.widthAnimation.setTarget(initWidth)
    this.widthAnimation.finishNow()
    this.centerAnimation.setTarget(initCenter)
    this.centerAnimation.finishNow()
    this.initEl()
    this.draw()
  }

  hintEditNode(_id: number): boolean {
    const clickTravel = distance(this.mouseDownPos!, this.mouseUpPos!)
    if (this.mode == Mode.View && clickTravel < 5) {
      this.mode = Mode.Edit
      this.draw()
      return true
    }
    return false
  }

  hintMoveNode(nodeId: number) {
    this.movingNode = nodeId
  }

  hintDirtyNode(nodeId: number) {
    this.graphStateNum = this.graph.markDirty(nodeId)
    this.graph.notify()
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

  private readGraphState(changeNum?: number, diff?: GraphDiff) {
    if (changeNum !== undefined && changeNum <= this.graphStateNum) {
      return
    }
    if (changeNum !== undefined) {
      this.graphStateNum = changeNum
    }

    if (diff) {
      for (const id of diff.nodes) {
        if (!this.nodes.has(id)) {
          const nEl = newNodeEl()
          nEl.style.zIndex = "1"
          this.el.appendChild(nEl)
          this.nodes.set(id, [nEl, new NodeEl(nEl, this.graph.get(id)!, this)])
        }
        
      }
    } else {
      // Clean
      this.el.replaceChildren(this.lineCanvas, this.overlayDiv)
      this.nodes.clear()

      // Add new
      for (const n of this.graph.nodes()) {
        const nEl = newNodeEl()
        nEl.style.zIndex = "1"
        this.el.appendChild(nEl)
        this.nodes.set(n.id, [nEl, new NodeEl(nEl, n, this)])
      }
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
      this.movingNode = null
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
        } else if (this.movingNode) {
          const scaleFactor = this.width / this.el.clientWidth
          const node = this.graph.get(this.movingNode)!
          node.pos[0] += ev.movementX * scaleFactor
          node.pos[1] += ev.movementY * scaleFactor
          this.graph.markDirty(node.id)
          this.graph.notify()
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
      this.movingNode = null
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
        if (this.mode == Mode.Edit && !ev.ctrlKey) {
          return
        }
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
          // TODO: Revisit modes
          // this.mode = Mode.View
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

  createNode() {
    this.graph.add({
      id: this.graph.nextId(),
      pos: [this.center[0], this.center[1]],
      dims: [1, 1],
      text: "",
      factualDependencies: [],
    } satisfies NodeStruct)
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

    if (this.localStorageKey) {
      localStorage.setItem(
        this.localStorageKey,
        JSON.stringify({
          center: this.center,
          width: this.width,
        }),
      )
    }

    this.overlayReact.render(
      <EditorOverlay
        zIndex={this.overlayDiv.style.zIndex}
        mode={this.mode}
        curGraphPos={this.mousePos}
        editor={this}
      />,
    )

    // Determine scale
    let semanticScale: SemanticScale = "readable"
    const cssPixelsPerGraphUnit = this.el.clientWidth / this.width
    if (cssPixelsPerGraphUnit > 250) {
      semanticScale = "readable"
    } else if (cssPixelsPerGraphUnit > 20) {
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
      const [nEl, elManager] = this.nodes.get(id)!
      let clientCoords = this.intoClientSpace(node.pos)
      const graphToClient = this.el.clientWidth / this.width

      if (["readable", "structural"].includes(semanticScale)) {
        // When we zoom out, the margin should be reduced to improve positional accuracy
        const margin = Math.min(8, 0.5 * graphToClient)
        const nWidth = node.dims[0] * graphToClient
        const nHeight = node.dims[1] * graphToClient
        clientCoords = add(clientCoords, [margin, margin])

        elManager.setPos(clientCoords)
        elManager.setDims([nWidth - 2 * margin, nHeight - 2 * margin])
        elManager.setSemanticScale(semanticScale)
        elManager.render()
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

    ctx.strokeStyle = "white"

    for (const [id, node] of this.graph.entries()) {
      const nEl = this.nodes.get(id)![0]
      for (const depId of node.factualDependencies ?? []) {
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

    for (const seq of this.graph.sequences()) {
      for (let i = 0; i + 1 < seq.nodes.length; i++) {
        const a = this.nodes.get(seq.nodes[i])![0]
        const b = this.nodes.get(seq.nodes[i + 1])![0]

        const srcPos: Vec2 = [
          a.offsetLeft + 0.5 * a.clientWidth,
          a.offsetTop + 0.5 * a.clientHeight,
        ]
        const destPos: Vec2 = [
          b.offsetLeft + 0.5 * b.clientWidth,
          b.offsetTop + 0.5 * b.clientHeight,
        ]

        ctx.strokeStyle = seq.color
        ctx.beginPath()
        ctx.moveTo(srcPos[0], srcPos[1])
        ctx.lineTo(destPos[0], destPos[1])
        ctx.closePath()
        ctx.stroke()
      }
    }

    for (const opt of this.graph.optionSets()) {
      const root = this.nodes.get(opt.root)![0]
      const srcPos: Vec2 = [
        root.offsetLeft + 0.5 * root.clientWidth,
        root.offsetTop + 0.5 * root.clientHeight,
      ]
      for (const child of opt.children) {
        const a = this.nodes.get(child)![0]
        const destPos: Vec2 = [
          a.offsetLeft + 0.5 * a.clientWidth,
          a.offsetTop + 0.5 * a.clientHeight,
        ]
        ctx.strokeStyle = "red"
        ctx.beginPath()
        ctx.moveTo(srcPos[0], srcPos[1])
        ctx.lineTo(destPos[0], destPos[1])
        ctx.closePath()
        ctx.stroke()
      }
    }

    for (const inst of this.graph.instanceSets()) {
      let left = 9999999,
        top = 9999999,
        bottom = 0,
        right = 0
      const root = this.nodes.get(inst.root)![0]
      const rootPos: Vec2 = [
        root.offsetLeft + 0.5 * root.clientWidth,
        root.offsetTop + 0.5 * root.clientHeight,
      ]
      for (const child of inst.children) {
        const a = this.nodes.get(child)![0]
        left = Math.min(left, a.offsetLeft)
        right = Math.max(right, a.offsetLeft + a.clientWidth)
        top = Math.min(top, a.offsetTop)
        bottom = Math.max(bottom, a.offsetTop + a.clientHeight)
      }

      left -= 10
      right += 10
      top -= 10
      bottom += 10

      ctx.strokeStyle = "white"
      ctx.lineWidth = 1
      // ctx.beginPath()
      ctx.strokeRect(left, top, right - left, bottom - top)

      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(rootPos[0], rootPos[1])
      ctx.lineTo(Math.max(left, right), Math.min(top, bottom))
      ctx.moveTo(rootPos[0], rootPos[1])
      ctx.lineTo(Math.min(left, right), Math.max(top, bottom))
      ctx.closePath()
      ctx.stroke()
    }

    // for (const region of this.graph.regions()) {
    //   const root = this.nodes.get(region.root)![0]
    //   const leader = this.graph.get(region.root)!
    //   ctx.font = "50px serif";
    //   ctx.textAlign = "left"
    //   ctx.textBaseline = 'top'
    //   ctx.strokeText(leader.text, root.clientLeft, root.clientTop)
    //   console.log("Region title")
    // }

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
  zIndex: any
}

export function EditorOverlay({
  mode,
  curGraphPos,
  editor,
  zIndex,
}: OverlayProps) {
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
        pointerEvents: "none",
        zIndex: zIndex,
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

      <Box
        sx={{
          position: "absolute",
          bottom: 1,
          width: "100%",
          pointerEvents: "all",
        }}
      >
        <IconButton onMouseDown={() => editor.createNode()}>
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
  editor: GraphEditor
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
  editor,
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
        onMouseDown={() => {
          editor.hintMoveNode(node.id)
        }}
      >
        {semanticScale == "readable" ? (
          <>
            <Typography ref={title} variant="body1">
              id: {node.id}
            </Typography>
            {title.current && textAreaHeight > 0 ? (
              <TextareaAutosize
                onMouseDown={(ev) => {
                  ev.stopPropagation()
                }}
                onClick={(ev) => {
                  tryEnterEdit.tryEnterEdit(node.id, () => {
                    ev.target.focus()
                  })
                }}
                onChange={(e) => {
                  node.text = e.target.value
                  // editor.graph.markDirty(node.id)
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

export function px(a: number) {
  return `${a}px`
}

export const applyCss = (
  el: HTMLElement,
  config: Partial<CSSStyleDeclaration>,
) => {
  for (const [key, value] of Object.entries(config)) {
    // @ts-ignore
    el.style[key] = value
  }
}
