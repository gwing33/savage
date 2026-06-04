import { createHtmlResponse } from "remix/response/html";
import { createRedirectResponse } from "remix/response/redirect";
import { renderToString } from "remix/ui/server";
import { db } from "../../db.ts";
import { getSessionToken } from "../../auth.ts";
import type { FanBoxParams } from "../../fan-box.tsx";
import { DrawingsPage } from "../../fan-box-drawings.tsx";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: FanBoxParams = {
  fanSize: 120,
  fanSpacing: 5,
  fanRows: 5,
  fanColumns: 3,
  fanPaddingX: 10,
  fanPaddingY: 10,
  fanPlateThickness: 6,
  fanBoxDepth: 152.4,
  screwSpacing: 127,
  filterSizeW: 406.4,
  filterSizeH: 635,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseParams(url: string): FanBoxParams {
  const { searchParams } = new URL(url);

  const fanSizeRaw = Number(searchParams.get("fanSize"));
  const fanSize: 120 | 140 = fanSizeRaw === 140 ? 140 : 120;

  const fanSpacingRaw = Number(
    searchParams.get("fanSpacing") ?? DEFAULTS.fanSpacing,
  );
  const fanSpacing = clamp(fanSpacingRaw, 0, 100);

  const fanRowsRaw = Number(searchParams.get("fanRows") ?? DEFAULTS.fanRows);
  const fanRows = clamp(Math.round(fanRowsRaw), 1, 20);

  const fanColumnsRaw = Number(
    searchParams.get("fanColumns") ?? DEFAULTS.fanColumns,
  );
  const fanColumns = clamp(Math.round(fanColumnsRaw), 1, 20);

  const fanPaddingXRaw = Number(
    searchParams.get("fanPaddingX") ?? DEFAULTS.fanPaddingX,
  );
  const fanPaddingX = clamp(fanPaddingXRaw, 0, 200);

  const fanPaddingYRaw = Number(
    searchParams.get("fanPaddingY") ?? DEFAULTS.fanPaddingY,
  );
  const fanPaddingY = clamp(fanPaddingYRaw, 0, 200);

  const fanPlateThicknessRaw = Number(
    searchParams.get("fanPlateThickness") ?? DEFAULTS.fanPlateThickness,
  );
  const fanPlateThickness = clamp(fanPlateThicknessRaw, 3, 25);

  const fanBoxDepthRaw = Number(
    searchParams.get("fanBoxDepth") ?? DEFAULTS.fanBoxDepth,
  );
  const fanBoxDepth = clamp(fanBoxDepthRaw, 100, 500);

  const screwSpacingRaw = Number(
    searchParams.get("screwSpacing") ?? DEFAULTS.screwSpacing,
  );
  const screwSpacing = clamp(screwSpacingRaw, 50, 300);

  const filterSizeWRaw = Number(
    searchParams.get("filterSizeW") ?? DEFAULTS.filterSizeW,
  );
  const filterSizeW = clamp(filterSizeWRaw, 50, 1500);

  const filterSizeHRaw = Number(
    searchParams.get("filterSizeH") ?? DEFAULTS.filterSizeH,
  );
  const filterSizeH = clamp(filterSizeHRaw, 50, 1500);

  return {
    fanSize: isNaN(fanSizeRaw) ? DEFAULTS.fanSize : fanSize,
    fanSpacing: isNaN(fanSpacingRaw) ? DEFAULTS.fanSpacing : fanSpacing,
    fanRows: isNaN(fanRowsRaw) ? DEFAULTS.fanRows : fanRows,
    fanColumns: isNaN(fanColumnsRaw) ? DEFAULTS.fanColumns : fanColumns,
    fanPaddingX: isNaN(fanPaddingXRaw) ? DEFAULTS.fanPaddingX : fanPaddingX,
    fanPaddingY: isNaN(fanPaddingYRaw) ? DEFAULTS.fanPaddingY : fanPaddingY,
    fanPlateThickness: isNaN(fanPlateThicknessRaw)
      ? DEFAULTS.fanPlateThickness
      : fanPlateThickness,
    fanBoxDepth: isNaN(fanBoxDepthRaw) ? DEFAULTS.fanBoxDepth : fanBoxDepth,
    screwSpacing: isNaN(screwSpacingRaw) ? DEFAULTS.screwSpacing : screwSpacing,
    filterSizeW: isNaN(filterSizeWRaw) ? DEFAULTS.filterSizeW : filterSizeW,
    filterSizeH: isNaN(filterSizeHRaw) ? DEFAULTS.filterSizeH : filterSizeH,
  };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export default async function fanBoxDrawingsController(context: any) {
  const token = getSessionToken(context.request);
  if (!token) return createRedirectResponse("/login");

  const user = await db.getSessionUser(token).catch(() => null);
  if (!user) return createRedirectResponse("/login");

  const params = parseParams(context.request.url);

  const html = await renderToString(
    <DrawingsPage user={user} params={params} />,
  );
  return createHtmlResponse(html);
}
