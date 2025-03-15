
export enum Mode {
  View = "view",
  Edit = "edit",
  LineDrawing = "linedrawing",
}

export type SemanticScale = "readable" | "structural" | "constellation"

export type SemanticRelation = "sequence"

export function relationColor(lineType: SemanticRelation): string {
  switch (lineType) {
    case "sequence":
      return "lightblue"
  }
}

