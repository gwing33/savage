import { createHtmlResponse } from "remix/response/html";
import { createRedirectResponse } from "remix/response/redirect";
import { renderToString } from "remix/ui/server";
import { db } from "../../db.ts";
import { getSessionToken } from "../../auth.ts";
import type { CutListParams } from "../../filter-cut-list.tsx";
import { FilterCutListPage } from "../../filter-cut-list.tsx";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: CutListParams = {
  fanSize: 120,
  fanSpacing: 5,
  fanRows: 5,
  fanColumns: 3,
  fanPaddingX: 15,
  fanPaddingY: 15,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseParams(url: string): CutListParams {
  const { searchParams } = new URL(url);

  const fanSizeRaw = Number(searchParams.get("fanSize"));
  const fanSize: 120 | 140 = fanSizeRaw === 140 ? 140 : 120;

  const fanSpacing = clamp(
    Number(searchParams.get("fanSpacing") ?? DEFAULTS.fanSpacing),
    0,
    100,
  );
  const fanRows = clamp(
    Math.round(Number(searchParams.get("fanRows") ?? DEFAULTS.fanRows)),
    1,
    20,
  );
  const fanColumns = clamp(
    Math.round(Number(searchParams.get("fanColumns") ?? DEFAULTS.fanColumns)),
    1,
    20,
  );
  const fanPaddingX = clamp(
    Number(searchParams.get("fanPaddingX") ?? DEFAULTS.fanPaddingX),
    0,
    200,
  );
  const fanPaddingY = clamp(
    Number(searchParams.get("fanPaddingY") ?? DEFAULTS.fanPaddingY),
    0,
    200,
  );

  return {
    fanSize: isNaN(fanSizeRaw) ? DEFAULTS.fanSize : fanSize,
    fanSpacing: isNaN(fanSpacing) ? DEFAULTS.fanSpacing : fanSpacing,
    fanRows: isNaN(fanRows) ? DEFAULTS.fanRows : fanRows,
    fanColumns: isNaN(fanColumns) ? DEFAULTS.fanColumns : fanColumns,
    fanPaddingX: isNaN(fanPaddingX) ? DEFAULTS.fanPaddingX : fanPaddingX,
    fanPaddingY: isNaN(fanPaddingY) ? DEFAULTS.fanPaddingY : fanPaddingY,
  };
}

// ─── Controller ───────────────────────────────────────────────────────────────

export default async function filterCutListController(context: any) {
  const token = getSessionToken(context.request);
  if (!token) return createRedirectResponse("/login");

  const user = await db.getSessionUser(token).catch(() => null);
  if (!user) return createRedirectResponse("/login");

  const params = parseParams(context.request.url);

  const html = await renderToString(
    <FilterCutListPage user={user} params={params} />,
  );
  return createHtmlResponse(html);
}
