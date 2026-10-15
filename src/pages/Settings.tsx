import { Link } from "react-router-dom";
import { useState } from "react";
import { useApp } from "../components/Context";
import { download, csv, validate, initial } from "../storage/db";
export default function Settings() {
  const { data, t, update } = useApp();
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"history" | "all" | null>(null);
  const [large, setLarge] = useState(
    localStorage.getItem("premind-large") === "true",
  );
  const [reduce, setReduce] = useState(
    localStorage.getItem("premind-reduce") === "true",
  );
  const [backup, setBackup] = useState<ReturnType<typeof validate> | null>(
    null,
  );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">LOCAL FIRST</span>
          <h1>{t("Настройки и данные", "Settings and data")}</h1>
          <p>
            {t(
              "Вы контролируете свои данные. Облако подключается только по вашему согласию.",
              "You control your data. Cloud uploads require your consent.",
            )}
          </p>
        </div>
      </div>
      <section className="card">
        <h2>{t("Google и облачное хранение", "Google and cloud storage")}</h2>
        <p>
          {t(
            "Войдите в аккаунт и переносите результаты между устройствами через облачную копию.",
            "Sign in and transfer results between devices using a cloud backup.",
          )}
        </p>
        <Link to="/account" className="button primary">
          {t("Открыть аккаунт", "Open account")}
        </Link>
      </section>
      <section className="card">
        <h2>{t("Локальный профиль", "Local profile")}</h2>
        <p>
          {t("Код участника", "Participant code")}:{" "}
          <code>{data.participant.id.slice(0, 8)}</code>
        </p>
        <p>
          {data.results.length}{" "}
          {t("сохранённых измерений", "saved measurements")}
        </p>
        <div className="actions">
          <button
            className="button primary"
            onClick={() =>
              download("premind-backup.json", JSON.stringify(data, null, 2))
            }
          >
            {t("Резервная копия JSON", "JSON backup")}
          </button>
          <button
            className="button"
            onClick={() =>
              download("premind.csv", csv(data), "text/csv;charset=utf-8")
            }
          >
            {t("Экспорт CSV", "Export CSV")}
          </button>
          <label className="button file-button">
            {t("Импорт копии", "Import backup")}
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 20 * 1024 * 1024) throw Error();
                  setBackup(validate(JSON.parse(await file.text())));
                  setMessage("");
                } catch {
                  setMessage(
                    t(
                      "Некорректная или слишком большая резервная копия. Данные не изменены.",
                      "Invalid or oversized backup. Data remains unchanged.",
                    ),
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {backup && (
          <div className="notice">
            <p>
              {t(
                "Импорт заменит текущую базу. Сначала сохраните резервную копию.",
                "Import will replace the current database. Save a backup first.",
              )}{" "}
              {backup.results.length} {t("измерений", "measurements")}
            </p>
            <div className="actions">
              <button
                className="button"
                onClick={async () => {
                  try {
                    await update(() => backup);
                    setBackup(null);
                    setMessage(t("Копия восстановлена.", "Backup restored."));
                  } catch {
                    setMessage(t("Ошибка записи.", "Write failed."));
                  }
                }}
              >
                {t("Подтвердить замену", "Confirm replacement")}
              </button>
              <button className="button ghost" onClick={() => setBackup(null)}>
                {t("Отмена", "Cancel")}
              </button>
            </div>
          </div>
        )}
        <p role="status">{message}</p>
      </section>
      <section className="card">
        <h2>{t("Доступность", "Accessibility")}</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={large}
            onChange={(e) => {
              setLarge(e.target.checked);
              localStorage.setItem("premind-large", String(e.target.checked));
              document.documentElement.classList.toggle(
                "large-text",
                e.target.checked,
              );
            }}
          />
          {t("Увеличенный текст", "Larger text")}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={reduce}
            onChange={(e) => {
              setReduce(e.target.checked);
              localStorage.setItem("premind-reduce", String(e.target.checked));
              document.documentElement.classList.toggle(
                "reduce-motion",
                e.target.checked,
              );
            }}
          />
          {t("Уменьшить анимации", "Reduce motion")}
        </label>
        <p>
          {t(
            "Все тесты доступны с клавиатуры. Цветовые стимулы теста Струпа требуют различения цветов; этот тест может быть неподходящим при нарушениях цветового зрения.",
            "All tests support keyboard input. Stroop requires distinguishing colors and may be unsuitable for people with color vision differences.",
          )}
        </p>
      </section>
      <section className="card">
        <h2>{t("Удаление данных", "Delete data")}</h2>
        <div className="actions">
          <button
            className="button danger"
            onClick={() => setConfirm("history")}
          >
            {t("Очистить историю", "Clear history")}
          </button>
          <button className="button danger" onClick={() => setConfirm("all")}>
            {t("Удалить все данные", "Delete all data")}
          </button>
        </div>
        {confirm && (
          <div className="notice">
            <p>
              {t(
                "Удаление нельзя отменить. Сохраните резервную копию перед продолжением.",
                "Deletion cannot be undone. Save a backup before continuing.",
              )}
            </p>
            <div className="actions">
              <button
                className="button danger"
                onClick={async () => {
                  try {
                    await update((d) =>
                      confirm === "all"
                        ? initial()
                        : { ...d, results: [], sessions: [], participants: [] },
                    );
                    setConfirm(null);
                  } catch {
                    setMessage(
                      t("Не удалось удалить данные.", "Could not delete data."),
                    );
                  }
                }}
              >
                {t("Подтвердить удаление", "Confirm deletion")}
              </button>
              <button className="button" onClick={() => setConfirm(null)}>
                {t("Отмена", "Cancel")}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
