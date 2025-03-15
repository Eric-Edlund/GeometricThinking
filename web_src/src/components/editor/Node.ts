import { NodeStruct } from "../../util/graph"
import { Vec2 } from "../../util/points"
import { SemanticScale } from "./common"
import { applyCss, px} from "./GraphEditor"

const DEBUG_SHOW_ID = true

export interface NodeHintsReceiver {
  /**
   * The user has interacted with the given node in a way
   * that suggests they want to move the node's location.
   */
  hintMoveNode(id: number): void

  /**
   * The user has indicated that they want to edit the
   * given node's content.
   */
  hintEditNode(id: number): boolean

  /**
   * The user has made a change to the node's content.
   */
  hintDirtyNode(id: number): void
}

export class NodeEl {
  private readonly el: HTMLDivElement
  private readonly node: NodeStruct
  private readonly parent: NodeHintsReceiver
  // Pixels
  private readonly pos: Vec2
  private readonly dims: Vec2
  private semanticScale: SemanticScale

  private readonly title = document.createElement("span")
  private readonly content = document.createElement("textarea")

  constructor(el: HTMLDivElement, model: NodeStruct, owner: NodeHintsReceiver) {
    this.el = el
    this.node = model
    this.parent = owner
    this.pos = [0, 0]
    this.dims = [0, 0]
    this.semanticScale = "readable"

    this.el.replaceChildren(this.title, this.content)

    // Base El
    this.el.addEventListener("mousedown", (ev) => {
      this.parent.hintMoveNode(this.node.id)
      ev.preventDefault()
    })
    this.el.addEventListener(
      "click",
      (ev) => {
        if (this.parent.hintEditNode(this.node.id)) {
          ev.preventDefault()
        }
      },
      { passive: false },
    )

    // Content
    this.content.addEventListener(
      "mousedown",
      (ev) => {
        ev.stopPropagation()
      },
      { passive: false },
    )

    this.content.addEventListener("input", (ev) => {
      if (ev.target) {
        // @ts-ignore
        this.node.text = ev.target.value
        this.parent.hintDirtyNode(this.node.id)
      }
    })
  }

  setPos(pos: Vec2) {
    this.pos[0] = pos[0]
    this.pos[1] = pos[1]
  }

  setDims(dims: Vec2) {
    this.dims[0] = dims[0]
    this.dims[1] = dims[1]
  }

  setSemanticScale(scale: SemanticScale) {
    this.semanticScale = scale
  }

  render() {
    const padding = 8
    let fullTitle = false
    let titleHeight = 2 * padding + 24
    if (titleHeight * 2 >= this.dims[1]) {
      titleHeight = this.dims[1]
      fullTitle = true
    }

    const typed = this.node.type !== undefined
    const typeColor = {
      "source": "blue",
      "source_reference": "lightblue",
      "claim": "white",
      "question": "lightgreen",
    }[this.node.type]

    applyCss(this.el, {
      width: px(this.dims[0]),
      height: px(this.dims[0]),
      left: px(this.pos[0]),
      top: px(this.pos[1]),
      display: "flex",
      flexDirection: "column",
      borderRadius: "0.5em",
      overflow: "hidden",
      zIndex: "1",
      border: typed ? `1px ${typeColor} solid`
          : "1px darkslategray solid",
    })

    this.title.textContent = this.node.text.substring(
      0,
      this.node.text.indexOf("\n"),
    )
    if (DEBUG_SHOW_ID) {
      this.title.textContent += this.node.id
    }

    applyCss(this.title, {
      width: px(this.dims[0]),
      height: px(titleHeight),
      padding: px(padding),
      // Prevents the background gradient from drawing between
      // the title and text content area
      marginBottom: typed && !fullTitle ? "-1px" : "0px",
      display: this.semanticScale == "readable" ? "none" : "block",
      color: "white",
      boxSizing: "border-box",
      backgroundColor: "#212121",
    })

    this.content.value = this.node.text
    applyCss(this.content, {
      width: "100%",
      border: "none",
      boxSizing: "border-box",
      height: "100%",
      resize: "none",
      padding: "4px",
      backgroundColor: "rgb(10% 10% 10%)",
      color: "white",
      fontSize: "1em",
      outline: "none",
    })
  }
}
