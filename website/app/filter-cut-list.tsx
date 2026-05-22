import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";
import { theme } from "remix/ui/theme";
import { AppTheme } from "./theme.ts";

// ─── SVG Generation ───────────────────────────────────────────────────────────

export interface CutListParams {
  fanSize: 120 | 140;
  fanSpacing: number;
  fanRows: number;
  fanColumns: number;
  fanPaddingX: number;
  fanPaddingY: number;
}

function generateSvg(p: CutListParams): string {
  const { fanSize, fanSpacing, fanRows, fanColumns, fanPaddingX, fanPaddingY } =
    p;

  // Hole diameter is the fan size minus a 2 mm border on each side.
  const holeDiameter = fanSize - 4;
  const holeRadius = holeDiameter / 2;

  const totalWidth =
    fanPaddingX * 2 + fanColumns * fanSize + (fanColumns - 1) * fanSpacing;
  const totalHeight =
    fanPaddingY * 2 + fanRows * fanSize + (fanRows - 1) * fanSpacing;

  const holes: string[] = [];

  for (let row = 0; row < fanRows; row++) {
    for (let col = 0; col < fanColumns; col++) {
      const cx = fanPaddingX + col * (fanSize + fanSpacing) + fanSize / 2;
      const cy = fanPaddingY + row * (fanSize + fanSpacing) + fanSize / 2;

      // Fan frame outline (dashed, for alignment reference)
      const fx = fanPaddingX + col * (fanSize + fanSpacing);
      const fy = fanPaddingY + row * (fanSize + fanSpacing);
      holes.push(
        `<rect x="${fx}" y="${fy}" width="${fanSize}" height="${fanSize}" fill="none" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="2 2"/>`,
      );

      // Fan hole (the cut)
      holes.push(
        `<circle cx="${cx}" cy="${cy}" r="${holeRadius}" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="1"/>`,
      );

      // Corner mounting holes (Ø3 mm) at standard 105 mm / 125 mm pitch
      const mountPitch = fanSize === 120 ? 105 : 125;
      const halfPitch = mountPitch / 2;
      const mOffsets = [
        [-halfPitch, -halfPitch],
        [halfPitch, -halfPitch],
        [halfPitch, halfPitch],
        [-halfPitch, halfPitch],
      ];
      for (const [dx, dy] of mOffsets) {
        holes.push(
          `<circle cx="${cx + dx}" cy="${cy + dy}" r="1.5" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.5"/>`,
        );
      }
    }
  }

  // Dimension annotations
  const dimColor = "#64748b";
  const dimFont = `font-family="-apple-system, sans-serif" font-size="5" fill="${dimColor}"`;

  // Width annotation (bottom)
  const dimY = totalHeight + 8;
  const widthAnnotation = `
    <line x1="0" y1="${dimY}" x2="${totalWidth}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>
    <line x1="0" y1="${dimY - 3}" x2="0" y2="${dimY + 3}" stroke="${dimColor}" stroke-width="0.5"/>
    <line x1="${totalWidth}" y1="${dimY - 3}" x2="${totalWidth}" y2="${dimY + 3}" stroke="${dimColor}" stroke-width="0.5"/>
    <text x="${totalWidth / 2}" y="${dimY + 5}" text-anchor="middle" ${dimFont}>${totalWidth} mm</text>
  `;

  // Height annotation (right)
  const dimX = totalWidth + 8;
  const heightAnnotation = `
    <line x1="${dimX}" y1="0" x2="${dimX}" y2="${totalHeight}" stroke="${dimColor}" stroke-width="0.5"/>
    <line x1="${dimX - 3}" y1="0" x2="${dimX + 3}" y2="0" stroke="${dimColor}" stroke-width="0.5"/>
    <line x1="${dimX - 3}" y1="${totalHeight}" x2="${dimX + 3}" y2="${totalHeight}" stroke="${dimColor}" stroke-width="0.5"/>
    <text x="${dimX + 5}" y="${totalHeight / 2}" text-anchor="start" dominant-baseline="middle" ${dimFont}>${totalHeight} mm</text>
  `;

  const svgWidth = totalWidth + 40;
  const svgHeight = totalHeight + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 ${svgWidth} ${svgHeight}" width="100%" style="max-height:70vh">
  <!-- Material boundary -->
  <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="white" stroke="#0f172a" stroke-width="1"/>
  ${holes.join("\n  ")}
  ${widthAnnotation}
  ${heightAnnotation}
  <!-- Legend -->
  <circle cx="8" cy="${svgHeight - 16}" r="4" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="1"/>
  <text x="15" y="${svgHeight - 13}" ${dimFont}>Airflow hole (Ø${holeDiameter} mm)</text>
  <circle cx="8" cy="${svgHeight - 6}" r="1.5" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.5"/>
  <text x="15" y="${svgHeight - 3}" ${dimFont}>Mounting hole (Ø3 mm, ${fanSize === 120 ? "105" : "125"} mm pitch)</text>
</svg>`;
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
  maxWidth: "1100px",
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

const layoutStyles = css({
  display: "grid",
  gridTemplateColumns: "280px 1fr",
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

const svgPanelStyles = css({
  backgroundColor: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.sm,
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const svgHeaderStyles = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

const svgTitleStyles = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  margin: "0",
});

const downloadLinkStyles = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.link,
  textDecoration: "none",
  letterSpacing: theme.letterSpacing.meta,
  textTransform: "uppercase",
});

const svgWrapperStyles = css({
  backgroundColor: theme.surface.lvl2,
  borderRadius: theme.radius.lg,
  padding: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "auto",
});

const statsRowStyles = css({
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
});

const statStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const statLabelStyles = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: "uppercase",
});

const statValueStyles = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
});

// ─── Component ────────────────────────────────────────────────────────────────

export interface FilterCutListPageProps {
  user: { email: string; type: string };
  params: CutListParams;
}

function buildDownloadUrl(svg: string): string {
  // Base64-encode the SVG for a data URI download link.
  const b64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

export function FilterCutListPage(
  handle: Handle<FilterCutListPageProps>,
): () => RemixNode {
  const { user, params } = handle.props;
  const { fanSize, fanSpacing, fanRows, fanColumns, fanPaddingX, fanPaddingY } =
    params;

  const totalWidth =
    fanPaddingX * 2 + fanColumns * fanSize + (fanColumns - 1) * fanSpacing;
  const totalHeight =
    fanPaddingY * 2 + fanRows * fanSize + (fanRows - 1) * fanSpacing;
  const fanCount = fanRows * fanColumns;

  const svgMarkup = generateSvg(params);
  const downloadHref = buildDownloadUrl(svgMarkup);

  return () => (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Filter Cut List — Savage</title>
        <AppTheme />
        <style>{`
          @layer base, rmx-reset, rmx;
          @layer base {
            *, *::before, *::after { box-sizing: border-box; }
          }
        `}</style>
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
            <h1 mix={pageTitleStyles}>Filter Cut List</h1>
            <p mix={pageSubtitleStyles}>
              Configure your fan grid to generate a printable SVG cutting
              template.
            </p>

            <div mix={layoutStyles}>
              {/* ── Controls ── */}
              <div mix={panelStyles}>
                <form method="get" action="/filter-cut-list" mix={formStyles}>
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

                  <hr mix={dividerStyles} />

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

                  <button type="submit" mix={submitButtonStyles}>
                    Update
                  </button>
                </form>
              </div>

              {/* ── SVG Preview ── */}
              <div mix={svgPanelStyles}>
                <div mix={svgHeaderStyles}>
                  <h2 mix={svgTitleStyles}>
                    {fanColumns} × {fanRows} grid — {fanCount} fan
                    {fanCount !== 1 ? "s" : ""}
                  </h2>
                  <a
                    href={downloadHref}
                    download="filter-cut-list.svg"
                    mix={downloadLinkStyles}
                  >
                    ↓ Download SVG
                  </a>
                </div>

                <div mix={statsRowStyles}>
                  <div mix={statStyles}>
                    <span mix={statLabelStyles}>Sheet width</span>
                    <span mix={statValueStyles}>{totalWidth} mm</span>
                  </div>
                  <div mix={statStyles}>
                    <span mix={statLabelStyles}>Sheet height</span>
                    <span mix={statValueStyles}>{totalHeight} mm</span>
                  </div>
                  <div mix={statStyles}>
                    <span mix={statLabelStyles}>Fan size</span>
                    <span mix={statValueStyles}>{fanSize} mm</span>
                  </div>
                  <div mix={statStyles}>
                    <span mix={statLabelStyles}>Hole Ø</span>
                    <span mix={statValueStyles}>{fanSize - 4} mm</span>
                  </div>
                  <div mix={statStyles}>
                    <span mix={statLabelStyles}>Spacing</span>
                    <span mix={statValueStyles}>{fanSpacing} mm</span>
                  </div>
                </div>

                <div mix={svgWrapperStyles}>
                  <img
                    src={downloadHref}
                    alt={`${fanColumns}x${fanRows} fan hole pattern`}
                    style="width:100%;max-height:65vh;object-fit:contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
