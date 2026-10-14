import { useEffect, useState } from "react";
import { useApp, names } from "../components/Context";
import {
  testKinds,
  type Experiment,
  type Assessment,
  type Attempt,
  type Result,
  type ResearchSession,
} from "../types";
import TestRunner from "../components/TestRunner";
import Report from "../components/Report";
import ResearchChart from "../components/ResearchChart";
import { researchOrder } from "../algorithms/research";
import { VERSION } from "../algorithms/metrics";
import { deviceId } from "./Testing";
import { download, csv } from "../storage/db";
const defaultAssessment: Assessment = {
  fatigue: 0,
  concentration: 0,
  motivation: 5,
};
export default function Research() {
  const { t, data, update, lang } = useApp();
  const [name, setName] = useState(
    "PREMIND · " + t("Школьное исследование", "School study"),
  );
  const hypothesis = t(
    "Объективные показатели когнитивной работоспособности могут ухудшаться до субъективного осознания снижения концентрации.",
    "Objective cognitive performance may decline before subjective awareness of concentration decline.",
  );
  const [hyp, setHyp] = useState(hypothesis);
  const [tests, setTests] = useState<Experiment["tests"]>([
    "reaction",
    "stroop",
  ]);
  const [points, setPoints] = useState(3);
  const [interval, setIntervalValue] = useState(30);
  const [threshold, setThreshold] = useState(20);
  const [exp, setExp] = useState<Experiment | null>(null);
  const [reportExp, setReportExp] = useState<Experiment | null>(null);
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [phase, setPhase] = useState<
    "lab" | "assessment" | "testing" | "rest" | "done"
  >("lab");
  const [point, setPoint] = useState(0);
  const [index, setIndex] = useState(0);
  const [assessment, setAssessment] = useState(defaultAssessment);
  const [seconds, setSeconds] = useState(0);
  const [consent, setConsent] = useState(false);
  const [minor, setMinor] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Attempt[] | null>(null);
  useEffect(() => {
    if (phase !== "rest") return;
    const timer = setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase]);
  const create = async () => {
    if (!tests.length) return;
    const e: Experiment = {
      id: crypto.randomUUID(),
      name,
      hypothesis: hyp,
      tests,
      points,
      interval,
      threshold,
      createdAt: new Date().toISOString(),
    };
    await update((d) => ({ ...d, experiments: [...d.experiments, e] }));
    setExp(e);
    setPhase("assessment");
  };
  const begin = async () => {
    if (!consent || (minor && !guardian)) return;
    let s = session;
    if (!s)
      s = {
        id: crypto.randomUUID(),
        participantId: crypto.randomUUID(),
        experimentId: exp!.id,
        startedAt: new Date().toISOString(),
        status: "active",
        assessments: [],
      };
    s = {
      ...s,
      assessments: [
        ...s.assessments,
        { at: new Date().toISOString(), point, values: assessment },
      ],
    };
    await update((d) => ({
      ...d,
      participants: [
        ...d.participants.filter((p) => p.id !== s!.participantId),
        { id: s!.participantId, consent, guardianConsent: minor && guardian },
      ],
      sessions: [...d.sessions.filter((x) => x.id !== s!.id), s!],
    }));
    setSession(s);
    if (point === exp!.points) {
      const done = {
        ...s,
        status: "completed" as const,
        completedAt: new Date().toISOString(),
      };
      await update((d) => ({
        ...d,
        sessions: [...d.sessions.filter((x) => x.id !== done.id), done],
      }));
      setSession(done);
      setPhase("done");
    } else {
      setIndex(0);
      setPhase("testing");
    }
  };
  const complete = async (attempts: Attempt[]) => {
    const r: Result = {
      id: crypto.randomUUID(),
      participantId: session!.participantId,
      sessionId: session!.id,
      test: exp!.tests[index],
      timestamp: new Date().toISOString(),
      algorithmVersion: VERSION,
      device: deviceId(),
      attempts,
      assessment,
      point: point + 1,
    };
    try {
      await update((d) => ({ ...d, results: [...d.results, r] }));
      setError("");
      setPending(null);
      if (index + 1 < exp!.tests.length) setIndex(index + 1);
      else {
        setPoint(point + 1);
        setPhase("assessment");
        setAssessment({ ...assessment });
      }
    } catch {
      setPending(attempts);
      setError(
        t(
          "Ошибка сохранения. Сессия остаётся открытой.",
          "Save failed. The session remains open.",
        ),
      );
    }
  };
  const stop = async () => {
    if (session) {
      const s = {
        ...session,
        status: "stopped" as const,
        completedAt: new Date().toISOString(),
      };
      await update((d) => ({
        ...d,
        sessions: [...d.sessions.filter((x) => x.id !== s.id), s],
      }));
      setSession(s);
      setPhase("done");
    } else setPhase("lab");
  };
  const submitAssessment = async () => {
    if (point > 0 && point < exp!.points) {
      const s = {
        ...session!,
        assessments: [
          ...session!.assessments,
          { at: new Date().toISOString(), point, values: assessment },
        ],
      };
      await update((d) => ({
        ...d,
        sessions: [...d.sessions.filter((x) => x.id !== s.id), s],
      }));
      setSession(s);
      setSeconds(exp!.interval);
      setPhase("rest");
    } else await begin();
  };
  const series = session
    ? data.results.filter((r) => r.sessionId === session.id)
    : [];
  const inference = () => {
    if (!exp || !session) return t("Нет данных", "No data");
    const order = researchOrder(exp, session, series);
    if (order.status === "insufficient")
      return t(
        "Недостаточно временных точек для сравнения.",
        "Insufficient time points for comparison.",
      );
    if (order.status === "undetermined")
      return t(
        "Порядок изменений не установлен: один или оба критерия не достигнуты. Это не означает отсутствия изменений.",
        "Change order is undetermined: one or both criteria were not reached. This does not imply absence of change.",
      );
    return order.status === "earlier"
      ? t(
          "В этом протоколе объективное изменение обнаружено раньше субъективного (+2 балла). Это предварительное наблюдение, требующее повторения.",
          "In this protocol, objective change preceded a subjective increase of 2 points. This preliminary observation requires replication.",
        )
      : t(
          "Объективное изменение не предшествовало субъективному по выбранным критериям.",
          "Objective change did not precede subjective change under the selected criteria.",
        );
  };
  if (phase === "testing")
    return (
      <>
        <div className="notice">
          {t("Точка", "Point")} {point + 1}/{exp!.points} · {t("Тест", "Test")}{" "}
          {index + 1}/{exp!.tests.length}
        </div>
        <TestRunner
          key={`${point}-${index}`}
          kind={exp!.tests[index]}
          onComplete={complete}
          onStop={() => {
            void stop().catch(() => {});
          }}
        />
        {error && <p role="alert">{error}</p>}
        {pending && (
          <button className="button primary" onClick={() => complete(pending)}>
            {t("Повторить сохранение", "Retry saving")}
          </button>
        )}
      </>
    );
  if (phase === "rest")
    return (
      <section className="card rest">
        <span className="eyebrow">{t("ПЕРЕРЫВ", "BREAK")}</span>
        <h1>{t("Дайте себе время", "Take a moment")}</h1>
        <strong className="countdown">{seconds}s</strong>
        <p>
          {t(
            "Посмотрите вдаль. Отдохните. Продолжайте только если чувствуете себя комфортно.",
            "Look away from the screen. Rest. Continue only if you feel comfortable.",
          )}
        </p>
        <div className="actions">
          <button
            className="button primary"
            disabled={seconds > 0}
            onClick={() => {
              setIndex(0);
              setPhase("testing");
            }}
          >
            {t("Следующая серия", "Next series")}
          </button>
          <button
            className="button"
            onClick={() => {
              void stop().catch(() => {});
            }}
          >
            {t("Завершить сейчас", "Finish now")}
          </button>
        </div>
      </section>
    );
  if (phase === "assessment")
    return (
      <section className="card assessment">
        <span className="eyebrow">
          {t("САМООЦЕНКА", "SELF-ASSESSMENT")} ·{" "}
          {point === 0
            ? t("ДО НАЧАЛА", "BEFORE START")
            : t("ПОСЛЕ СЕРИИ", "AFTER SERIES")}{" "}
          {point || ""}
        </span>
        <h1>{t("Как вы себя чувствуете?", "How do you feel?")}</h1>
        <p>
          {t(
            "Ответы субъективны — правильных и неправильных нет.",
            "These ratings are subjective; there are no right or wrong answers.",
          )}
        </p>
        {(["fatigue", "concentration", "motivation"] as const).map((k, i) => (
          <label className="range-label" key={k}>
            {
              [
                t("Ощущение усталости", "Fatigue"),
                t("Ощущение снижения концентрации", "Concentration decline"),
                t("Мотивация", "Motivation"),
              ][i]
            }
            <strong>{assessment[k]} / 10</strong>
            <input
              type="range"
              min="0"
              max="10"
              value={assessment[k]}
              onChange={(e) =>
                setAssessment({ ...assessment, [k]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        {point === 0 && (
          <>
            <label>
              {t(
                "Сон прошлой ночью, часов (необязательно)",
                "Sleep last night, hours (optional)",
              )}
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={assessment.sleep ?? ""}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    sleep:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              {t(
                "Отвлекающие факторы (необязательно)",
                "Distractions (optional)",
              )}
              <input
                value={assessment.distractions ?? ""}
                onChange={(e) =>
                  setAssessment({ ...assessment, distractions: e.target.value })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t(
                "Я согласен на локальное сохранение обезличенных результатов. Могу остановиться в любой момент.",
                "I consent to local storage of pseudonymous results. I can stop at any time.",
              )}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={minor}
                onChange={(e) => setMinor(e.target.checked)}
              />
              {t("Участник несовершеннолетний", "Participant is a minor")}
            </label>
            {minor && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={guardian}
                  onChange={(e) => setGuardian(e.target.checked)}
                />
                {t(
                  "Получено информированное согласие законного представителя и разрешение школы. Эта отметка не заменяет письменное согласие.",
                  "Informed guardian consent and school permission have been obtained. This checkbox does not replace written consent.",
                )}
              </label>
            )}
          </>
        )}
        <div className="actions">
          <button
            className="button primary"
            disabled={
              !consent ||
              (minor && !guardian) ||
              (assessment.sleep !== undefined &&
                (!Number.isFinite(assessment.sleep) ||
                  assessment.sleep < 0 ||
                  assessment.sleep > 24))
            }
            onClick={() => {
              void submitAssessment().catch(() => {});
            }}
          >
            {point === exp!.points
              ? t("Завершить исследование", "Complete study")
              : point
                ? t("Сохранить и отдохнуть", "Save and rest")
                : t("Начать серию", "Begin series")}
          </button>
          <button
            className="button"
            onClick={() => {
              void stop().catch(() => {});
            }}
          >
            {t("Остановить", "Stop")}
          </button>
        </div>
      </section>
    );
  if (phase === "done")
    return (
      <>
        <div className="page-title">
          <div>
            <span className="eyebrow">RESEARCH SESSION</span>
            <h1>{t("Исследование завершено", "Research session finished")}</h1>
            <p>
              {t("Код участника", "Participant code")}:{" "}
              {session?.participantId.slice(0, 8)}
            </p>
          </div>
        </div>
        <section className="card">
          <h2>{t("Объективное vs субъективное", "Objective vs subjective")}</h2>
          <p>{inference()}</p>
          {session && exp && (
            <ResearchChart
              session={session}
              results={series.filter((r) => r.test === exp.tests[0])}
            />
          )}
          <p className="footnote">
            {t(
              "Здесь первая точка служит только внутрисессионной опорой, а не устойчивым baseline из трёх сессий. Основной тест и пороги заданы до начала.",
              "The first point is a within-session reference, not a stable three-session baseline. The primary test and thresholds were set before starting.",
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Точка", "Point")}</th>
                  <th>{t("Усталость", "Fatigue")}</th>
                  <th>{t("Концентрация", "Concentration decline")}</th>
                  <th>{t("Мотивация", "Motivation")}</th>
                </tr>
              </thead>
              <tbody>
                {session?.assessments.map((a, i) => (
                  <tr key={i}>
                    <td>{a.point}</td>
                    <td>{a.values.fatigue}</td>
                    <td>{a.values.concentration}</td>
                    <td>{a.values.motivation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <Report
            results={series}
            title={exp?.name}
            experiment={exp ?? undefined}
          />
        </section>
        <button
          className="button primary"
          onClick={() => {
            setSession(null);
            setPoint(0);
            setPhase("lab");
          }}
        >
          {t("В Research Lab", "Back to Research Lab")}
        </button>
      </>
    );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">RESEARCH LAB</span>
          <h1>{t("От вопроса к исследованию", "From question to research")}</h1>
          <p>
            {t(
              "Короткие протоколы. Прозрачные критерии. Реальные наблюдения.",
              "Short protocols. Transparent criteria. Real observations.",
            )}
          </p>
        </div>
      </div>
      <div className="research-grid">
        <section className="card">
          <h2>{t("Новый эксперимент", "New experiment")}</h2>
          <label>
            {t("Название", "Name")}
            <input
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t("Гипотеза", "Hypothesis")}
            <textarea value={hyp} onChange={(e) => setHyp(e.target.value)} />
          </label>
          <label>
            {t(
              "Тесты (первый выбранный — основной)",
              "Tests (first selected is primary)",
            )}
          </label>
          {testKinds.map((k) => (
            <label className="check" key={k}>
              <input
                type="checkbox"
                checked={tests.includes(k)}
                onChange={(e) =>
                  setTests(
                    e.target.checked
                      ? [...tests, k]
                      : tests.filter((x) => x !== k),
                  )
                }
              />
              {names[k][lang === "ru" ? 0 : 1]}
            </label>
          ))}
          <div className="form-grid">
            <label>
              {t("Временные точки", "Time points")}
              <input
                type="number"
                min="2"
                max="5"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </label>
            <label>
              {t("Перерыв, секунд", "Break, seconds")}
              <input
                type="number"
                min="10"
                max="300"
                value={interval}
                onChange={(e) => setIntervalValue(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            {t(
              "Критерий роста времени реакции, %",
              "Reaction time increase criterion, %",
            )}
            <input
              type="number"
              min="5"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <button
            className="button primary"
            disabled={
              !name.trim() ||
              !hyp.trim() ||
              !tests.length ||
              !Number.isInteger(points) ||
              points < 2 ||
              points > 5 ||
              interval < 10 ||
              interval > 300 ||
              threshold < 5 ||
              threshold > 100
            }
            onClick={() => {
              void create().catch(() => {});
            }}
          >
            {t("Создать и начать", "Create and start")}
          </button>
        </section>
        <section className="card insight">
          <span className="eyebrow">
            {t("ШКОЛЬНЫЙ ПРОТОКОЛ", "SCHOOL PROTOCOL")}
          </span>
          <h2>
            {t(
              "Безопасность и воспроизводимость",
              "Safety and reproducibility",
            )}
          </h2>
          <p>{hypothesis}</p>
          <h3>{t("Переменные", "Variables")}</h3>
          <p>
            {t(
              "Независимая: этап тестирования. Зависимые: время реакции, точность, ошибки, вариабельность. Дополнительная: субъективная усталость.",
              "Independent: testing stage. Dependent: latency, accuracy, errors, variability. Additional: subjective fatigue.",
            )}
          </p>
          <div className="notice">
            {t(
              "Не ограничивайте сон и не вынуждайте участников работать без отдыха. При дискомфорте завершите сессию.",
              "Do not restrict sleep or require work without rest. Stop if discomfort occurs.",
            )}
          </div>
          <p>
            {t(
              "Смешивающие факторы: устройство, обучение, мотивация, сон, отвлечения. Порог снижения точности: 10 п.п.; субъективного изменения: +2 балла. Критерии исследовательские, не медицинские.",
              "Confounders: device, practice, motivation, sleep, distractions. Accuracy decline threshold: 10 pp; subjective change: +2 points. Criteria are exploratory, not medical.",
            )}
          </p>
        </section>
      </div>
      <section className="card">
        <h2>{t("Сохранённые эксперименты", "Saved experiments")}</h2>
        {!data.experiments.length ? (
          <p className="muted">
            {t(
              "Создайте первый эксперимент с помощью формы выше.",
              "Create your first experiment using the form above.",
            )}
          </p>
        ) : (
          data.experiments.map((e) => (
            <div className="saved-experiment" key={e.id}>
              <div>
                <h3>{e.name}</h3>
                <p>
                  {e.tests.length} {t("тестов", "tests")} · {e.points}{" "}
                  {t("точки", "points")} ·{" "}
                  {data.sessions.filter((s) => s.experimentId === e.id).length}{" "}
                  {t("сессий", "sessions")}
                </p>
              </div>
              <button
                className="button"
                onClick={() => {
                  setExp(e);
                  setSession(null);
                  setPoint(0);
                  setPhase("assessment");
                }}
              >
                {t("Новый участник", "New participant")}
              </button>
              <button className="button ghost" onClick={() => setReportExp(e)}>
                {t("Результаты", "Results")}
              </button>
              <button
                className="button ghost"
                onClick={() =>
                  download(
                    `premind-${e.id}.csv`,
                    csv({
                      ...data,
                      results: data.results.filter((r) =>
                        data.sessions.some(
                          (s) =>
                            s.experimentId === e.id && s.id === r.sessionId,
                        ),
                      ),
                    }),
                    "text/csv",
                  )
                }
              >
                {t("Экспорт", "Export")}
              </button>
            </div>
          ))
        )}
        <p className="footnote">
          {t(
            "Незавершённые сессии сохраняются в базе и доступны в экспорте; после перезагрузки начните новую сессию, чтобы не смешивать протоколы.",
            "Incomplete sessions persist in storage and exports; after a reload, start a new session to avoid mixing protocols.",
          )}
        </p>
      </section>
      <section className="card">
        <Report
          results={
            reportExp
              ? data.results.filter((r) =>
                  data.sessions.some(
                    (s) =>
                      s.experimentId === reportExp.id && s.id === r.sessionId,
                  ),
                )
              : data.results
          }
          title={reportExp?.name}
          experiment={reportExp ?? undefined}
        />
        {reportExp && (
          <button className="button ghost" onClick={() => setReportExp(null)}>
            {t("Все эксперименты", "All experiments")}
          </button>
        )}
      </section>
    </>
  );
}
