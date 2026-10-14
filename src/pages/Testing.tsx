import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  Focus,
  Brain,
  ScanSearch,
  Palette,
  ArrowRight,
} from "lucide-react";
import { useApp, names } from "../components/Context";
import TestRunner from "../components/TestRunner";
import Report from "../components/Report";
import { metrics, change, VERSION } from "../algorithms/metrics";
import { testKinds, type TestKind, type Attempt, type Result } from "../types";
export const deviceId = () => {
  let id = localStorage.getItem("premind-device");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("premind-device", id);
  }
  return id;
};
export default function Testing() {
  const { data, update, t, lang } = useApp();
  const [params] = useSearchParams();
  const requested = params.get("test");
  const [kind, setKind] = useState<TestKind | null>(null);
  const [practice, setPractice] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Attempt[] | null>(null);
  const icons = [Activity, Palette, Focus, Brain, ScanSearch];
  const descriptions = [
    t(
      "Зрительно-моторная реакция на случайный сигнал.",
      "Visual-motor response to a randomly timed signal.",
    ),
    t(
      "Скорость обработки и контроль интерференции.",
      "Processing speed and interference control.",
    ),
    t(
      "Реагируйте на цели, пропускайте отвлекающие стимулы.",
      "Respond to targets, withhold responses to distractors.",
    ),
    t(
      "Запоминайте и воспроизводите последовательности.",
      "Remember and recall digit sequences.",
    ),
    t(
      "Найдите целевой символ среди похожих.",
      "Find a target among similar symbols.",
    ),
  ];
  const complete = async (attempts: Attempt[]) => {
    const r: Result = {
      id: crypto.randomUUID(),
      participantId: data.participant.id,
      sessionId: crypto.randomUUID(),
      test: kind!,
      timestamp: new Date().toISOString(),
      algorithmVersion: VERSION,
      device: deviceId(),
      attempts,
    };
    try {
      if (!practice)
        await update((d) => ({ ...d, results: [...d.results, r] }));
      setPending(null);
      setError("");
      setResult(r);
      setKind(null);
    } catch {
      setPending(attempts);
      setError(
        t(
          "Не удалось сохранить. Не закрывайте страницу; повторите сохранение.",
          "Could not save. Keep this page open and retry.",
        ),
      );
    }
  };
  if (kind)
    return (
      <>
        <TestRunner
          key={kind}
          kind={kind}
          practice={practice}
          onComplete={complete}
          onStop={() => setKind(null)}
        />
        {error && <p role="alert">{error}</p>}
        {pending && (
          <button className="button primary" onClick={() => complete(pending)}>
            {t("Повторить сохранение", "Retry saving")}
          </button>
        )}
      </>
    );
  if (result) {
    const m = metrics(result.attempts),
      c = change(result, data.results);
    return (
      <>
        <div className="page-title">
          <div>
            <span className="eyebrow">
              {practice
                ? t("ОБУЧЕНИЕ · НЕ СОХРАНЕНО", "PRACTICE · NOT SAVED")
                : t("ИЗМЕРЕНИЕ СОХРАНЕНО", "MEASUREMENT SAVED")}
            </span>
            <h1>{t("Ваши результаты", "Your results")}</h1>
            <p>{names[result.test][lang === "ru" ? 0 : 1]}</p>
          </div>
        </div>
        <div className="metric-grid">
          {[
            [
              t("Среднее, мс", "Mean, ms"),
              m.timedCount ? m.mean.toFixed(0) : "—",
            ],
            [
              t("Медиана, мс", "Median, ms"),
              m.timedCount ? m.median.toFixed(0) : "—",
            ],
            [t("Точность", "Accuracy"), m.accuracy.toFixed(1) + "%"],
            [t("Разброс, мс", "Variability, ms"), m.variability.toFixed(0)],
          ].map(([l, v]) => (
            <div className="card metric" key={l}>
              <span>{l}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <section className="card">
          <h2>{t("Что показывают измерения", "What the measurements show")}</h2>
          <p>
            {t("Ошибки", "Errors")}: {m.errors} · {t("Пропуски", "Omissions")}:{" "}
            {m.omissions} · {t("Ранние ответы", "Early responses")}:{" "}
            {m.premature}
          </p>
          {result.test === "stroop" && (
            <p>
              {t(
                "Разница конфликтных и согласованных стимулов",
                "Conflict minus congruent latency",
              )}
              : {m.stroopCost?.toFixed(0) ?? "—"} ms
            </p>
          )}
          <p>
            {c
              ? `${t("Изменение времени реакции", "Reaction time change")}: ${c.reaction?.toFixed(1) ?? "—"}%; ${t("изменение точности", "accuracy change")}: ${c.accuracy.toFixed(1)} ${t("п.п.", "pp")}`
              : t(
                  "Для сравнения нужны три предыдущих измерения этого теста на этом устройстве.",
                  "Comparison requires three prior measurements of this test on this device.",
                )}
          </p>
          <p className="muted">
            {t(
              "Результат не является диагнозом. Используйте одно устройство и одинаковые условия.",
              "This result is not a diagnosis. Use the same device and consistent conditions.",
            )}
          </p>
          {result.test === "attention" && (
            <p>
              {t(
                "Точность первой / второй половины",
                "First / second half accuracy",
              )}
              : {metrics(result.attempts.slice(0, 12)).accuracy.toFixed(1)}% /{" "}
              {metrics(result.attempts.slice(12)).accuracy.toFixed(1)}%
            </p>
          )}
          <div className="actions">
            <Link className="button primary" to="/">
              {t("На главную", "Dashboard")}
            </Link>
            <Link className="button" to="/analytics">
              {t("Аналитика", "Analytics")}
            </Link>
            <button className="button" onClick={() => setResult(null)}>
              {t("Другой тест", "Another test")}
            </button>
          </div>
        </section>
        <section className="card">
          <Report results={[result]} />
        </section>
      </>
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">COGNITIVE TESTING</span>
          <h1>
            {t(
              "Пять способов исследовать внимание",
              "Five ways to explore attention",
            )}
          </h1>
          <p>
            {t(
              "Выберите тест. Сначала попробуйте обучение без сохранения результатов.",
              "Choose a test. Try practice first without saving results.",
            )}
          </p>
        </div>
      </div>
      <div className="notice">
        {t(
          "Проходите тесты в спокойной обстановке. Можно остановиться в любой момент.",
          "Take tests in a quiet setting. You can stop at any time.",
        )}
      </div>
      <div className="test-cards">
        {testKinds.map((k, i) => {
          const Icon = icons[i];
          return (
            <section
              className={`card ${requested === k ? "highlight" : ""}`}
              key={k}
            >
              <div className="icon-box">
                <Icon />
              </div>
              <span className="eyebrow">0{i + 1} / COGNITIVE TEST</span>
              <h2>{names[k][lang === "ru" ? 0 : 1]}</h2>
              <p>{descriptions[i]}</p>
              <div className="actions">
                <button
                  className="button primary"
                  onClick={() => {
                    setPractice(false);
                    setKind(k);
                  }}
                >
                  {t("Начать тест", "Start test")}
                  <ArrowRight size={16} />
                </button>
                <button
                  className="button ghost"
                  onClick={() => {
                    setPractice(true);
                    setKind(k);
                  }}
                >
                  {t("Обучение", "Practice")}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
