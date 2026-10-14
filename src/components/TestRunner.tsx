import { useEffect, useRef, useState } from "react";
import type { Attempt, TestKind } from "../types";
import { useApp, names } from "./Context";
const colors = ["#22C55E", "#3B82F6", "#EF4444", "#F59E0B"];
const colorNames = [
  ["Зелёный", "Green"],
  ["Синий", "Blue"],
  ["Красный", "Red"],
  ["Жёлтый", "Yellow"],
];
const random = (n: number) => Math.floor(Math.random() * n);
export default function TestRunner({
  kind,
  onComplete,
  onStop,
  practice = false,
}: {
  kind: TestKind;
  onComplete: (a: Attempt[]) => void;
  onStop: () => void;
  practice?: boolean;
}) {
  const { t, lang } = useApp();
  const [phase, setPhase] = useState<"intro" | "wait" | "active" | "feedback">(
    "intro",
  );
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stim, setStim] = useState({
    word: 0,
    color: 0,
    go: true,
    digits: "",
    target: 0,
  });
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState(4);
  const [feedback, setFeedback] = useState("");
  const ref = useRef({
    start: 0,
    lock: true,
    phase: "intro",
    stim,
    attempts: [] as Attempt[],
    hidden: false,
  });
  const timers = useRef<number[]>([]);
  const schedule = useRef<boolean[]>([]);
  const frame = useRef<number>(0);
  const input = useRef<HTMLInputElement>(null);
  const trials = practice
    ? 3
    : kind === "attention"
      ? 24
      : kind === "reaction"
        ? 8
        : 12;
  const clear = () => {
    cancelAnimationFrame(frame.current);
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const next = () => {
    clear();
    ref.current.lock = true;
    ref.current.phase = "wait";
    setPhase("wait");
    setAnswer("");
    const s = {
      word: random(4),
      color: random(4),
      go: Math.random() < 0.75,
      digits: Array.from({ length: difficulty }, () => random(10)).join(""),
      target: random(25),
    };
    if (!schedule.current.length) {
      schedule.current = Array.from(
        { length: trials },
        (_, i) =>
          i <
          (kind === "attention"
            ? Math.round(trials * 0.75)
            : Math.ceil(trials / 2)),
      );
      for (let i = schedule.current.length - 1; i > 0; i--) {
        const j = random(i + 1);
        [schedule.current[i], schedule.current[j]] = [
          schedule.current[j],
          schedule.current[i],
        ];
      }
    }
    const condition =
      schedule.current[ref.current.attempts.filter((a) => !a.premature).length];
    if (kind === "attention") s.go = condition;
    if (kind === "stroop")
      s.word = condition ? s.color : (s.color + 1 + random(3)) % 4;
    ref.current.stim = s;
    setStim(s);
    later(
      () => {
        if (ref.current.hidden) return;
        setPhase("active");
        ref.current.phase = "active";
        frame.current = requestAnimationFrame(() => {
          ref.current.start = performance.now();
          ref.current.lock = false;
          if (kind === "attention")
            later(
              () => record(null, s.go ? false : true, s.go ? "go" : "nogo"),
              1000,
            );
          else if (kind === "memory")
            later(
              () => {
                setPhase("feedback");
                ref.current.phase = "feedback";
                ref.current.start = performance.now();
                input.current?.focus();
                later(() => record(null, false, `recall-${difficulty}`), 15000);
              },
              difficulty * 700 + 500,
            );
          else later(() => record(null, false, "omission"), 10000);
        });
      },
      kind === "reaction" ? 1200 + random(2200) : 500,
    );
  };
  const record = (
    rt: number | null,
    correct: boolean,
    condition?: string,
    premature = false,
  ) => {
    if (ref.current.lock && !premature) return;
    ref.current.lock = true;
    clear();
    const a: Attempt = {
      id: crypto.randomUUID(),
      rt,
      correct,
      condition,
      premature,
      index: ref.current.attempts.filter((a) => !a.premature).length,
    };
    const all = [...ref.current.attempts, a];
    ref.current.attempts = all;
    setAttempts(all);
    setFeedback(
      premature
        ? t("Рано. Дождитесь сигнала.", "Too early. Wait for the signal.")
        : correct
          ? t("Верно", "Correct")
          : t("Ошибка или пропуск", "Error or omission"),
    );
    setPhase("feedback");
    ref.current.phase = "feedback";
    later(() => {
      if (all.filter((a) => !a.premature).length >= trials) onComplete(all);
      else next();
    }, 650);
  };
  const respond = (value?: number | string) => {
    const r = ref.current;
    if (kind === "reaction" && r.phase === "wait") {
      record(null, false, "early", true);
      return;
    }
    if (r.lock) return;
    const elapsed = performance.now() - r.start;
    if (kind === "reaction" && r.phase === "active")
      record(elapsed, true, "signal");
    if (kind === "attention" && r.phase === "active")
      record(elapsed, r.stim.go, r.stim.go ? "go" : "nogo");
    if (kind === "stroop" && r.phase === "active" && typeof value === "number")
      record(
        elapsed,
        value === r.stim.color,
        r.stim.word === r.stim.color ? "congruent" : "conflict",
      );
    if (kind === "search" && r.phase === "active" && typeof value === "number")
      record(elapsed, value === r.stim.target, "search");
    if (
      kind === "memory" &&
      r.phase === "feedback" &&
      typeof value === "string"
    )
      record(
        elapsed,
        value === r.stim.digits,
        `recall-${r.stim.digits.length}`,
      );
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (kind === "reaction" || kind === "attention") &&
        e.code === "Space" &&
        !e.repeat
      ) {
        e.preventDefault();
        respond();
      }
      if (kind === "stroop" && ["1", "2", "3", "4"].includes(e.key))
        respond(Number(e.key) - 1);
    };
    const visibility = () => {
      if (document.hidden) {
        ref.current.hidden = true;
        clear();
        ref.current.lock = true;
        ref.current.phase = "intro";
        setPhase("intro");
        setFeedback(
          t(
            "Измерение прервано: вкладка была скрыта. Продолжите в активной вкладке.",
            "Measurement interrupted: the tab was hidden. Continue in the active tab.",
          ),
        );
      } else ref.current.hidden = false;
    };
    document.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clear();
      document.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [kind]);
  const instructions = {
    reaction: t(
      "Дождитесь бирюзового сигнала и нажмите на поле или Пробел. Ранние нажатия учитываются отдельно.",
      "Wait for the cyan signal, then click the field or press Space. Early responses are recorded separately.",
    ),
    stroop: t(
      "Выберите цвет текста, игнорируя значение слова. Клавиши 1–4.",
      "Choose the ink color, ignoring the word. Keys 1–4.",
    ),
    attention: t(
      "Нажимайте поле или Пробел при ○. Не реагируйте на ×. Каждый сигнал длится одну секунду.",
      "Click the field or press Space for ○. Do not respond to ×. Each signal lasts one second.",
    ),
    memory: t(
      "Запомните последовательность цифр, затем введите её в том же порядке.",
      "Remember the digits, then enter them in the same order.",
    ),
    search: t(
      "Найдите символ Q среди O. Используйте мышь, касание или Tab и Enter.",
      "Find Q among O. Use mouse, touch or Tab and Enter.",
    ),
  };
  return (
    <section className="card test-runner">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {practice
              ? t("ОБУЧЕНИЕ", "PRACTICE")
              : t("ИЗМЕРЕНИЕ", "MEASUREMENT")}
          </span>
          <h2>{names[kind][lang === "ru" ? 0 : 1]}</h2>
        </div>
        <button className="button ghost" onClick={onStop}>
          {t("Остановить", "Stop")}
        </button>
      </div>
      <p>{instructions[kind]}</p>
      <div className="progress">
        <div
          style={{
            width: `${(attempts.filter((a) => !a.premature).length / trials) * 100}%`,
          }}
        />
      </div>
      <p className="muted">
        {attempts.filter((a) => !a.premature).length} / {trials}
      </p>
      {phase === "intro" ? (
        <div className="test-stage">
          <p>{feedback}</p>
          {kind === "memory" && (
            <label>
              {t("Количество цифр", "Digit count")}
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
              >
                {[3, 4, 5, 6, 7].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
          <button className="button primary" onClick={next}>
            {t("Начать", "Start")}
          </button>
        </div>
      ) : kind === "reaction" || kind === "attention" ? (
        <button
          className={`test-stage stimulus ${phase === "active" ? "signal" : ""}`}
          onClick={() => respond()}
        >
          {phase === "wait"
            ? t("Ждите…", "Wait…")
            : phase === "active"
              ? kind === "attention"
                ? stim.go
                  ? "○"
                  : "×"
                : t("Нажмите!", "Respond!")
              : feedback}
        </button>
      ) : (
        <div className="test-stage">
          {phase === "wait" ? (
            t("Приготовьтесь…", "Get ready…")
          ) : kind === "stroop" && phase === "active" ? (
            <>
              <strong className="word" style={{ color: colors[stim.color] }}>
                {colorNames[stim.word][lang === "ru" ? 0 : 1]}
              </strong>
              <div className="color-options">
                {colors.map((c, i) => (
                  <button className="button" key={c} onClick={() => respond(i)}>
                    {i + 1}. {colorNames[i][lang === "ru" ? 0 : 1]}
                  </button>
                ))}
              </div>
            </>
          ) : kind === "search" && phase === "active" ? (
            <div className="search-grid">
              {Array.from({ length: 25 }, (_, i) => (
                <button key={i} onClick={() => respond(i)}>
                  {i === stim.target ? "Q" : "O"}
                </button>
              ))}
            </div>
          ) : kind === "memory" && phase === "active" ? (
            <strong className="word digits">{stim.digits}</strong>
          ) : kind === "memory" && phase === "feedback" && !ref.current.lock ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                respond(answer);
              }}
            >
              <label>
                {t("Введите последовательность", "Enter the sequence")}
                <input
                  ref={input}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="off"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button className="button primary">
                {t("Ответить", "Submit")}
              </button>
            </form>
          ) : (
            feedback
          )}
        </div>
      )}
      <p className="footnote">
        {t(
          "Время измеряется в браузере. Задержки устройства и экрана влияют на результат. При переключении вкладки попытка отменяется.",
          "Browser timing is affected by device and display latency. Switching tabs cancels the current trial.",
        )}
      </p>
    </section>
  );
}
