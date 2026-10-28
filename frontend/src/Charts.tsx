import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Pair } from "./types";

export const formatNumber = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "—"
    : value.toLocaleString("en-GB", { maximumFractionDigits: digits });
export const formatTime = (value: string | null, full = false) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        ...(full ? { year: "numeric" as const } : {}),
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "—";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Pair }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{formatTime(p.start_time)} UTC</strong>
      <span>
        Forecast <b>{formatNumber(p.forecast_generation)} MW</b>
      </span>
      <span>
        Actual <b>{formatNumber(p.actual_generation)} MW</b>
      </span>
      <span>
        Signed error <b>{formatNumber(p.error)} MW</b>
      </span>
      <small>Published {formatTime(p.forecast_publish_time)} UTC</small>
    </div>
  );
}

export function GenerationChart({
  rows,
  onSelect,
  error = false,
}: {
  rows: Pair[];
  onSelect: (p: Pair) => void;
  error?: boolean;
}) {
  // Render native WINDFOR delivery starts. No half-hour forecast interpolation or imputation.
  const native = rows.filter((r) => r.version_count > 0);
  const data = native.length ? native : rows;
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        error
          ? "Signed forecast error at each native forecast delivery start in MW. The same data is available in the interval tables."
          : "Forecast and actual generation at native forecast delivery starts in MW. Select a point to inspect its publications; the same data is available in the interval tables."
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 18, bottom: 0, left: 5 }}
          onClick={(state) => {
            const index = state?.activeTooltipIndex;
            if (index != null && data[Number(index)])
              onSelect(data[Number(index)]);
          }}
        >
          <defs>
            <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f8c68" stopOpacity={0.13} />
              <stop offset="100%" stopColor="#2f8c68" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#e9eeeb"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="start_time"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("en-GB", {
                timeZone: "UTC",
                day: "2-digit",
                month: "short",
              })
            }
            minTickGap={65}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7b8781", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            width={56}
            tickFormatter={(v) => `${formatNumber(v / 1000, 1)}k`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7b8781", fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip />} />
          {error ? (
            <>
              <ReferenceLine y={0} stroke="#98aaa0" />
              <Area
                type="linear"
                dataKey="error"
                stroke="#bd7350"
                fill="#f5e8de"
                strokeWidth={1.7}
                animationDuration={0}
                connectNulls={false}
              />
            </>
          ) : (
            <>
              <Area
                type="linear"
                dataKey="forecast_generation"
                stroke="none"
                fill="url(#forecastFill)"
                animationDuration={0}
                connectNulls={false}
              />
              <Line
                type="linear"
                dataKey="actual_generation"
                name="Actual"
                stroke="#8495c3"
                dot={false}
                activeDot={{ r: 5 }}
                strokeWidth={1.6}
                strokeDasharray="5 3"
                animationDuration={0}
                connectNulls={false}
              />
              <Line
                type="linear"
                dataKey="forecast_generation"
                name="Selected forecast"
                stroke="#237c59"
                dot={false}
                activeDot={{ r: 5 }}
                strokeWidth={2}
                animationDuration={0}
                connectNulls={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CorrelationChart({ rows }: { rows: Pair[] }) {
  const data = rows.filter((r) => r.error != null);
  const upper =
    Math.ceil(
      Math.max(
        1000,
        ...data.flatMap((r) => [r.actual_generation!, r.forecast_generation!]),
      ) / 1000,
    ) * 1000;
  return (
    <div
      className="chart scatter-chart"
      role="img"
      aria-label="Actual versus selected forecast generation, in MW. Points on the diagonal represent perfect agreement."
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 25, bottom: 20, left: 15 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="#e9eeeb" />
          <XAxis
            type="number"
            dataKey="actual_generation"
            name="Actual"
            domain={[0, upper]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v / 1000}k`}
            label={{
              value: "Actual generation (MW)",
              position: "bottom",
              offset: 0,
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="forecast_generation"
            name="Forecast"
            domain={[0, upper]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v / 1000}k`}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: upper, y: upper },
            ]}
            stroke="#a7b3aa"
            strokeDasharray="5 4"
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={<ChartTooltip />}
          />
          <Scatter
            data={data}
            fill="#2f8c68"
            fillOpacity={0.5}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
