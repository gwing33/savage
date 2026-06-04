import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";
import { theme } from "remix/ui/theme";
import { AppTheme } from "./theme.ts";
import type { FanBoxParams } from "./fan-box.tsx";

// ─── Fabrication constants ────────────────────────────────────────────────────

const FMT = 24; // frame material thickness mm (24mm ply)
const RW = 12; // rabbet width mm
const RD = 12; // rabbet depth mm
const FC = (3 / 32) * 25.4; // filter clearance per side ≈ 2.381 mm
const FILT_T = 12; // filter material thickness mm
const FBX_DEPTH = 4 * 25.4; // filter box depth = 4" = 101.6 mm

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrawingsPageProps {
  user: { email: string; type: string };
  params: FanBoxParams;
}

interface Dims {
  fpW: number;
  fpH: number;
  outerW: number;
  outerH: number;
  filtW: number;
  filtH: number;
  fbDepth: number;
  filtBoxInnerW: number;
  filtBoxInnerH: number;
  filterW: number;
  filterH: number;
  filterFits: boolean;
}

// ─── Dimension helpers ────────────────────────────────────────────────────────

function computeDims(p: FanBoxParams): Dims {
  const fpW =
    p.fanPaddingX * 2 +
    p.fanColumns * p.fanSize +
    (p.fanColumns - 1) * p.fanSpacing;
  const fpH =
    p.fanPaddingY * 2 + p.fanRows * p.fanSize + (p.fanRows - 1) * p.fanSpacing;
  const outerW = fpW + 2 * FMT;
  const outerH = fpH + 2 * FMT;
  const filtW = fpW + 2 * RW - 2 * FC;
  const filtH = fpH + 2 * RW - 2 * FC;
  const fbDepth = p.fanBoxDepth;
  const filtBoxInnerW = fpW - 2 * FC - 2 * FILT_T;
  const filtBoxInnerH = fpH - 2 * FC - 2 * FILT_T;
  const filterFits =
    filtBoxInnerW >= p.filterSizeW && filtBoxInnerH >= p.filterSizeH;
  return {
    fpW,
    fpH,
    outerW,
    outerH,
    filtW,
    filtH,
    fbDepth,
    filtBoxInnerW,
    filtBoxInnerH,
    filterW: p.filterSizeW,
    filterH: p.filterSizeH,
    filterFits,
  };
}

// ─── SVG utility functions ────────────────────────────────────────────────────

function r(n: number): string {
  return n.toFixed(1);
}

function D(mm: number): string {
  return mm.toFixed(1) + " mm / " + (mm / 25.4).toFixed(2) + '"';
}

function ln(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attrs?: string,
): string {
  return (
    '<line x1="' +
    r(x1) +
    '" y1="' +
    r(y1) +
    '" x2="' +
    r(x2) +
    '" y2="' +
    r(y2) +
    '"' +
    (attrs ? " " + attrs : "") +
    "/>"
  );
}

function rx(
  x: number,
  y: number,
  w: number,
  h: number,
  attrs?: string,
): string {
  return (
    '<rect x="' +
    r(x) +
    '" y="' +
    r(y) +
    '" width="' +
    r(w) +
    '" height="' +
    r(h) +
    '"' +
    (attrs ? " " + attrs : "") +
    "/>"
  );
}

function tx(x: number, y: number, content: string, attrs?: string): string {
  return (
    '<text x="' +
    r(x) +
    '" y="' +
    r(y) +
    '"' +
    (attrs ? " " + attrs : "") +
    ">" +
    content +
    "</text>"
  );
}

// Horizontal dimension line (dim line at y, object edge at objY).
// Extension lines run from objY to a few mm past the dim line.
// Label appears just above the dim line.
function dimH(
  x1: number,
  x2: number,
  y: number,
  objY: number,
  label: string,
): string {
  const ext = 3;
  const extY = y >= objY ? y + ext : y - ext;
  return (
    ln(x1, objY, x1, extY, 'class="ld"') +
    ln(x2, objY, x2, extY, 'class="ld"') +
    ln(
      x1,
      y,
      x2,
      y,
      'class="ld" marker-start="url(#ahr)" marker-end="url(#ah)"',
    ) +
    tx((x1 + x2) / 2, y - 3, label, 'class="dt" text-anchor="middle"')
  );
}

// Vertical dimension line (dim line at x, object edge at objX).
// Extension lines run from objX to a few mm past the dim line.
// Label is rotated 90°, centred on the dim line.
function dimV(
  y1: number,
  y2: number,
  x: number,
  objX: number,
  label: string,
): string {
  const ext = 3;
  const extX = x >= objX ? x + ext : x - ext;
  const cx = x;
  const cy = (y1 + y2) / 2;
  return (
    ln(objX, y1, extX, y1, 'class="ld"') +
    ln(objX, y2, extX, y2, 'class="ld"') +
    ln(
      x,
      y1,
      x,
      y2,
      'class="ld" marker-start="url(#ahr)" marker-end="url(#ah)"',
    ) +
    '<text x="' +
    r(cx) +
    '" y="' +
    r(cy) +
    '" class="dt" text-anchor="middle"' +
    ' transform="rotate(-90 ' +
    r(cx) +
    " " +
    r(cy) +
    ')">' +
    label +
    "</text>"
  );
}

// ─── Shared SVG defs ──────────────────────────────────────────────────────────

const DEFS = `<defs>
  <marker id="ah" markerWidth="5" markerHeight="4" refX="5" refY="2"
          orient="auto" markerUnits="userSpaceOnUse">
    <polygon points="0,0 5,2 0,4" fill="#444"/>
  </marker>
  <marker id="ahr" markerWidth="5" markerHeight="4" refX="0" refY="2"
          orient="auto" markerUnits="userSpaceOnUse">
    <polygon points="5,0 0,2 5,4" fill="#444"/>
  </marker>
  <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse"
           patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="5" style="stroke:#bbb;stroke-width:1.2"/>
  </pattern>
</defs>
<style>
  .bo  { stroke:#111; stroke-width:1.2; fill:none; }
  .th  { stroke:#333; stroke-width:0.6; fill:none; }
  .ht  { fill:url(#hatch); stroke:#777; stroke-width:0.5; }
  .ld  { stroke:#555; stroke-width:0.4; fill:none; }
  .sl  { stroke:#555; stroke-width:0.6; fill:none; stroke-dasharray:12 3 2 3; }
  .hl  { stroke:#999; stroke-width:0.5; fill:none; stroke-dasharray:4 2; }
  .dt  { font:6.5px -apple-system,sans-serif; fill:#333; }
  .vl  { font:bold 9px -apple-system,sans-serif; fill:#111; }
  .tb  { font:bold 11px -apple-system,sans-serif; fill:#111; }
  .ts  { font:7px -apple-system,sans-serif; fill:#555; }
</style>
`;

// ─── Fan Box SVG ──────────────────────────────────────────────────────────────

function generateFanBoxSvg(p: FanBoxParams, d: Dims): string {
  const {
    fpW,
    fpH,
    outerW,
    outerH,
    filtW,
    fbDepth,
    filtBoxInnerW,
    filtBoxInnerH,
    filterW,
    filterH,
    filterFits,
  } = d;

  const pL = 75,
    pR = 35,
    pT = 45,
    pB = 55;
  const vgap = 50,
    secPad = 30;

  const W = pL + outerW + pR;
  const H = pT + outerH + vgap + secPad + fbDepth + 30 + pB;

  // ── View 1: Fan Side Elevation ────────────────────────────────────────────

  const v1 =
    rx(pL, pT, outerW, outerH, 'fill="#f5f0e8" class="bo"') +
    rx(
      pL + FMT,
      pT + FMT,
      fpW,
      fpH,
      'fill="white" stroke="#333" stroke-width="0.8"',
    ) +
    ln(
      pL - 15,
      pT + outerH / 2,
      pL + outerW + 15,
      pT + outerH / 2,
      'class="sl"',
    ) +
    tx(pL - 22, pT + outerH / 2 + 2, "A", 'class="vl" text-anchor="middle"') +
    tx(
      pL + outerW + 22,
      pT + outerH / 2 + 2,
      "A",
      'class="vl" text-anchor="middle"',
    ) +
    // Overall width (below)
    dimH(pL, pL + outerW, pT + outerH + 32, pT + outerH, D(outerW)) +
    // Overall height (left)
    dimV(pT, pT + outerH, pL - 48, pL, D(outerH)) +
    // Left frame width (above)
    dimH(pL, pL + FMT, pT - 24, pT, D(FMT)) +
    // Opening width (above)
    dimH(pL + FMT, pL + FMT + fpW, pT - 24, pT + FMT, D(fpW)) +
    // Right frame width (above)
    dimH(pL + FMT + fpW, pL + outerW, pT - 24, pT, D(FMT)) +
    // Opening height (right)
    dimV(pT + FMT, pT + FMT + fpH, pL + outerW + 28, pL + outerW, D(fpH)) +
    tx(
      pL + outerW / 2,
      pT + outerH + 46,
      "FAN SIDE ELEVATION",
      'class="vl" text-anchor="middle"',
    );

  // ── View 2: Section A–A ──────────────────────────────────────────────────

  const svY = pT + outerH + vgap + secPad;

  // Filter plate position in section (z = fbDepth - RD + FC from fan face)
  const fpzLocal = fbDepth - RD + FC;
  // Filter plate left edge sits FC inside the groove outer wall (at FMT-RW)
  const fpSvgX1 = pL + FMT - RW + FC;

  const v2 =
    tx(
      pL + outerW / 2,
      svY - 18,
      "\u2190 FAN SIDE",
      'class="vl" text-anchor="middle"',
    ) +
    tx(
      pL + outerW / 2,
      svY + fbDepth + 18,
      "FILTER SIDE \u2192",
      'class="vl" text-anchor="middle"',
    ) +
    // Opening fill first (background) so ledge hatching draws on top
    rx(
      pL + FMT,
      svY,
      fpW,
      fbDepth,
      'fill="#f8f9fa" stroke="#ccc" stroke-width="0.5"',
    ) +
    // Left frame main body
    rx(pL, svY, FMT, fbDepth - RD, 'class="ht"') +
    // Left frame rabbet: only the outer FMT-RW remains; the inner RW is the groove
    rx(pL, svY + fbDepth - RD, FMT - RW, RD, 'class="ht"') +
    // Right frame main body
    rx(pL + FMT + fpW, svY, FMT, fbDepth - RD, 'class="ht"') +
    // Right frame rabbet: only the outer FMT-RW remains
    rx(pL + FMT + fpW + RW, svY + fbDepth - RD, FMT - RW, RD, 'class="ht"') +
    // Horizontal line at groove start
    ln(pL, svY + fbDepth - RD, pL + outerW, svY + fbDepth - RD, 'class="th"') +
    // Left inner frame face (full depth — also the groove inner wall)
    ln(pL + FMT, svY, pL + FMT, svY + fbDepth, 'class="th"') +
    // Right inner frame face (full depth)
    ln(pL + FMT + fpW, svY, pL + FMT + fpW, svY + fbDepth, 'class="th"') +
    // Left groove outer wall
    ln(
      pL + FMT - RW,
      svY + fbDepth - RD,
      pL + FMT - RW,
      svY + fbDepth,
      'class="th"',
    ) +
    // Right groove outer wall
    ln(
      pL + FMT + fpW + RW,
      svY + fbDepth - RD,
      pL + FMT + fpW + RW,
      svY + fbDepth,
      'class="th"',
    ) +
    // Section border
    rx(pL, svY, outerW, fbDepth, 'class="bo"') +
    // Filter plate (shown in context)
    rx(
      fpSvgX1,
      svY + fpzLocal,
      filtW,
      FILT_T,
      'fill="#dbeafe" stroke="#3b82f6" stroke-width="0.8" stroke-dasharray="3 2"',
    ) +
    tx(
      pL + outerW / 2,
      svY + fpzLocal + FILT_T / 2 + 2,
      "FILTER PLATE (shown in context)",
      'style="font:5.5px -apple-system,sans-serif;fill:#3b82f6" text-anchor="middle"',
    ) +
    // Section dims
    dimV(svY, svY + fbDepth, pL + outerW + 35, pL + outerW, D(fbDepth)) +
    dimH(pL, pL + FMT, svY - 22, svY, D(FMT)) +
    dimH(pL + FMT, pL + FMT + fpW, svY - 22, svY, D(fpW)) +
    dimH(pL + FMT + fpW, pL + outerW, svY - 22, svY, D(FMT)) +
    dimV(
      svY + fbDepth - RD,
      svY + fbDepth,
      pL + outerW + 55,
      pL + outerW,
      D(RD),
    ) +
    dimH(pL + FMT - RW, pL + FMT, svY + fbDepth + 15, svY + fbDepth, D(RW)) +
    tx(
      pL + outerW / 2,
      svY + fbDepth + 28,
      "SECTION A\u2013A  (plan view at centreline)",
      'class="vl" text-anchor="middle"',
    );

  // ── Title block ───────────────────────────────────────────────────────────

  const tbY = H - pB + 5;
  const titleBlock =
    ln(2, tbY, W - 2, tbY, 'stroke="#111" stroke-width="0.8"') +
    tx(W / 2, tbY + 14, "FAN BOX", 'class="tb" text-anchor="middle"') +
    tx(
      W / 2,
      tbY + 27,
      "Outer: " +
        D(outerW) +
        " \u00d7 " +
        D(outerH) +
        " | Depth: " +
        D(fbDepth) +
        " | 24 mm ply | Rabbet: " +
        RW +
        "\u00d7" +
        RD +
        " mm",
      'class="ts" text-anchor="middle"',
    ) +
    tx(
      W / 2,
      tbY + 38,
      "Box inner: " +
        D(filtBoxInnerW) +
        " \u00d7 " +
        D(filtBoxInnerH) +
        " | Filter: " +
        D(filterW) +
        " \u00d7 " +
        D(filterH),
      'class="ts" text-anchor="middle"',
    ) +
    tx(
      W / 2,
      tbY + 49,
      "All dimensions: mm / decimal inches | Scale 1:1",
      'style="font:6px -apple-system,sans-serif;fill:#999" text-anchor="middle"',
    );

  return (
    '<svg xmlns="http://www.w3.org/2000/svg"' +
    ' viewBox="0 0 ' +
    r(W) +
    " " +
    r(H) +
    '"' +
    ' width="100%" style="display:block">\n' +
    DEFS +
    '<rect x="2" y="2" width="' +
    r(W - 4) +
    '" height="' +
    r(H - 4) +
    '" fill="white" stroke="#111" stroke-width="1"/>\n' +
    v1 +
    "\n" +
    v2 +
    "\n" +
    titleBlock +
    "\n" +
    "</svg>"
  );
}

// ─── Filter Box SVG ───────────────────────────────────────────────────────────

function generateFilterBoxSvg(p: FanBoxParams, d: Dims): string {
  const {
    filtW,
    filtH,
    filtBoxInnerW,
    filtBoxInnerH,
    filterW,
    filterH,
    filterFits,
  } = d;

  const pL = 75,
    pR = 35,
    pT = 45,
    pB = 55;
  const vgap = 50,
    secPad = 30;

  const secH = FILT_T + FBX_DEPTH;
  const W = pL + filtW + pR;
  const H = pT + filtH + vgap + secPad + secH + 30 + pB;

  // Hole margin: half the difference between filtW and filtBoxInnerW, at least 15 mm
  const holeMargin = Math.max(15, (filtW - filtBoxInnerW) / 2);
  const holeW = filtW - 2 * holeMargin;
  const holeH = filtH - 2 * holeMargin;

  // ── View 1: Filter Plate Face ─────────────────────────────────────────────

  const v1 =
    rx(pL, pT, filtW, filtH, 'fill="#d4a870" class="bo"') +
    rx(
      pL + holeMargin,
      pT + holeMargin,
      holeW,
      holeH,
      'fill="white" stroke="#333" stroke-width="0.8"',
    ) +
    // Section cut line B-B
    ln(pL - 15, pT + filtH / 2, pL + filtW + 15, pT + filtH / 2, 'class="sl"') +
    tx(pL - 22, pT + filtH / 2 + 2, "B", 'class="vl" text-anchor="middle"') +
    tx(
      pL + filtW + 22,
      pT + filtH / 2 + 2,
      "B",
      'class="vl" text-anchor="middle"',
    ) +
    // Dimensions
    dimH(pL, pL + filtW, pT + filtH + 32, pT + filtH, D(filtW)) +
    dimV(pT, pT + filtH, pL - 48, pL, D(filtH)) +
    dimH(pL, pL + holeMargin, pT - 24, pT, D(holeMargin)) +
    dimH(
      pL + holeMargin,
      pL + holeMargin + holeW,
      pT - 24,
      pT + holeMargin,
      D(holeW),
    ) +
    dimV(
      pT + holeMargin,
      pT + holeMargin + holeH,
      pL + filtW + 28,
      pL + filtW,
      D(holeH),
    ) +
    tx(
      pL + filtW / 2,
      pT + filtH + 46,
      "FILTER PLATE FACE",
      'class="vl" text-anchor="middle"',
    );

  // ── View 2: Section B–B ──────────────────────────────────────────────────

  const svY = pT + filtH + vgap + secPad;

  const v2 =
    tx(
      pL + filtW / 2,
      svY - 18,
      "FILTER SIDE",
      'class="vl" text-anchor="middle"',
    ) +
    tx(
      pL + filtW / 2,
      svY + secH + 18,
      "FAN SIDE",
      'class="vl" text-anchor="middle"',
    ) +
    // Zone 1: Filter plate cross-section (z = 0 → FILT_T)
    rx(pL, svY, holeMargin, FILT_T, 'class="ht"') +
    rx(
      pL + holeMargin,
      svY,
      holeW,
      FILT_T,
      'fill="#f8f9fa" stroke="#ccc" stroke-width="0.5"',
    ) +
    rx(pL + filtW - holeMargin, svY, holeMargin, FILT_T, 'class="ht"') +
    ln(pL, svY + FILT_T, pL + filtW, svY + FILT_T, 'class="th"') +
    // Zone 2: Filter box cross-section (z = FILT_T → secH)
    rx(pL, svY + FILT_T, FILT_T, FBX_DEPTH, 'class="ht"') +
    rx(
      pL + FILT_T,
      svY + FILT_T,
      filtW - 2 * FILT_T,
      FBX_DEPTH,
      'fill="#f8f9fa" stroke="#ccc" stroke-width="0.5"',
    ) +
    rx(pL + filtW - FILT_T, svY + FILT_T, FILT_T, FBX_DEPTH, 'class="ht"') +
    // Vertical edges
    ln(pL, svY, pL, svY + secH, 'class="th"') +
    ln(pL + filtW, svY, pL + filtW, svY + secH, 'class="th"') +
    // Left hole edge (plate zone)
    ln(pL + holeMargin, svY, pL + holeMargin, svY + FILT_T, 'class="th"') +
    ln(
      pL + holeMargin,
      svY + FILT_T,
      pL + FILT_T,
      svY + FILT_T + 5,
      'class="hl"',
    ) +
    // Right hole edge (plate zone)
    ln(
      pL + filtW - holeMargin,
      svY,
      pL + filtW - holeMargin,
      svY + FILT_T,
      'class="th"',
    ) +
    ln(
      pL + filtW - holeMargin,
      svY + FILT_T,
      pL + filtW - FILT_T,
      svY + FILT_T + 5,
      'class="hl"',
    ) +
    // Box inner edges
    ln(pL + FILT_T, svY + FILT_T, pL + FILT_T, svY + secH, 'class="th"') +
    ln(
      pL + filtW - FILT_T,
      svY + FILT_T,
      pL + filtW - FILT_T,
      svY + secH,
      'class="th"',
    ) +
    // Section border
    rx(pL, svY, filtW, secH, 'class="bo"') +
    // Filter media outline (dashed light blue) when filter fits inside box
    (filterFits
      ? rx(
          pL + (filtW - filterW) / 2,
          svY + FILT_T + (FBX_DEPTH - 25.4) / 2,
          filterW,
          25.4,
          'fill="#bae6fd" stroke="#0284c7" stroke-width="0.8" stroke-dasharray="3 2"',
        )
      : "") +
    // Dimensions
    dimV(svY, svY + secH, pL + filtW + 35, pL + filtW, D(FILT_T + FBX_DEPTH)) +
    dimV(svY, svY + FILT_T, pL + filtW + 55, pL + filtW, D(FILT_T)) +
    dimV(svY + FILT_T, svY + secH, pL + filtW + 55, pL + filtW, D(FBX_DEPTH)) +
    dimH(pL, pL + filtW, svY - 22, svY, D(filtW)) +
    dimH(pL, pL + FILT_T, svY + secH + 15, svY + secH, D(FILT_T)) +
    tx(
      pL + filtW / 2,
      svY + secH + 28,
      "SECTION B\u2013B  (plan view at centreline)",
      'class="vl" text-anchor="middle"',
    );

  // ── Title block ───────────────────────────────────────────────────────────

  const tbY = H - pB + 5;
  const titleBlock =
    ln(2, tbY, W - 2, tbY, 'stroke="#111" stroke-width="0.8"') +
    tx(W / 2, tbY + 14, "FILTER BOX", 'class="tb" text-anchor="middle"') +
    tx(
      W / 2,
      tbY + 27,
      "Face: " +
        D(filtW) +
        " \u00d7 " +
        D(filtH) +
        " | Plate: " +
        D(FILT_T) +
        " | Box depth: " +
        D(FBX_DEPTH),
      'class="ts" text-anchor="middle"',
    ) +
    tx(
      W / 2,
      tbY + 40,
      "All dimensions: mm / decimal inches | Scale 1:1",
      'style="font:6px -apple-system,sans-serif;fill:#999" text-anchor="middle"',
    );

  return (
    '<svg xmlns="http://www.w3.org/2000/svg"' +
    ' viewBox="0 0 ' +
    r(W) +
    " " +
    r(H) +
    '"' +
    ' width="100%" style="display:block">\n' +
    DEFS +
    '<rect x="2" y="2" width="' +
    r(W - 4) +
    '" height="' +
    r(H - 4) +
    '" fill="white" stroke="#111" stroke-width="1"/>\n' +
    v1 +
    "\n" +
    v2 +
    "\n" +
    titleBlock +
    "\n" +
    "</svg>"
  );
}

// ─── Data URI helper ──────────────────────────────────────────────────────────

function svgToDataUri(svg: string): string {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const bodyStyles = css({
  margin: "0",
  padding: "0",
  fontFamily: theme.fontFamily.sans,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl1,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
});

const navStyles = css({
  backgroundColor: "rgb(15 23 42 / 0.97)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgb(255 255 255 / 0.08)",
  paddingBlock: "16px",
  paddingInline: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const navLogoStyles = css({
  fontSize: "22px",
  fontWeight: theme.fontWeight.bold,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: "-0.03em",
});

const navRightStyles = css({
  display: "flex",
  alignItems: "center",
  gap: "20px",
});

const navEmailStyles = css({
  fontSize: theme.fontSize.sm,
  color: "rgb(148 163 184)",
});

const logoutButtonStyles = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: "rgb(148 163 184)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: theme.fontFamily.sans,
  padding: "0",
});

const mainStyles = css({
  flex: "1",
  paddingBlock: "48px",
  paddingInline: "24px",
});

const containerStyles = css({
  maxWidth: "1300px",
  marginInline: "auto",
});

const pageTitleStyles = css({
  fontSize: "28px",
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.primary,
  margin: "0",
  letterSpacing: "-0.02em",
  marginBottom: "4px",
});

const pageSubtitleStyles = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  margin: "0",
  marginBottom: "32px",
});

const breadcrumbStyles = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  marginBottom: "20px",
  display: "block",
  textDecoration: "none",
});

const sectionStyles = css({
  marginBottom: "48px",
});

const drawingHeaderStyles = css({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
});

const drawingTitleStyles = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  margin: "0",
});

const downloadLinkStyles = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.link,
  textDecoration: "none",
});

const drawingWrapStyles = css({
  backgroundColor: theme.surface.lvl2,
  borderRadius: theme.radius.lg,
  padding: "24px",
  overflowX: "auto",
});

// ─── Component ────────────────────────────────────────────────────────────────

export function DrawingsPage(
  handle: Handle<DrawingsPageProps>,
): () => RemixNode {
  const { user, params } = handle.props;
  const {
    fanSize,
    fanSpacing,
    fanRows,
    fanColumns,
    fanPaddingX,
    fanPaddingY,
    fanPlateThickness,
    fanBoxDepth,
    screwSpacing,
  } = params;

  const d = computeDims(params);
  const fanBoxSvg = generateFanBoxSvg(params, d);
  const filterBoxSvg = generateFilterBoxSvg(params, d);

  const qs =
    "fanSize=" +
    fanSize +
    "&fanSpacing=" +
    fanSpacing +
    "&fanRows=" +
    fanRows +
    "&fanColumns=" +
    fanColumns +
    "&fanPaddingX=" +
    fanPaddingX +
    "&fanPaddingY=" +
    fanPaddingY +
    "&fanPlateThickness=" +
    fanPlateThickness +
    "&fanBoxDepth=" +
    fanBoxDepth +
    "&screwSpacing=" +
    screwSpacing;

  const fanBoxUri = svgToDataUri(fanBoxSvg);
  const filterBoxUri = svgToDataUri(filterBoxSvg);

  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Engineering Drawings — Savage</title>
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
          }
        `}</style>
      </head>
      <body mix={bodyStyles}>
        <nav mix={navStyles}>
          <a href="/" mix={navLogoStyles}>
            Savage
          </a>
          <div mix={navRightStyles}>
            <span mix={navEmailStyles}>{user.email}</span>
            <form action="/logout" method="post">
              <button type="submit" mix={logoutButtonStyles}>
                Log out
              </button>
            </form>
          </div>
        </nav>

        <main mix={mainStyles}>
          <div mix={containerStyles}>
            <a href={"/fan-box?" + qs} mix={breadcrumbStyles}>
              ← 3D Model
            </a>
            <h1 mix={pageTitleStyles}>Engineering Drawings</h1>
            <p mix={pageSubtitleStyles}>
              Orthographic projections with dimensions for fabrication.
            </p>

            {/* Fan Box drawing */}
            <div mix={sectionStyles}>
              <div mix={drawingHeaderStyles}>
                <h2 mix={drawingTitleStyles}>Fan Box</h2>
                <a
                  href={fanBoxUri}
                  download="fan-box.svg"
                  mix={downloadLinkStyles}
                >
                  ↓ Download SVG
                </a>
              </div>
              <div mix={drawingWrapStyles}>
                <img
                  src={fanBoxUri}
                  alt="Fan Box Engineering Drawing"
                  style="width:100%;display:block"
                />
              </div>
            </div>

            {/* Filter Box drawing */}
            <div mix={sectionStyles}>
              <div mix={drawingHeaderStyles}>
                <h2 mix={drawingTitleStyles}>Filter Box</h2>
                <a
                  href={filterBoxUri}
                  download="filter-box.svg"
                  mix={downloadLinkStyles}
                >
                  ↓ Download SVG
                </a>
              </div>
              <div mix={drawingWrapStyles}>
                <img
                  src={filterBoxUri}
                  alt="Filter Box Engineering Drawing"
                  style="width:100%;display:block"
                />
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
