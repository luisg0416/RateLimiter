import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { useTrafficPoller } from "../hooks/useTrafficPoller";
import styles from "./TrafficChart.module.css";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrafficChartProps {
  clientId: string;
}


const COLOR = {
  allowed: "#22c55e",
  blocked: "#ef4444",
  grid:    "#ffffff14",
  axis:    "#6b7280",
} as const;


function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}


function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

   const remaining = payload.find((p) => p.dataKey === "remaining")?.value ?? 0;
   
   return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTime}>
        {typeof label === "number" ? formatTime(label) : label}
      </div>
      <div className={styles.tooltipAllowed}>remaining &nbsp;&nbsp;{remaining}</div>
    </div>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  color: string;
}

function StatPill({ label, value, color }: StatPillProps) {
  return (
    // style prop sets --pill-color so the CSS module can use color-mix() on it.
    // This avoids duplicating the .statPill class for each colour variant.
    <div
      className={styles.statPill}
      style={{ "--pill-color": color } as React.CSSProperties}
    >
      <span className={styles.statPillLabel}>{label}</span>
      <span className={styles.statPillValue}>{value.toLocaleString()}</span>
    </div>
  );
}

// ─── Live indicator ───────────────────────────────────────────────────────────

function LiveIndicator() {
  return (
    <div className={styles.liveWrapper}>
      <span className={styles.liveDot} />
      <span className={styles.liveLabel}>LIVE</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TrafficChart({ clientId }: TrafficChartProps) {
    const { data, allowed, blocked } = useTrafficPoller(clientId);
    const latestAllowed = data.length > 0 ? data[data.length - 1].isAllowed : true;
    
    return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.sectionLabel}>Traffic Monitor</h2>
          <p  className={styles.clientId}>{clientId}</p>
        </div>
        <div className={styles.headerRight}>
          <span
            className={`${styles.statusBadge} ${
              latestAllowed ? styles.statusAllowed : styles.statusBlocked
            }`}
          >
            {latestAllowed ? "✓ ALLOWED" : "✗ RATE LIMITED"}
          </span>

          <LiveIndicator />
        </div>
      </div>
      <div className={styles.statsRow}>
        <StatPill label="Allowed"  value={allowed} color={COLOR.allowed} />
        <StatPill label="Blocked"  value={blocked} color={COLOR.blocked} />
        {data.length > 0 && (
            <StatPill
            label="Remaining"
            value={data[data.length - 1].remaining}
            color={COLOR.axis}
            />
        )}
        </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLOR.grid}
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, fill: COLOR.axis }}
            axisLine={{ stroke: COLOR.grid }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, fill: COLOR.axis }}
            axisLine={false}
            tickLine={false}
            width={28}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: COLOR.grid, strokeWidth: 1 }}
          />

          <Legend
            wrapperStyle={{
              fontFamily:    "var(--font-mono, monospace)",
              fontSize:      "11px",
              paddingTop:    "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          />
          <Line
            type="monotone"
            dataKey="remaining"
            name="Remaining"
            stroke={COLOR.allowed}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: COLOR.allowed }}
            isAnimationActive={false}
            />
        </LineChart>
      </ResponsiveContainer>
      <p className={styles.footer}>
        Polling every 1s · rolling window of 50 data points · all times UTC
      </p>

    </div>
  );
}
