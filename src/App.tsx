import { useEffect, useRef, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  FlaskConical,
  BarChart3,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ShieldCheck,
  ArrowUpRight,
  BookOpen,
  PanelLeftClose,
} from "lucide-react";
import { motion } from "framer-motion";
import { AppContext } from "./components/Context";
import { load, save } from "./storage/db";
import type { Data } from "./types";
import Dashboard from "./pages/Dashboard";
import Testing from "./pages/Testing";
import Research from "./pages/Research";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Science from "./pages/Science";
function Shell() {
  const [data, setData] = useState<Data | null>(null);
  const current = useRef<Data | null>(null);
  const queue = useRef(Promise.resolve());
  const [error, setError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [lang, setLang] = useState<"ru" | "en">(
    localStorage.getItem("premind-lang") === "en" ? "en" : "ru",
  );
  const [light, setLight] = useState(
    localStorage.getItem("premind-theme") === "light",
  );
  const [welcome, setWelcome] = useState(
    !localStorage.getItem("premind-onboarded"),
  );
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const t = (ru: string, en: string) => (lang === "ru" ? ru : en);
  useEffect(() => {
    load()
      .then((d) => {
        setData(d);
        current.current = d;
      })
      .catch(() =>
        setError(
          "IndexedDB unavailable. Enable browser storage / Разрешите хранение данных в браузере.",
        ),
      );
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle(
      "large-text",
      localStorage.getItem("premind-large") === "true",
    );
    document.documentElement.classList.toggle(
      "reduce-motion",
      localStorage.getItem("premind-reduce") === "true",
    );
    localStorage.setItem("premind-theme", light ? "light" : "dark");
    localStorage.setItem("premind-lang", lang);
  }, [light, lang]);
  useEffect(() => {
    if (!welcome) return;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = document
        .querySelector(".onboarding")
        ?.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex="0"]',
        );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [welcome]);
  const update = (fn: (d: Data) => Data) => {
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        const next = fn(current.current!);
        await save(next);
        current.current = next;
        setData(next);
        setWriteError("");
      })
      .catch((err) => {
        setWriteError(
          t(
            "Не удалось записать данные. Проверьте доступность и свободное место хранилища браузера.",
            "Could not write data. Check browser storage permissions and available space.",
          ),
        );
        throw err;
      });
    queue.current = task;
    return task;
  };
  if (error)
    return (
      <main className="loading" role="alert">
        {error}
        <button className="button" onClick={() => window.location.reload()}>
          {t("Обновите страницу", "Reload the page")}
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="loading">
        <Activity />
        <h1>PREMIND</h1>
        <div className="skeleton" />
        <p>{t("Открываем локальную базу…", "Opening local database…")}</p>
      </main>
    );
  const links = [
    ["/", LayoutDashboard, t("Обзор", "Overview")],
    ["/testing", Activity, t("Тестирование", "Cognitive tests")],
    ["/analytics", BarChart3, t("Аналитика", "Analytics")],
    ["/research", FlaskConical, t("Research Lab", "Research Lab")],
  ] as const;
  return (
    <AppContext.Provider value={{ data, update, lang, t }}>
      <div className={`app ${collapsed ? "collapsed" : ""}`}>
        <aside className="sidebar">
          <Link className="brand" to="/">
            <span className="brand-icon">
              <Activity size={23} />
            </span>
            <strong>
              PREMIND<span>COGNITIVE INTELLIGENCE</span>
            </strong>
          </Link>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {links.map(([path, Icon, label]) => (
              <NavLink
                end={path === "/"}
                to={path}
                key={path}
                aria-label={label}
              >
                <Icon size={19} />
                <span>{label}</span>
                {path === "/research" && <span className="nav-tag">LAB</span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-science">
              <FlaskConical size={20} />
              <h3>{t("Любопытство — начало", "Curiosity is the start")}</h3>
              <p>
                {t(
                  "Каждое измерение помогает лучше понять внимание.",
                  "Every measurement helps us understand attention.",
                )}
              </p>
              <Link to="/science">
                {t("О методике", "Our methodology")}
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <NavLink to="/science">
              <BookOpen size={18} />
              {t("О проекте", "About PREMIND")}
            </NavLink>
            <NavLink to="/privacy">
              <ShieldCheck size={18} />
              {t("Конфиденциальность", "Privacy")}
            </NavLink>
            <NavLink to="/settings">
              <SettingsIcon size={18} />
              {t("Настройки", "Settings")}
            </NavLink>
            <div className="sidebar-version">
              <span className="status-dot" />
              PREMIND v1.0 · LOCAL
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header>
            <div className="breadcrumb">
              <button
                className="icon-button collapse-button"
                aria-label={t("Скрыть навигацию", "Toggle navigation")}
                onClick={() => setCollapsed(!collapsed)}
              >
                <PanelLeftClose size={18} />
              </button>
              <span>Workspace</span>
              <span>/</span>
              <strong>
                {links.find((l) => l[0] === location.pathname)?.[2] ??
                  t("Информация", "Information")}
              </strong>
            </div>
            <div className="header-actions">
              <button
                className="language"
                onClick={() => setLang(lang === "ru" ? "en" : "ru")}
              >
                {lang.toUpperCase()}
              </button>
              <button
                className="icon-button"
                aria-label={t("Переключить тему", "Toggle theme")}
                onClick={() => setLight(!light)}
              >
                {light ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <Link
                className="icon-button"
                aria-label={t("Настройки", "Settings")}
                to="/settings"
              >
                <SettingsIcon size={18} />
              </Link>
              <Link to="/settings" className="profile">
                <span>P</span>
                <div>
                  {t("Участник", "Participant")}
                  <small>#{data.participant.id.slice(0, 6)}</small>
                </div>
              </Link>
            </div>
          </header>
          <motion.main
            key={location.pathname}
            initial={
              document.documentElement.classList.contains("reduce-motion") ||
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? false
                : { opacity: 0, y: 5 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <>
              {writeError && (
                <div role="alert" className="notice">
                  {writeError}
                </div>
              )}
            </>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/testing" element={<Testing />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/research" element={<Research />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/science" element={<Science />} />
              <Route path="/privacy" element={<Science privacy />} />
              <Route
                path="*"
                element={
                  <section className="card">
                    <h1>{t("Страница не найдена", "Page not found")}</h1>
                    <Link to="/">{t("На главную", "Go home")}</Link>
                  </section>
                }
              />
            </Routes>
            <footer>
              <span>PREMIND · Detect the decline before you feel it.</span>
              <span>
                <ShieldCheck size={13} />
                {t(
                  "Данные хранятся только на устройстве",
                  "Your data stays on your device",
                )}
              </span>
            </footer>
          </motion.main>
        </div>
        <nav className="mobile-nav">
          {links.map(([path, Icon, label]) => (
            <NavLink end={path === "/"} to={path} key={path} aria-label={label}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {welcome && (
          <div className="modal-backdrop">
            <section
              className="card onboarding"
              role="dialog"
              aria-modal="true"
              aria-labelledby="welcome-title"
            >
              <div className="icon-box">
                <Activity size={28} />
              </div>
              <span className="eyebrow">WELCOME TO PREMIND</span>
              <h1 id="welcome-title">
                {t(
                  "Познакомьтесь со своим вниманием",
                  "Get to know your attention",
                )}
              </h1>
              <p>
                {t(
                  "Пройдите короткий тест, сохраните результат и наблюдайте за изменениями. Данные остаются на вашем устройстве.",
                  "Take a short test, save the result and track changes. Your data stays on your device.",
                )}
              </p>
              <div className="notice">
                {t(
                  "Это исследовательский инструмент, а не медицинская диагностика. Первые результаты не позволяют надёжно прогнозировать снижение концентрации.",
                  "This is a research tool, not a medical assessment. Initial results cannot reliably predict concentration decline.",
                )}
              </div>
              <button
                autoFocus
                className="button primary"
                onClick={() => {
                  localStorage.setItem("premind-onboarded", "true");
                  setWelcome(false);
                }}
              >
                {t("Открыть PREMIND", "Explore PREMIND")}
                <ArrowUpRight size={18} />
              </button>
            </section>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
