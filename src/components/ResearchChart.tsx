import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useApp } from "./Context";
import type { Result, ResearchSession } from "../types";
import { metrics } from "../algorithms/metrics";
export default function ResearchChart({
  results,
  session,
}: {
  results: Result[];
  session: ResearchSession;
}) {
  const { t } = useApp();
  const first = results[0] ? metrics(results[0].attempts).mean : 0;
  const points = results.map((r, i) => ({
    point: i + 1,
    objective:
      first && metrics(r.attempts).timedCount
        ? (100 * (metrics(r.attempts).mean - first)) / first
        : null,
    subjective:
      session.assessments.find((a) => a.point === i + 1)?.values
        .concentration ?? null,
  }));
  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height={290}>
          <LineChart data={points}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis dataKey="point" stroke="#94a3b8" />
            <YAxis yAxisId="left" stroke="#22d3ee" />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 10]}
              stroke="#a78bfa"
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              dataKey="objective"
              name={t("Изменение времени, %", "Latency change, %")}
              stroke="#22d3ee"
              strokeWidth={2}
              connectNulls={false}
            />
            <Line
              yAxisId="right"
              dataKey="subjective"
              name={t(
                "Снижение концентрации, 0–10",
                "Concentration decline, 0–10",
              )}
              stroke="#a78bfa"
              strokeWidth={2}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="footnote">
        {t(
          "Оси имеют разные шкалы. Самооценка взята после соответствующей серии. Пропущенные оценки не интерполируются.",
          "Axes use different scales. Self-ratings were taken after each corresponding series. Missing values are not interpolated.",
        )}
      </p>
    </>
  );
}
