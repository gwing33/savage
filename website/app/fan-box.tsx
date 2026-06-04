import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";
import { theme } from "remix/ui/theme";
import { AppTheme } from "./theme.ts";

// ─── Fabrication constants ────────────────────────────────────────────────────

const FMT = 24; // frame material thickness mm (24mm ply)
const RW = 12; // rabbet width mm
const RD = 12; // rabbet depth mm
const FC = (3 / 32) * 25.4; // filter clearance per side ≈ 2.381 mm
const FILT_T = 12; // filter material thickness mm
const FBX_DEPTH = 4 * 25.4; // filter box depth = 4" = 101.6 mm

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FanBoxParams {
  // shared with cut list
  fanSize: 120 | 140;
  fanSpacing: number;
  fanRows: number;
  fanColumns: number;
  fanPaddingX: number;
  fanPaddingY: number;
  // new
  fanPlateThickness: number; // default 6 mm
  fanBoxDepth: number; // default 152.4 mm (6")
  screwSpacing: number; // default 127 mm (5")
  filterSizeW: number; // filter width mm  (default 406.4 = 16")
  filterSizeH: number; // filter height mm (default 635   = 25")
}

interface HoleCenter {
  x: number;
  y: number;
}

interface ScrewMarker {
  x: number;
  y: number;
}

interface ClientConfig {
  fpW: number;
  fpH: number;
  fpT: number;
  fbDepth: number;
  fmt: number;
  rw: number;
  rd: number;
  fc: number;
  filtT: number;
  fbxDepth: number;
  holeR: number;
  holeCenters: HoleCenter[];
  screwMarkers: ScrewMarker[];
  filtW: number;
  filtH: number;
  totalDepth: number;
  filterW: number;
  filterH: number;
  filtBoxInnerW: number;
  filtBoxInnerH: number;
  filterFits: boolean;
  filterClearanceW: number;
  filterClearanceH: number;
  minPaddingX: number;
  minPaddingY: number;
}

interface CutListItem {
  name: string;
  qty: number;
  material: string;
  w: number;
  h: number;
  d: number;
  note?: string;
}

// ─── Computation ──────────────────────────────────────────────────────────────

function computeConfig(p: FanBoxParams): ClientConfig {
  const fpW =
    p.fanPaddingX * 2 +
    p.fanColumns * p.fanSize +
    (p.fanColumns - 1) * p.fanSpacing;
  const fpH =
    p.fanPaddingY * 2 + p.fanRows * p.fanSize + (p.fanRows - 1) * p.fanSpacing;

  const holeR = (p.fanSize - 4) / 2;

  const holeCenters: HoleCenter[] = [];
  for (let row = 0; row < p.fanRows; row++) {
    for (let col = 0; col < p.fanColumns; col++) {
      holeCenters.push({
        x: p.fanPaddingX + col * (p.fanSize + p.fanSpacing) + p.fanSize / 2,
        y: p.fanPaddingY + row * (p.fanSize + p.fanSpacing) + p.fanSize / 2,
      });
    }
  }

  const screwMarkers: ScrewMarker[] = [];
  const half = p.screwSpacing / 2;
  // bottom and top edges (12 mm from edge)
  for (let x = half; x < fpW; x += p.screwSpacing) {
    screwMarkers.push({ x, y: 12 });
    screwMarkers.push({ x, y: fpH - 12 });
  }
  // left and right edges (12 mm from edge)
  for (let y = half; y < fpH; y += p.screwSpacing) {
    screwMarkers.push({ x: 12, y });
    screwMarkers.push({ x: fpW - 12, y });
  }

  // Filter plate is larger than the main opening: its outer edges nest into the
  // RW-wide groove with FC clearance from each groove wall.
  const filtW = fpW + 2 * RW - 2 * FC;
  const filtH = fpH + 2 * RW - 2 * FC;
  // Filter box lives inside the fan box (cassette inserts toward the fans),
  // so total depth is just plate + fan-box frame.
  const totalDepth = p.fanPlateThickness + p.fanBoxDepth;
  const filtBoxInnerW = fpW - 2 * FC - 2 * FILT_T;
  const filtBoxInnerH = fpH - 2 * FC - 2 * FILT_T;
  const filterFits =
    filtBoxInnerW >= p.filterSizeW && filtBoxInnerH >= p.filterSizeH;
  const filterClearanceW = filtBoxInnerW - p.filterSizeW;
  const filterClearanceH = filtBoxInnerH - p.filterSizeH;
  const fanGridW = p.fanColumns * p.fanSize + (p.fanColumns - 1) * p.fanSpacing;
  const fanGridH = p.fanRows * p.fanSize + (p.fanRows - 1) * p.fanSpacing;
  const minPaddingX = Math.max(
    0,
    Math.ceil((p.filterSizeW + 2 * FC + 2 * FILT_T - fanGridW) / 2),
  );
  const minPaddingY = Math.max(
    0,
    Math.ceil((p.filterSizeH + 2 * FC + 2 * FILT_T - fanGridH) / 2),
  );

  return {
    fpW,
    fpH,
    fpT: p.fanPlateThickness,
    fbDepth: p.fanBoxDepth,
    fmt: FMT,
    rw: RW,
    rd: RD,
    fc: FC,
    filtT: FILT_T,
    fbxDepth: FBX_DEPTH,
    holeR,
    holeCenters,
    screwMarkers,
    filtW,
    filtH,
    totalDepth,
    filterW: p.filterSizeW,
    filterH: p.filterSizeH,
    filtBoxInnerW,
    filtBoxInnerH,
    filterFits,
    filterClearanceW,
    filterClearanceH,
    minPaddingX,
    minPaddingY,
  };
}

// ─── Cut list ─────────────────────────────────────────────────────────────────

function buildCutList(cfg: ClientConfig): CutListItem[] {
  const {
    fpW,
    fpH,
    fpT,
    fbDepth,
    filtW,
    filtH,
    filterW,
    filterH,
    filtBoxInnerW,
    filtBoxInnerH,
  } = cfg;
  return [
    {
      name: "Fan Plate",
      qty: 1,
      material: `${fpT}mm sheet`,
      w: fpW,
      h: fpH,
      d: fpT,
      note: "Fan holes per cut list SVG",
    },
    {
      name: "Fan Box \u2014 Left & Right",
      qty: 2,
      material: "24mm ply",
      w: FMT,
      h: fpH + 2 * FMT,
      d: fbDepth,
      note: "45\u00b0 miter both ends",
    },
    {
      name: "Fan Box \u2014 Top & Bottom",
      qty: 2,
      material: "24mm ply",
      w: fpW + 2 * FMT,
      h: FMT,
      d: fbDepth,
      note: "45\u00b0 miter both ends",
    },
    {
      name: "Filter Plate",
      qty: 1,
      material: "12mm ply",
      w: filtW,
      h: filtH,
      d: FILT_T,
      note: "Large central airflow hole",
    },
    {
      name: "Filter Box \u2014 Left & Right",
      qty: 2,
      material: "12mm ply",
      w: FILT_T,
      h: fpH - 2 * FC - 2 * FILT_T,
      d: FBX_DEPTH,
    },
    {
      name: "Filter Box \u2014 Top & Bottom",
      qty: 2,
      material: "12mm ply",
      w: fpW - 2 * FC,
      h: FILT_T,
      d: FBX_DEPTH,
    },
    {
      name: "Filter Media",
      qty: 1,
      material: "purchased",
      w: filterW,
      h: filterH,
      d: FBX_DEPTH,
      note:
        "Nominal size \u2014 box inner " +
        Math.round(filtBoxInnerW) +
        " \u00d7 " +
        Math.round(filtBoxInnerH) +
        " mm",
    },
  ];
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function r1(n: number): string {
  return n.toFixed(1);
}

function toIn(mm: number): string {
  return (mm / 25.4).toFixed(2) + '"';
}

function dual(mm: number): string {
  return r1(mm) + " mm / " + toIn(mm);
}

// ─── Three.js script builder ──────────────────────────────────────────────────

function buildThreeScript(cfg: ClientConfig): string {
  return (
    "import * as THREE from 'three';\n" +
    "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\n\n" +
    "var c = " +
    JSON.stringify(cfg) +
    ";\n\n" +
    "var container = document.getElementById('viewer');\n" +
    "var W = container.clientWidth;\n" +
    "var H = container.clientHeight;\n\n" +
    "var renderer = new THREE.WebGLRenderer({ antialias: true });\n" +
    "renderer.setSize(W, H);\n" +
    "renderer.setPixelRatio(window.devicePixelRatio);\n" +
    "renderer.shadowMap.enabled = true;\n" +
    "renderer.shadowMap.type = THREE.PCFSoftShadowMap;\n" +
    "container.appendChild(renderer.domElement);\n\n" +
    "var scene = new THREE.Scene();\n" +
    "scene.background = new THREE.Color(0xf1f5f9);\n\n" +
    "var aspect = W / H;\n" +
    "var camera = new THREE.PerspectiveCamera(38, aspect, 1, 100000);\n" +
    "var cx = c.fpW / 2;\n" +
    "var cy = c.fpH / 2;\n" +
    "var cz = c.totalDepth / 2;\n" +
    "var D = Math.max(c.fpW, c.fpH, c.totalDepth) * 1.9;\n" +
    "camera.position.set(cx + D * 0.75, cy + D * 0.5, cz + D * 1.0);\n\n" +
    "var controls = new OrbitControls(camera, renderer.domElement);\n" +
    "controls.target.set(cx, cy, cz);\n" +
    "controls.enableDamping = true;\n" +
    "controls.dampingFactor = 0.05;\n" +
    "controls.autoRotate = true;\n" +
    "controls.autoRotateSpeed = 0.6;\n" +
    "controls.update();\n\n" +
    "var autoRotateTimer = null;\n" +
    "controls.addEventListener('start', function() {\n" +
    "  controls.autoRotate = false;\n" +
    "  renderer.domElement.style.cursor = 'grabbing';\n" +
    "  if (autoRotateTimer) clearTimeout(autoRotateTimer);\n" +
    "});\n" +
    "controls.addEventListener('end', function() {\n" +
    "  renderer.domElement.style.cursor = 'grab';\n" +
    "  autoRotateTimer = setTimeout(function() {\n" +
    "    controls.autoRotate = true;\n" +
    "  }, 8000);\n" +
    "});\n" +
    "renderer.domElement.style.cursor = 'grab';\n\n" +
    "var ambient = new THREE.AmbientLight(0xffffff, 0.65);\n" +
    "scene.add(ambient);\n" +
    "var sun = new THREE.DirectionalLight(0xffffff, 0.85);\n" +
    "sun.position.set(2000, 3000, 2500);\n" +
    "sun.castShadow = true;\n" +
    "scene.add(sun);\n" +
    "var fill = new THREE.DirectionalLight(0xc8d8ff, 0.35);\n" +
    "fill.position.set(-1000, -800, -1500);\n" +
    "scene.add(fill);\n\n" +
    "function addBox(w, h, d, x, y, z, mat) {\n" +
    "  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);\n" +
    "  m.castShadow = true;\n" +
    "  m.receiveShadow = true;\n" +
    "  m.position.set(x + w / 2, y + h / 2, z + d / 2);\n" +
    "  scene.add(m);\n" +
    "  return m;\n" +
    "}\n\n" +
    "var fanPlateMat = new THREE.MeshLambertMaterial({ color: 0x334155, side: THREE.DoubleSide });\n" +
    "var screwMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });\n" +
    "var frameMat = new THREE.MeshLambertMaterial({ color: 0xb08040 });\n" +
    "var filtPlateMat = new THREE.MeshLambertMaterial({ color: 0xd4a870, side: THREE.DoubleSide });\n" +
    "var filtBoxMat = new THREE.MeshLambertMaterial({ color: 0xc09860 });\n" +
    "var camMat = new THREE.MeshLambertMaterial({ color: 0x64748b });\n\n" +
    "// Fan plate with holes\n" +
    "var fpShape = new THREE.Shape();\n" +
    "fpShape.moveTo(0, 0);\n" +
    "fpShape.lineTo(c.fpW, 0);\n" +
    "fpShape.lineTo(c.fpW, c.fpH);\n" +
    "fpShape.lineTo(0, c.fpH);\n" +
    "fpShape.closePath();\n" +
    "for (var hi = 0; hi !== c.holeCenters.length; hi++) {\n" +
    "  var hc = c.holeCenters[hi];\n" +
    "  var hole = new THREE.Path();\n" +
    "  hole.absarc(hc.x, hc.y, c.holeR, 0, Math.PI * 2, true);\n" +
    "  fpShape.holes.push(hole);\n" +
    "}\n" +
    "var fpGeo = new THREE.ExtrudeGeometry(fpShape, { depth: c.fpT, bevelEnabled: false });\n" +
    "var fpMesh = new THREE.Mesh(fpGeo, fanPlateMat);\n" +
    "fpMesh.castShadow = true;\n" +
    "fpMesh.receiveShadow = true;\n" +
    "scene.add(fpMesh);\n\n" +
    "// Screw markers\n" +
    "for (var si = 0; si !== c.screwMarkers.length; si++) {\n" +
    "  var sm = c.screwMarkers[si];\n" +
    "  var screwGeo = new THREE.CylinderGeometry(2.5, 2.5, c.fpT + 2, 8);\n" +
    "  var screwMesh = new THREE.Mesh(screwGeo, screwMat);\n" +
    "  screwMesh.castShadow = true;\n" +
    "  screwMesh.rotation.x = Math.PI / 2;\n" +
    "  screwMesh.position.set(sm.x, sm.y, -1);\n" +
    "  scene.add(screwMesh);\n" +
    "}\n\n" +
    "// Fan box frame — two extruded shapes give automatic mitered corners\n" +
    "var fz = c.fpT;\n" +
    "var fbDepth = c.fbDepth;\n" +
    "var rz = fz + fbDepth - c.rd;\n" +
    "// Main body: outer rect minus fan-plate opening, extruded (fbDepth - rd)\n" +
    "var fmS = new THREE.Shape();\n" +
    "fmS.moveTo(-c.fmt, -c.fmt);\n" +
    "fmS.lineTo(c.fpW + c.fmt, -c.fmt);\n" +
    "fmS.lineTo(c.fpW + c.fmt, c.fpH + c.fmt);\n" +
    "fmS.lineTo(-c.fmt, c.fpH + c.fmt);\n" +
    "fmS.closePath();\n" +
    "var fmH = new THREE.Path();\n" +
    "fmH.moveTo(0, 0);\n" +
    "fmH.lineTo(c.fpW, 0);\n" +
    "fmH.lineTo(c.fpW, c.fpH);\n" +
    "fmH.lineTo(0, c.fpH);\n" +
    "fmH.closePath();\n" +
    "fmS.holes.push(fmH);\n" +
    "var fmMainGeo = new THREE.ExtrudeGeometry(fmS, { depth: fbDepth - c.rd, bevelEnabled: false });\n" +
    "var fmMainMesh = new THREE.Mesh(fmMainGeo, frameMat);\n" +
    "fmMainMesh.position.z = fz;\n" +
    "fmMainMesh.castShadow = true;\n" +
    "fmMainMesh.receiveShadow = true;\n" +
    "scene.add(fmMainMesh);\n" +
    "// Rabbet section: same outer, inner opening stepped in by rw on each side\n" +
    "var frS = new THREE.Shape();\n" +
    "frS.moveTo(-c.fmt, -c.fmt);\n" +
    "frS.lineTo(c.fpW + c.fmt, -c.fmt);\n" +
    "frS.lineTo(c.fpW + c.fmt, c.fpH + c.fmt);\n" +
    "frS.lineTo(-c.fmt, c.fpH + c.fmt);\n" +
    "frS.closePath();\n" +
    "var frH = new THREE.Path();\n" +
    "frH.moveTo(c.rw, c.rw);\n" +
    "frH.lineTo(c.fpW - c.rw, c.rw);\n" +
    "frH.lineTo(c.fpW - c.rw, c.fpH - c.rw);\n" +
    "frH.lineTo(c.rw, c.fpH - c.rw);\n" +
    "frH.closePath();\n" +
    "frS.holes.push(frH);\n" +
    "var fmRabGeo = new THREE.ExtrudeGeometry(frS, { depth: c.rd, bevelEnabled: false });\n" +
    "var fmRabMesh = new THREE.Mesh(fmRabGeo, frameMat);\n" +
    "fmRabMesh.position.z = rz;\n" +
    "fmRabMesh.castShadow = true;\n" +
    "fmRabMesh.receiveShadow = true;\n" +
    "scene.add(fmRabMesh);\n\n" +
    "// Filter plate\n" +
    "var fox = c.fc - c.rw;\n" +
    "var foy = c.fc - c.rw;\n" +
    "var fpz = fz + fbDepth - c.rd + c.fc;\n" +
    "var filtShape = new THREE.Shape();\n" +
    "filtShape.moveTo(0, 0);\n" +
    "filtShape.lineTo(c.filtW, 0);\n" +
    "filtShape.lineTo(c.filtW, c.filtH);\n" +
    "filtShape.lineTo(0, c.filtH);\n" +
    "filtShape.closePath();\n" +
    "var margin = Math.max(15, Math.min(c.filtW, c.filtH) * 0.06);\n" +
    "var airHole = new THREE.Path();\n" +
    "airHole.moveTo(margin, margin);\n" +
    "airHole.lineTo(margin, c.filtH - margin);\n" +
    "airHole.lineTo(c.filtW - margin, c.filtH - margin);\n" +
    "airHole.lineTo(c.filtW - margin, margin);\n" +
    "airHole.closePath();\n" +
    "filtShape.holes.push(airHole);\n" +
    "var filtGeo = new THREE.ExtrudeGeometry(filtShape, { depth: c.filtT, bevelEnabled: false });\n" +
    "var filtMesh = new THREE.Mesh(filtGeo, filtPlateMat);\n" +
    "filtMesh.castShadow = true;\n" +
    "filtMesh.receiveShadow = true;\n" +
    "filtMesh.position.set(fox, foy, fpz);\n" +
    "scene.add(filtMesh);\n\n" +
    "// Filter box frame \u2014 fits inside the main opening (smaller than filter plate)\n" +
    "var fbxZ = fpz - c.fbxDepth;\n" +
    "var bx = c.fc; var by = c.fc;\n" +
    "var bw = c.fpW - 2 * c.fc; var bh = c.fpH - 2 * c.fc;\n" +
    "addBox(c.filtT, bh - 2 * c.filtT, c.fbxDepth, bx, by + c.filtT, fbxZ, filtBoxMat);\n" +
    "addBox(c.filtT, bh - 2 * c.filtT, c.fbxDepth, bx + bw - c.filtT, by + c.filtT, fbxZ, filtBoxMat);\n" +
    "addBox(bw, c.filtT, c.fbxDepth, bx, by, fbxZ, filtBoxMat);\n" +
    "addBox(bw, c.filtT, c.fbxDepth, bx, by + bh - c.filtT, fbxZ, filtBoxMat);\n\n" +
    "// Filter media (light blue slab, shown when filter fits inside box)\n" +
    "if (c.filterFits) {\n" +
    "  var filtMediaMat = new THREE.MeshLambertMaterial({ color: 0xbae6fd });\n" +
    "  var fmW = c.filterW;\n" +
    "  var fmH = c.filterH;\n" +
    "  var fmT = 25.4;\n" +
    "  var fmX = bx + c.filtT + (c.filtBoxInnerW - fmW) / 2;\n" +
    "  var fmY = by + c.filtT + (c.filtBoxInnerH - fmH) / 2;\n" +
    "  var fmZ = fpz - fmT;\n" +
    "  var fmGeo = new THREE.BoxGeometry(fmW, fmH, fmT);\n" +
    "  var fmMesh = new THREE.Mesh(fmGeo, filtMediaMat);\n" +
    "  fmMesh.castShadow = true;\n" +
    "  fmMesh.position.set(fmX + fmW / 2, fmY + fmH / 2, fmZ + fmT / 2);\n" +
    "  scene.add(fmMesh);\n" +
    "}\n\n" +
    "// Toggle cams\n" +
    "var nCams = Math.max(2, Math.floor((c.fpW + 2 * c.fmt) / 200));\n" +
    "var totalBoxW = c.fpW + 2 * c.fmt;\n" +
    "var camZ = fz + c.fbDepth - 65;\n" +
    "for (var ci = 0; ci !== nCams; ci++) {\n" +
    "  var camCX = -c.fmt + (ci + 0.5) * totalBoxW / nCams;\n" +
    "  var camX = camCX - 12.5;\n" +
    "  addBox(25, 12, 50, camX, -c.fmt - 12, camZ, camMat);\n" +
    "  addBox(10, 8, 18, camX + 7.5, -c.fmt - 12 - 8, camZ + 16, camMat);\n" +
    "  addBox(25, 12, 50, camX, c.fpH + c.fmt, camZ, camMat);\n" +
    "  addBox(10, 8, 18, camX + 7.5, c.fpH + c.fmt + 12, camZ + 16, camMat);\n" +
    "}\n\n" +
    "// Grid\n" +
    "var gridSize = Math.max(c.fpW, c.fpH, c.totalDepth) * 2;\n" +
    "var grid = new THREE.GridHelper(gridSize, 20, 0x888888, 0x444444);\n" +
    "grid.position.set(c.fpW / 2, -c.fmt - 25, c.totalDepth / 2);\n" +
    "grid.rotation.x = Math.PI / 2;\n" +
    "scene.add(grid);\n\n" +
    "window.addEventListener('resize', function() {\n" +
    "  var newW = container.clientWidth;\n" +
    "  var newH = container.clientHeight;\n" +
    "  camera.aspect = newW / newH;\n" +
    "  camera.updateProjectionMatrix();\n" +
    "  renderer.setSize(newW, newH);\n" +
    "});\n\n" +
    "function animate() {\n" +
    "  requestAnimationFrame(animate);\n" +
    "  controls.update();\n" +
    "  renderer.render(scene, camera);\n" +
    "}\n" +
    "animate();\n"
  );
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
  maxWidth: "1200px",
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

const layoutStyles = css({
  display: "grid",
  gridTemplateColumns: "300px 1fr",
  gap: "32px",
  alignItems: "start",
});

const panelStyles = css({
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.sm,
  padding: "24px",
});

const formStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "20px",
});

const fieldGroupStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

const labelStyles = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: "uppercase",
});

const inputStyles = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  padding: "8px 10px",
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: theme.fontFamily.sans,
});

const selectStyles = css({
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  padding: "8px 10px",
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: theme.fontFamily.sans,
});

const inputRowStyles = css({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
});

const dividerStyles = css({
  border: "none",
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  margin: "0",
});

const submitButtonStyles = css({
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: "none",
  borderRadius: theme.radius.md,
  padding: "10px 16px",
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  cursor: "pointer",
  fontFamily: theme.fontFamily.sans,
  width: "100%",
});

const sectionLabelStyles = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: "uppercase",
  marginBottom: "8px",
  display: "block",
});

const viewerPanelStyles = css({
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.sm,
  padding: "0",
  overflow: "hidden",
});

const viewerHeaderStyles = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
});

const viewerTitleStyles = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  margin: "0",
});

const viewerHintStyles = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
});

const viewerStyles = css({
  width: "100%",
  height: "65vh",
  minHeight: "400px",
  display: "block",
});

const legendStyles = css({
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  padding: "12px 20px",
  borderTop: `1px solid ${theme.colors.border.subtle}`,
});

const legendItemStyles = css({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
});

function legendDotStyles(color: string): string {
  return (
    "background:" +
    color +
    ";width:10px;height:10px;border-radius:2px;flex-shrink:0"
  );
}

const tableWrapStyles = css({
  overflowX: "auto",
});

const tableStyles = css({
  width: "100%",
  borderCollapse: "collapse",
  fontSize: theme.fontSize.xs,
});

const thStyles = css({
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.muted,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

const tdStyles = css({
  padding: "8px 12px",
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary,
  whiteSpace: "nowrap",
});

const noteBadgeStyles = css({
  fontSize: theme.fontSize.xxxs,
  color: theme.colors.text.muted,
  fontStyle: "italic",
});

const fitOkStyles = css({
  backgroundColor: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: theme.radius.md,
  padding: "10px 12px",
  fontSize: theme.fontSize.xs,
  color: "#166534",
});

const fitWarnStyles = css({
  backgroundColor: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: theme.radius.md,
  padding: "10px 12px",
  fontSize: theme.fontSize.xs,
  color: "#9a3412",
});

const fitLabelStyles = css({
  fontWeight: theme.fontWeight.semibold,
  display: "block",
  marginBottom: "4px",
});

const fitDetailStyles = css({
  margin: "0",
  lineHeight: "1.6",
});

// ─── Component ────────────────────────────────────────────────────────────────

export interface FanBoxPageProps {
  user: { email: string; type: string };
  params: FanBoxParams;
}

export function FanBoxPage(handle: Handle<FanBoxPageProps>): () => RemixNode {
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
    filterSizeW,
    filterSizeH,
  } = params;

  const cfg = computeConfig(params);
  const cutList = buildCutList(cfg);
  const {
    fpW,
    fpH,
    fpT,
    fbDepth,
    filtW,
    filtH,
    totalDepth,
    filtBoxInnerW,
    filtBoxInnerH,
    filterFits,
    filterClearanceW,
    filterClearanceH,
    minPaddingX,
    minPaddingY,
  } = cfg;

  const cutListQs =
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
    "&filterSizeW=" +
    filterSizeW +
    "&filterSizeH=" +
    filterSizeH;

  const importMap = JSON.stringify({
    imports: {
      three: "https://cdn.jsdelivr.net/npm/three@0.176.0/build/three.module.js",
      "three/addons/":
        "https://cdn.jsdelivr.net/npm/three@0.176.0/examples/jsm/",
    },
  });

  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fan Box Builder — Savage</title>
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
          }
        `}</style>
        <script type="importmap">{importMap}</script>
      </head>
      <body mix={bodyStyles}>
        {/* Nav */}
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
            <a href={"/filter-cut-list?" + cutListQs} mix={breadcrumbStyles}>
              ← Fan Plate / Cut List
            </a>
            <h1 mix={pageTitleStyles}>Fan Box Builder</h1>
            <p mix={pageSubtitleStyles}>
              3D assembly model with cut list. All dimensions shown in mm and
              inches.
            </p>

            <div mix={layoutStyles}>
              {/* ── Left: Controls ── */}
              <div mix={panelStyles}>
                <form method="get" action="/fan-box" mix={formStyles}>
                  {/* Fan Configuration */}
                  <span mix={sectionLabelStyles}>Fan Configuration</span>

                  <div mix={fieldGroupStyles}>
                    <label for="fanSize" mix={labelStyles}>
                      Fan Size
                    </label>
                    <select id="fanSize" name="fanSize" mix={selectStyles}>
                      <option
                        value="120"
                        selected={fanSize === 120 ? true : undefined}
                      >
                        120 mm
                      </option>
                      <option
                        value="140"
                        selected={fanSize === 140 ? true : undefined}
                      >
                        140 mm
                      </option>
                    </select>
                  </div>

                  <div mix={fieldGroupStyles}>
                    <label for="fanSpacing" mix={labelStyles}>
                      Fan Spacing (mm)
                    </label>
                    <input
                      id="fanSpacing"
                      type="number"
                      name="fanSpacing"
                      min="0"
                      max="100"
                      step="0.5"
                      value={String(fanSpacing)}
                      mix={inputStyles}
                    />
                  </div>

                  <div mix={inputRowStyles}>
                    <div mix={fieldGroupStyles}>
                      <label for="fanRows" mix={labelStyles}>
                        Rows
                      </label>
                      <input
                        id="fanRows"
                        type="number"
                        name="fanRows"
                        min="1"
                        max="20"
                        step="1"
                        value={String(fanRows)}
                        mix={inputStyles}
                      />
                    </div>
                    <div mix={fieldGroupStyles}>
                      <label for="fanColumns" mix={labelStyles}>
                        Columns
                      </label>
                      <input
                        id="fanColumns"
                        type="number"
                        name="fanColumns"
                        min="1"
                        max="20"
                        step="1"
                        value={String(fanColumns)}
                        mix={inputStyles}
                      />
                    </div>
                  </div>

                  <div mix={inputRowStyles}>
                    <div mix={fieldGroupStyles}>
                      <label for="fanPaddingX" mix={labelStyles}>
                        Padding X (mm)
                      </label>
                      <input
                        id="fanPaddingX"
                        type="number"
                        name="fanPaddingX"
                        min="0"
                        max="200"
                        step="0.5"
                        value={String(fanPaddingX)}
                        mix={inputStyles}
                      />
                    </div>
                    <div mix={fieldGroupStyles}>
                      <label for="fanPaddingY" mix={labelStyles}>
                        Padding Y (mm)
                      </label>
                      <input
                        id="fanPaddingY"
                        type="number"
                        name="fanPaddingY"
                        min="0"
                        max="200"
                        step="0.5"
                        value={String(fanPaddingY)}
                        mix={inputStyles}
                      />
                    </div>
                  </div>

                  <hr mix={dividerStyles} />

                  {/* Box Configuration */}
                  <span mix={sectionLabelStyles}>Box Configuration</span>

                  <div mix={fieldGroupStyles}>
                    <label for="fanPlateThickness" mix={labelStyles}>
                      Plate Thickness (mm)
                    </label>
                    <input
                      id="fanPlateThickness"
                      type="number"
                      name="fanPlateThickness"
                      min="3"
                      max="25"
                      step="0.5"
                      value={String(fanPlateThickness)}
                      mix={inputStyles}
                    />
                  </div>

                  <div mix={fieldGroupStyles}>
                    <label for="fanBoxDepth" mix={labelStyles}>
                      Box Depth (mm)
                    </label>
                    <input
                      id="fanBoxDepth"
                      type="number"
                      name="fanBoxDepth"
                      min="100"
                      max="500"
                      step="0.5"
                      value={String(fanBoxDepth)}
                      mix={inputStyles}
                    />
                    <span
                      style={
                        "font-size:11px;color:" +
                        theme.colors.text.muted +
                        ";margin-top:2px"
                      }
                    >
                      {r1(fanBoxDepth)} mm = {toIn(fanBoxDepth)}
                    </span>
                  </div>

                  <div mix={fieldGroupStyles}>
                    <label for="screwSpacing" mix={labelStyles}>
                      Screw Spacing (mm)
                    </label>
                    <input
                      id="screwSpacing"
                      type="number"
                      name="screwSpacing"
                      min="50"
                      max="300"
                      step="1"
                      value={String(screwSpacing)}
                      mix={inputStyles}
                    />
                  </div>

                  <hr mix={dividerStyles} />
                  <span mix={sectionLabelStyles}>Filter</span>

                  <div mix={inputRowStyles}>
                    <div mix={fieldGroupStyles}>
                      <label for="filterSizeW" mix={labelStyles}>
                        Width (mm)
                      </label>
                      <input
                        id="filterSizeW"
                        type="number"
                        name="filterSizeW"
                        min="50"
                        max="1500"
                        step="1"
                        value={String(filterSizeW)}
                        mix={inputStyles}
                      />
                    </div>
                    <div mix={fieldGroupStyles}>
                      <label for="filterSizeH" mix={labelStyles}>
                        Height (mm)
                      </label>
                      <input
                        id="filterSizeH"
                        type="number"
                        name="filterSizeH"
                        min="50"
                        max="1500"
                        step="1"
                        value={String(filterSizeH)}
                        mix={inputStyles}
                      />
                    </div>
                  </div>

                  <p style="margin:0;font-size:11px;color:#64748b">
                    {toIn(filterSizeW)} \u00d7 {toIn(filterSizeH)}{" "}
                    &nbsp;\u00b7&nbsp; Common: 16\u00d725" = 406\u00d7635 mm
                  </p>

                  <div mix={filterFits ? fitOkStyles : fitWarnStyles}>
                    <span mix={fitLabelStyles}>
                      {filterFits
                        ? "\u2713 Filter fits"
                        : "\u2717 Filter too large"}
                    </span>
                    <p mix={fitDetailStyles}>
                      Box inner: {r1(filtBoxInnerW)} \u00d7 {r1(filtBoxInnerH)}{" "}
                      mm
                      {filterFits
                        ? " \u2014 " +
                          r1(filterClearanceW) +
                          " mm slack W, " +
                          r1(filterClearanceH) +
                          " mm slack H"
                        : " \u2014 need padding X \u2265 " +
                          minPaddingX +
                          " mm, Y \u2265 " +
                          minPaddingY +
                          " mm"}
                    </p>
                  </div>

                  <button type="submit" mix={submitButtonStyles}>
                    Update
                  </button>

                  <a
                    href={"/filter-cut-list?" + cutListQs}
                    style="display:block;text-align:center;font-size:12px;color:#0ea5e9;text-decoration:none;margin-top:4px"
                  >
                    View Fan Plate SVG →
                  </a>
                  <a
                    href={
                      "/fan-box-drawings?" +
                      cutListQs +
                      "&fanPlateThickness=" +
                      fanPlateThickness +
                      "&fanBoxDepth=" +
                      fanBoxDepth +
                      "&screwSpacing=" +
                      screwSpacing
                    }
                    style="display:block;text-align:center;font-size:12px;color:#0ea5e9;text-decoration:none;margin-top:4px"
                  >
                    View Engineering Drawings →
                  </a>
                </form>
              </div>

              {/* ── Right: Viewer + Tables ── */}
              <div style="display:flex;flex-direction:column;gap:24px">
                {/* 3D Viewer */}
                <div mix={viewerPanelStyles}>
                  <div mix={viewerHeaderStyles}>
                    <h2 mix={viewerTitleStyles}>3D Assembly</h2>
                    <span mix={viewerHintStyles}>
                      Drag to orbit · Scroll to zoom · Auto-rotates
                    </span>
                  </div>
                  <div id="viewer" mix={viewerStyles}></div>
                  <div mix={legendStyles}>
                    <div mix={legendItemStyles}>
                      <span style={legendDotStyles("#334155")}></span>Fan Plate
                    </div>
                    <div mix={legendItemStyles}>
                      <span style={legendDotStyles("#b08040")}></span>Fan Box
                      Frame
                    </div>

                    <div mix={legendItemStyles}>
                      <span style={legendDotStyles("#d4a870")}></span>Filter
                      Plate
                    </div>
                    <div mix={legendItemStyles}>
                      <span style={legendDotStyles("#c09860")}></span>Filter Box
                    </div>
                    <div mix={legendItemStyles}>
                      <span style={legendDotStyles("#64748b")}></span>Toggle
                      Cams
                    </div>
                  </div>
                </div>

                {/* Key Dimensions */}
                <div mix={panelStyles}>
                  <span mix={sectionLabelStyles}>Key Dimensions</span>
                  <div mix={tableWrapStyles}>
                    <table mix={tableStyles}>
                      <thead>
                        <tr>
                          <th mix={thStyles}>Component</th>
                          <th mix={thStyles}>Width</th>
                          <th mix={thStyles}>Height</th>
                          <th mix={thStyles}>Depth / Thickness</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td mix={tdStyles}>Fan Plate</td>
                          <td mix={tdStyles}>{dual(fpW)}</td>
                          <td mix={tdStyles}>{dual(fpH)}</td>
                          <td mix={tdStyles}>{dual(fpT)}</td>
                        </tr>
                        <tr>
                          <td mix={tdStyles}>Fan Box (outer)</td>
                          <td mix={tdStyles}>{dual(fpW + 2 * FMT)}</td>
                          <td mix={tdStyles}>{dual(fpH + 2 * FMT)}</td>
                          <td mix={tdStyles}>{dual(fbDepth)}</td>
                        </tr>
                        <tr>
                          <td mix={tdStyles}>Rabbet opening</td>
                          <td mix={tdStyles}>{dual(fpW - 2 * RW)}</td>
                          <td mix={tdStyles}>{dual(fpH - 2 * RW)}</td>
                          <td mix={tdStyles}>12 × 12 mm</td>
                        </tr>
                        <tr>
                          <td mix={tdStyles}>Filter Plate</td>
                          <td mix={tdStyles}>{dual(filtW)}</td>
                          <td mix={tdStyles}>{dual(filtH)}</td>
                          <td mix={tdStyles}>{dual(FILT_T)}</td>
                        </tr>
                        <tr>
                          <td mix={tdStyles}>Filter Box</td>
                          <td mix={tdStyles}>{dual(filtW)}</td>
                          <td mix={tdStyles}>{dual(filtH)}</td>
                          <td mix={tdStyles}>{dual(FBX_DEPTH)}</td>
                        </tr>
                        <tr>
                          <td mix={tdStyles}>Filter Media</td>
                          <td mix={tdStyles}>{dual(filterSizeW)}</td>
                          <td mix={tdStyles}>{dual(filterSizeH)}</td>
                          <td mix={tdStyles}>
                            {filterFits
                              ? "\u2713 " + r1(filterClearanceW) + " mm slack"
                              : "\u2717 need +" +
                                minPaddingX +
                                "/" +
                                minPaddingY +
                                " mm pad"}
                          </td>
                        </tr>
                        <tr>
                          <td mix={tdStyles}>Full Assembly</td>
                          <td mix={tdStyles}>{dual(fpW + 2 * FMT)}</td>
                          <td mix={tdStyles}>{dual(fpH + 2 * FMT)}</td>
                          <td mix={tdStyles}>{dual(totalDepth)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cut List */}
                <div mix={panelStyles}>
                  <span mix={sectionLabelStyles}>Cut List</span>
                  <div mix={tableWrapStyles}>
                    <table mix={tableStyles}>
                      <thead>
                        <tr>
                          <th mix={thStyles}>Piece</th>
                          <th mix={thStyles}>Qty</th>
                          <th mix={thStyles}>Material</th>
                          <th mix={thStyles}>W</th>
                          <th mix={thStyles}>H</th>
                          <th mix={thStyles}>D</th>
                          <th mix={thStyles}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cutList.map((item) => (
                          <tr>
                            <td mix={tdStyles}>{item.name}</td>
                            <td mix={tdStyles}>{item.qty}</td>
                            <td mix={tdStyles}>{item.material}</td>
                            <td mix={tdStyles}>{dual(item.w)}</td>
                            <td mix={tdStyles}>{dual(item.h)}</td>
                            <td mix={tdStyles}>{dual(item.d)}</td>
                            <td mix={tdStyles}>
                              {item.note ? (
                                <span mix={noteBadgeStyles}>{item.note}</span>
                              ) : (
                                "\u2014"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <script type="module">{buildThreeScript(cfg)}</script>
      </body>
    </html>
  );
}
