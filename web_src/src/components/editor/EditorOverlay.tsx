import { Vec2 } from "../../util/points"
import { Mode, relationColor } from "./common"
import { DRAW_CUR_GRAPH_POS, GraphEditor } from "./GraphEditor"
import { useRef, useState } from "react"
import { Box, Card, IconButton, Typography } from "@mui/material"
import { Popover } from "@base-ui-components/react/popover"
import { Add, LinearScale } from "@mui/icons-material"

const DRAW_MODE_INDICATOR = true

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

      <EditorToolBar editor={editor} />
    </Box>
  )
}

interface EditorToolBarProps {
  editor: GraphEditor
}

function EditorToolBar({ editor }: EditorToolBarProps) {
  const [secondMenu, setSecondMenu] = useState<null | "lines">(null)

  return (
    <>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column-reverse",
          position: "absolute",
          bottom: 0,
          width: "100%",
        }}
      >
        <Box
          sx={{
            alignContent: "center",
          }}
        >
          <Card
            sx={{
              width: "20em",
              backgroundColor: "#202020",
              marginBottom: "16px",
              marginTop: "8px",
              marginLeft: "auto",
              marginRight: "auto",
              borderRadius: "1em",
              pointerEvents: "all",
              textAlign: "right",
            }}
          >
            <IconButton>
              <LinearScale
                color="primary"
                fontSize="large"
                onMouseDown={() => setSecondMenu(secondMenu ? null : "lines")}
              ></LinearScale>
            </IconButton>

            <IconButton onMouseDown={() => editor.createNode()}>
              <Add color="primary" fontSize="large" />
            </IconButton>
          </Card>
        </Box>
        <Box
          sx={{
            width: "10em",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {secondMenu === "lines" ? <LineMenu editor={editor} /> : null}
        </Box>
      </Box>
    </>
  )
}

interface LineMenuProps {
  editor: GraphEditor
}

function LineMenu({ editor }: LineMenuProps) {
  const [lineType, setLineType] = useState<"sequence">("sequence")
  return (
    <Card
      sx={{
        backgroundColor: "#202020",
        borderRadius: "1em",
        pointerEvents: "all",
        textAlign: "right",
      }}
    >
      <IconButton
        sx={{
          backgroundColor: lineType == "sequence" ? "#303030" : "auto",
        }}
        onMouseDown={() => editor.enterLineMode("sequence")}
      >
        <LinearScale htmlColor={relationColor("sequence")} fontSize="large" />
      </IconButton>
    </Card>
  )
}
