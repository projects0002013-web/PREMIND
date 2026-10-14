import { useApp, names } from "./Context";
import { metrics, change } from "../algorithms/metrics";
import Charts from "./Charts";
import type { Result, Experiment } from "../types";
export default function Report({
  results,
  title,
  experiment,
}: {
  results: Result[];
  title?: string;
  experiment?: Experiment;
}) {
  const { t, data, lang } = useApp();
  const participants = new Set(results.map((r) => r.participantId));
  return (
    <div className="report">
      <div className="section-heading">
        <h2>
          PREMIND · {title ?? t("Исследовательский отчёт", "Research report")}
        </h2>
        <button className="button" onClick={() => window.print()}>
          {t("Сохранить PDF / печать", "Save PDF / print")}
        </button>
      </div>
      <p>
        {new Date().toLocaleDateString(lang)} · {participants.size}{" "}
        {t("участников", "participants")} · {results.length}{" "}
        {t("измерений", "measurements")}
      </p>
      <h3>{t("Цель и гипотеза", "Objective and hypothesis")}</h3>
      <p>
        {experiment?.hypothesis ??
          t(
            "Определить, наблюдаются ли изменения объективных показателей до субъективного осознания снижения концентрации.",
            "Determine whether objective changes occur before subjective awareness of declining concentration.",
          )}
      </p>
      <h3>{t("Методология", "Methodology")}</h3>
      {experiment && (
        <p>
          {t("Заданные параметры", "Predefined settings")}: {experiment.points}{" "}
          {t("точек", "points")}, {experiment.interval}s {t("перерыв", "break")}
          ; {t("порог реакции", "reaction threshold")} +{experiment.threshold}%;{" "}
          {t("тесты", "tests")}:{" "}
          {experiment.tests
            .map((k) => names[k][lang === "ru" ? 0 : 1])
            .join(", ")}
          .
        </p>
      )}
      <p>
        {t(
          "Повторные браузерные измерения. Личный baseline: первые три измерения одного теста на одном устройстве, строго до текущего результата. Исследовательский критерий: рост времени реакции ≥ заданного порога (по умолчанию 20%) или снижение точности ≥10 процентных пунктов. Это не клинические нормы.",
          "Repeated browser measurements. Personal baseline: the first three prior measurements of the same test on the same device. Exploratory criterion: reaction time increase ≥ configured threshold (default 20%) or accuracy decrease ≥10 percentage points. These are not clinical norms.",
        )}
      </p>
      <Charts results={results.filter((r) => r.test === "reaction")} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                t("Дата", "Date"),
                t("Тест", "Test"),
                t("Среднее, мс", "Mean, ms"),
                t("Медиана", "Median"),
                t("SD", "SD"),
                t("Точность", "Accuracy"),
                t("Ошибки", "Errors"),
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const m = metrics(r.attempts);
              return (
                <tr key={r.id}>
                  <td>{new Date(r.timestamp).toLocaleString(lang)}</td>
                  <td>{names[r.test][lang === "ru" ? 0 : 1]}</td>
                  <td>{m.timedCount ? m.mean.toFixed(0) : "—"}</td>
                  <td>{m.timedCount ? m.median.toFixed(0) : "—"}</td>
                  <td>{m.variability.toFixed(0)}</td>
                  <td>{m.accuracy.toFixed(1)}%</td>
                  <td>{m.errors}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3>{t("Выводы", "Conclusions")}</h3>
      <p>
        {!results.length
          ? t(
              "Измерений нет. Выводы пока невозможны.",
              "No measurements. Conclusions are not yet possible.",
            )
          : results.some(
                (r) =>
                  change(r, data.results, experiment?.threshold ?? 20)?.decline,
              )
            ? t(
                "В отдельных измерениях обнаружены изменения по предварительному критерию. Они требуют повторения и проверки смешивающих факторов.",
                "Some measurements meet the exploratory change criterion. Replication and examination of confounders are required.",
              )
            : t(
                "Недостаточно свидетельств устойчивого ухудшения по выбранному критерию. Отсутствие сигнала не доказывает отсутствие изменений.",
                "There is insufficient evidence of sustained decline under the selected criterion. Absence of a signal does not prove absence of change.",
              )}
      </p>
      <h3>{t("Ограничения", "Limitations")}</h3>
      <p>
        {t(
          "Малая выборка, эффект тренировки, различия устройств, сон, мотивация и отвлекающие факторы. Корреляция не доказывает причинность. PREMIND не ставит диагнозы. Алгоритм v1.0 описательный; предсказательная модель не обучена.",
          "Small samples, practice effects, device differences, sleep, motivation and distractions. Correlation does not establish causation. PREMIND does not diagnose conditions. Algorithm v1.0 is descriptive; no predictive model has been trained.",
        )}
      </p>
    </div>
  );
}
