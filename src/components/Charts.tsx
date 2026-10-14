import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useApp } from "./Context";
import { useRef } from "react";
import { download } from "../storage/db";
import { metrics } from "../algorithms/metrics";
import type { Result } from "../types";
export default function Charts({
  results,
  metric = "mean",
}: {
  results: Result[];
  metric?: "mean" | "accuracy" | "errors" | "variability" | "subjective";
}) {
  const { t, lang } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const points = [...results]
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((r, i) => ({
      name: `${i + 1}`,
      date: new Date(r.timestamp).toLocaleString(lang),
      value:
        metric === "subjective"
          ? r.assessment?.concentration
          : metrics(r.attempts)[metric],
      median: metrics(r.attempts).median,
      test: r.test,
    }));
  if (!points.length)
    return (
      <div className="empty-chart">
        <div className="chart-lines" />
        <p>
          {t(
            "Здесь появится история ваших измерений",
            "Your measurements will appear here",
          )}
        </p>
        <span>
          {t("Начните с первого тестирования", "Start with your first test")}
        </span>
      </div>
    );
  return (
    <div
      ref={ref}
      className="chart"
      role="img"
      aria-label={t("График измерений", "Measurement chart")}
    >
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: 12,
            }}
            labelFormatter={(_, p) => p[0]?.payload.date}
          />
          <Legend />
          <Line
            name={
              metric === "mean"
                ? t("Среднее, мс", "Mean, ms")
                : metric === "accuracy"
                  ? t("Точность, %", "Accuracy, %")
                  : metric === "errors"
                    ? t("Ошибки", "Errors")
                    : metric === "subjective"
                      ? t(
                          "Снижение концентрации, 0–10",
                          "Concentration decline, 0–10",
                        )
                      : t("Разброс, мс", "Variability, ms")
            }
            type="monotone"
            dataKey="value"
            stroke="#22d3ee"
            strokeWidth={3}
            dot={{ r: 4 }}
            connectNulls={false}
          />
          {metric === "mean" && (
            <Line
              name={t("Медиана, мс", "Median, ms")}
              dataKey="median"
              stroke="#818cf8"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <button
        className="button ghost chart-export"
        onClick={() => {
          const svg = ref.current?.querySelector("svg");
          if (svg)
            download(
              `premind-${metric}.svg`,
              new XMLSerializer().serializeToString(svg),
              "image/svg+xml",
            );
        }}
      >
        {t("Экспорт графика SVG", "Export chart SVG")}
      </button>
    </div>
  );
}
