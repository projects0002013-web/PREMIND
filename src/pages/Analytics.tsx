import { useState } from "react";
import { useApp, names } from "../components/Context";
import { testKinds, type TestKind } from "../types";
import Charts from "../components/Charts";
import Report from "../components/Report";
import { metrics, change, correlation } from "../algorithms/metrics";
import { download, csv } from "../storage/db";
export default function Analytics() {
  const { t, data, lang } = useApp();
  const [kind, setKind] = useState<TestKind>("reaction");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const results = data.results.filter((r) => r.test === kind);
  const latest = results.at(-1),
    delta = latest ? change(latest, data.results) : null;
  const assessed = results.filter((r) => r.assessment);
  const corr = correlation(
    assessed.map((r) => r.assessment!.concentration),
    assessed.map((r) => metrics(r.attempts).mean),
  );
  const shown = data.results.filter((r) =>
    (names[r.test][lang === "ru" ? 0 : 1] + " " + r.timestamp)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">PERFORMANCE ANALYTICS</span>
          <h1>
            {t("Ваши данные. Ясная картина.", "Your data. A clearer picture.")}
          </h1>
          <p>
            {t(
              "Сравнивайте измерения, а не впечатления.",
              "Compare measurements, not impressions.",
            )}
          </p>
        </div>
        <button
          className="button"
          onClick={() =>
            download("premind-results.csv", csv(data), "text/csv;charset=utf-8")
          }
        >
          {t("Экспорт CSV", "Export CSV")}
        </button>
      </div>
      <div className="actions">
        <label>
          {t("Тест", "Test")}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TestKind)}
          >
            {testKinds.map((k) => (
              <option key={k} value={k}>
                {names[k][lang === "ru" ? 0 : 1]}
              </option>
            ))}
          </select>
        </label>
        <span className="badge">
          {results.length} {t("измерений", "measurements")}
        </span>
      </div>
      <div className="analytics-grid">
        {(
          ["mean", "accuracy", "errors", "variability", "subjective"] as const
        ).map((metric, i) => (
          <section className="card" key={metric}>
            <h2>
              {
                [
                  t("Время реакции", "Reaction time"),
                  t("Точность внимания", "Attention accuracy"),
                  t("Ошибки", "Errors"),
                  t("Вариабельность реакции", "Reaction variability"),
                  t("Субъективная оценка", "Subjective assessment"),
                ][i]
              }
            </h2>
            <Charts results={results} metric={metric} />
            <p className="footnote">
              {
                [
                  t(
                    "Среднее и медиана правильных ответов с измеренным временем.",
                    "Mean and median of correct timed responses.",
                  ),
                  t(
                    "Доля правильных ответов, включая корректное воздержание в Go/No-Go.",
                    "Correct responses, including correct inhibition in Go/No-Go.",
                  ),
                  t(
                    "Неправильные ответы и пропуски; ранние нажатия учитываются отдельно.",
                    "Incorrect responses and omissions; early presses are counted separately.",
                  ),
                  t(
                    "Выборочное стандартное отклонение времени правильных ответов.",
                    "Sample standard deviation of correct response latency.",
                  ),
                  t(
                    "Самооценка снижения концентрации от 0 до 10. Сопоставляйте с графиком времени реакции выше.",
                    "Self-rated concentration decline from 0 to 10. Compare with the latency chart above.",
                  ),
                ][i]
              }
            </p>
          </section>
        ))}
        <section className="card">
          <h2>{t("Сравнение с baseline", "Baseline comparison")}</h2>
          <p>
            {delta
              ? `${t("Время реакции", "Reaction time")}: ${delta.reaction?.toFixed(1) ?? "—"}%; ${t("точность", "accuracy")}: ${delta.accuracy.toFixed(1)} ${t("п.п.", "pp")}`
              : t(
                  "Недостаточно данных: нужны 3 предыдущих измерения на одном устройстве.",
                  "Insufficient data: 3 prior measurements on the same device are required.",
                )}
          </p>
          <h3>{t("Субъективное и объективное", "Subjective vs objective")}</h3>
          <p>
            {t("Корреляция Пирсона", "Pearson correlation")}:{" "}
            {corr === null ? "—" : corr.toFixed(3)} (n={assessed.length})
          </p>
          <p className="footnote">
            {t(
              "Корреляция не доказывает причинность. Нельзя объединять разные типы тестов в одну шкалу времени.",
              "Correlation does not establish causation. Different tests cannot be pooled into one latency scale.",
            )}
          </p>
          <h3>{t("Экспериментальный прогноз", "Experimental prediction")}</h3>
          <div className="notice">
            {t(
              "Недостаточно данных для достоверного прогноза. Модель не обучена и не откалибрована.",
              "Insufficient data for a reliable prediction. No trained, calibrated model is available.",
            )}
          </div>
        </section>
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>
            {t("История и сравнение сессий", "Session history and comparison")}
          </h2>
          <input
            aria-label={t("Поиск", "Search")}
            placeholder={t("Поиск по тесту или дате", "Search by test or date")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!shown.length && (
          <p className="muted">
            {t("Нет подходящих измерений.", "No matching measurements.")}
          </p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Выбрать", "Select")}</th>
                <th>{t("Дата", "Date")}</th>
                <th>{t("Тест", "Test")}</th>
                <th>{t("Время, мс", "Latency, ms")}</th>
                <th>{t("Точность", "Accuracy")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={r.id}
                      checked={selected.includes(r.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, r.id]
                            : selected.filter((id) => id !== r.id),
                        )
                      }
                    />
                  </td>
                  <td>{new Date(r.timestamp).toLocaleString(lang)}</td>
                  <td>{names[r.test][lang === "ru" ? 0 : 1]}</td>
                  <td>
                    {metrics(r.attempts).timedCount
                      ? metrics(r.attempts).mean.toFixed(0)
                      : "—"}
                  </td>
                  <td>{metrics(r.attempts).accuracy.toFixed(1)}%</td>
                  <td>
                    <button
                      className="button ghost"
                      onClick={() =>
                        download(
                          `premind-${r.id}.json`,
                          JSON.stringify(r, null, 2),
                        )
                      }
                    >
                      {t("JSON", "JSON")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected.length > 0 && (
          <Report
            results={data.results.filter((r) => selected.includes(r.id))}
            title={t(
              "Сравнение выбранных сессий",
              "Selected session comparison",
            )}
          />
        )}
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>{t("Календарь измерений", "Measurement calendar")}</h2>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="calendar">
          {Array.from(
            {
              length: new Date(
                Number(month.slice(0, 4)),
                Number(month.slice(5, 7)),
                0,
              ).getDate(),
            },
            (_, i) => {
              const count = data.results.filter((r) =>
                r.timestamp.startsWith(
                  `${month}-${String(i + 1).padStart(2, "0")}`,
                ),
              ).length;
              return (
                <div className={count ? "has-data" : ""} key={i}>
                  <strong>{i + 1}</strong>
                  <span>
                    {count ? `${count} ${t("тестов", "tests")}` : "—"}
                  </span>
                </div>
              );
            },
          )}
        </div>
      </section>
    </>
  );
}
