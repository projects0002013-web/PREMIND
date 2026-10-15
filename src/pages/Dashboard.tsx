import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Target,
  Focus,
  Layers,
  FlaskConical,
  Clock3,
} from "lucide-react";
import { useState } from "react";
import { useApp, names } from "../components/Context";
import { metrics, change } from "../algorithms/metrics";
import Charts from "../components/Charts";
export default function Dashboard() {
  const { t, data, lang } = useApp();
  const [days, setDays] = useState(0);
  const latest = data.results.at(-1);
  const reaction = [...data.results]
    .reverse()
    .find((r) => r.test === "reaction");
  const attention = [...data.results]
    .reverse()
    .find((r) => r.test === "attention");
  const m = latest ? metrics(latest.attempts) : null;
  const delta = latest ? change(latest, data.results) : null;
  const cards = [
    {
      label: t("Время реакции", "Reaction time"),
      value:
        reaction && metrics(reaction.attempts).timedCount
          ? `${metrics(reaction.attempts).mean.toFixed(0)} ms`
          : "—",
      icon: Activity,
      sub: t("Последний тест реакции", "Latest reaction test"),
    },
    {
      label: t("Точность ответов", "Response accuracy"),
      value: m ? `${m.accuracy.toFixed(1)}%` : "—",
      icon: Target,
      sub: latest
        ? names[latest.test][lang === "ru" ? 0 : 1]
        : t("Пока нет измерений", "No measurements yet"),
    },
    {
      label: t("Устойчивость внимания", "Attention stability"),
      value: attention
        ? `${metrics(attention.attempts).accuracy.toFixed(1)}%`
        : "—",
      icon: Focus,
      sub: t("Точность Go/No-Go", "Go/No-Go accuracy"),
    },
    {
      label: t("Завершённые сессии", "Completed sessions"),
      value: new Set(data.results.map((r) => r.sessionId)).size,
      icon: Layers,
      sub: t("Ваш исследовательский путь", "Your research journey"),
    },
  ];
  const filtered = data.results.filter(
    (r) =>
      r.test === "reaction" &&
      (!days || Date.now() - Date.parse(r.timestamp) < days * 86400000),
  );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {t("ВАШЕ КОГНИТИВНОЕ ПРОСТРАНСТВО", "YOUR COGNITIVE WORKSPACE")}
          </span>
          <h1>
            {t("Добро пожаловать в", "Welcome to")} <span>PREMIND</span>
          </h1>
          <p>
            {t(
              "Исследуйте изменения внимания и когнитивной работоспособности.",
              "Explore changes in attention and cognitive performance.",
            )}
          </p>
        </div>
        <span className="badge">
          <span className="status-dot" />
          {t("Локальный режим", "Local mode")}
        </span>
      </div>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">COGNITIVE PERFORMANCE INTELLIGENCE</span>
          <h2>
            {t("Заметьте изменение.", "Notice the change.")}
            <br />
            <span>{t("Поймите свой ритм.", "Understand your rhythm.")}</span>
          </h2>
          <p>
            {t(
              "Короткие когнитивные тесты. Личный базовый уровень. Научный подход к вашим результатам.",
              "Short cognitive tests. A personal baseline. A scientific approach to your results.",
            )}
          </p>
          <Link className="button primary" to="/research">
            {t("Начать исследование", "Start research")}
            <ArrowUpRight size={18} />
          </Link>
          <span className="hero-note">
            {t(
              "Без регистрации · Данные на вашем устройстве",
              "No account needed · Data stays on your device",
            )}
          </span>
        </div>
        <div className="orbital" aria-hidden="true">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <div className="core">
            <Activity size={62} />
          </div>
          <span className="orbit-label l1">ATTENTION</span>
          <span className="orbit-label l2">REACTION</span>
          <span className="orbit-label l3">COGNITION</span>
        </div>
      </section>
      <div className="metric-grid">
        {cards.map((c) => (
          <div className="card metric" key={c.label}>
            <div className="metric-label">
              {c.label}
              <c.icon size={18} />
            </div>
            <strong>{c.value}</strong>
            <span>{c.sub}</span>
          </div>
        ))}
      </div>
      <div className="quality-row">
        <div className="card">
          <span>
            {t(
              "Изменение относительно baseline",
              "Change from personal baseline",
            )}
          </span>
          <strong>
            {delta?.reaction !== null && delta?.reaction !== undefined
              ? `${delta.reaction > 0 ? "+" : ""}${delta.reaction.toFixed(1)}%`
              : t("Пока недостаточно измерений", "More measurements needed")}
          </strong>
        </div>
        <div className="card">
          <span>{t("Достаточность данных", "Data sufficiency")}</span>
          <strong>
            {delta
              ? t(
                  "Описательное сравнение доступно",
                  "Descriptive comparison available",
                )
              : t("Собираем личный baseline", "Establishing your baseline")}
          </strong>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>{t("Динамика показателей", "Performance over time")}</h2>
              <p>
                {t(
                  "Время реакции · среднее и медиана",
                  "Reaction time · mean and median",
                )}
              </p>
            </div>
            <select
              aria-label={t("Период", "Period")}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[
                [1, t("Сегодня", "Today")],
                [7, t("7 дней", "7 days")],
                [30, t("30 дней", "30 days")],
                [0, t("Все сессии", "All sessions")],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <Charts results={filtered} />
          <div className="chart-footer">
            <span className="status-dot" />
            {delta
              ? t(
                  "Изменение относительно baseline доступно в аналитике",
                  "Baseline comparison available in analytics",
                )
              : t(
                  "Для baseline нужны 3 предыдущих измерения одного теста",
                  "Baseline requires 3 prior measurements of the same test",
                )}
          </div>
        </section>
        <section className="card insight">
          <div className="icon-box">
            <FlaskConical size={22} />
          </div>
          <span className="eyebrow">
            {t("НАУЧНЫЙ ПОДХОД", "SCIENCE FIRST")}
          </span>
          <h2>{t("Данные прежде выводов", "Evidence before conclusions")}</h2>
          <p>
            {t(
              "Концентрация меняется. Мы сравниваем вас с вашим личным базовым уровнем, а не с универсальной нормой.",
              "Concentration changes. We compare you with your personal baseline, rather than a universal norm.",
            )}
          </p>
          <div className="notice">
            {t(
              "Недостаточно данных для достоверного прогноза",
              "Insufficient data for a reliable prediction",
            )}
          </div>
          <Link to="/science" className="text-link">
            {t("Как это работает", "How it works")}
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="section-heading">
        <h2>{t("Начните с небольшого шага", "Start with a small step")}</h2>
        <Link to="/testing" className="text-link">
          {t("Все тесты", "All tests")}
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="quick-grid">
        {(["reaction", "attention", "memory"] as const).map((k, i) => (
          <Link to={`/testing?test=${k}`} className="card quick" key={k}>
            <div className="icon-box">
              {i === 0 ? <Activity /> : i === 1 ? <Focus /> : <Layers />}
            </div>
            <div>
              <h3>{names[k][lang === "ru" ? 0 : 1]}</h3>
              <p>
                <Clock3 size={12} /> {t("1–2 минуты", "1–2 minutes")}
              </p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
      <section className="card search-explainer">
        <span className="eyebrow">PREMIND · {t("О ПРОЕКТЕ", "ABOUT THE PROJECT")}</span>
        <h2>{t("Проверка усталости и внимания онлайн", "Explore fatigue and attention online")}</h2>
        <p>{t("PREMIND — бесплатное приложение с тестами скорости реакции, внимания и рабочей памяти. Проходите короткие задания и сравнивайте результаты с вашим личным базовым уровнем. Регистрация для локальных тестов не нужна.", "PREMIND is a free application with reaction time, attention and working memory tests. Complete short tasks and compare results with your personal baseline. Local testing requires no account.")}</p>
        <h3>{t("Как исследовать снижение концентрации?", "How can you explore declining concentration?")}</h3>
        <p>{t("В исследовательской сессии вы оцениваете усталость и концентрацию, выполняете несколько серий тестов и делаете перерывы. Система сопоставляет измерения с самооценкой. Один тест не определяет усталость и не предсказывает её достоверно.", "In a research session you rate fatigue and concentration, complete several test series and take breaks. The application compares measurements with self-ratings. A single test cannot determine or reliably predict fatigue.")}</p>
        <Link to="/science" className="text-link">{t("Научная методика и ограничения", "Methodology and limitations")}<ArrowRight size={16}/></Link>
      </section>
    </>
  );
}
