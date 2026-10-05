// The specimen chrome's few stateful styles (hover, focus, selection), written
// from the theme + tokens so no component carries a literal colour or size.
import { BORDER, SPACE, TYPE, type Theme } from "../tokens";

export function specimenCss(th: Theme): string {
  const f = BORDER.focus;
  return `
.anx a,.anx button{color:inherit;font:inherit;text-decoration:none;background:none;border:0;padding:0;cursor:pointer}
.anx :focus-visible{outline:${f}px solid ${th.wireHot};outline-offset:${f}px}
.anx-entry{display:flex;align-items:center;gap:${SPACE.s}px;padding:${SPACE.xs - 1}px ${SPACE.s}px;color:${th.textDim};font-size:${TYPE.nav.size}px;line-height:${TYPE.nav.line};border-left:${f}px solid transparent}
.anx-entry:hover{color:${th.text}}
.anx-entry[aria-current="page"]{color:${th.wireHot};border-left-color:${th.wireHot}}
.anx-seg{display:inline-flex;border:${BORDER.hair}px solid ${th.frame}}
.anx-seg button{padding:${SPACE.xs + 1}px ${SPACE.s + 2}px;color:${th.textDim}}
.anx-seg button:hover{color:${th.text}}
.anx-seg button[aria-pressed="true"]{background:${th.panel};color:${th.wireHot}}
.anx-step{display:inline-flex;align-items:center;gap:${SPACE.s}px;color:${th.textDim};font-size:${TYPE.hint.size}px}
.anx-step:hover{color:${th.text}}
.anx-step[aria-disabled="true"]{visibility:hidden}
.anx-back{color:${th.wireHot};font-size:${TYPE.hint.size}px}
.anx-back:hover{text-decoration:underline}
.anx-select{appearance:none;-webkit-appearance:none;width:100%;min-height:${SPACE.xl}px;padding:0 ${SPACE.xl}px 0 ${SPACE.m}px;border:${BORDER.hair}px solid ${th.frame};border-radius:${BORDER.radius};background:${th.panel};color:${th.text};font:inherit;font-size:${TYPE.nav.size + 2}px}
.anx-scroll{overflow-x:auto;scrollbar-color:${th.frame} transparent}
`;
}
