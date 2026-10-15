import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useApp } from "../components/Context";
import { useCloud } from "../cloud/CloudContext";
import { client, authRedirect } from "../cloud/client";
import {
  readBackup,
  writeBackup,
  removeBackup,
  ConflictError,
  type CloudBackup,
} from "../cloud/backups";
import { download } from "../storage/db";
export default function Account() {
  const { session } = useCloud();
  return <AccountPanel key={session?.user.id ?? "guest"} />;
}
function AccountPanel() {
  const { data, update, t, lang } = useApp();
  const {
    session,
    loading,
    authError,
    configured,
    invalidConfig,
    recovering,
    finishRecovery,
  } = useCloud();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backup, setBackup] = useState<CloudBackup | null>(null);
  const [checked, setChecked] = useState(false);
  const [consent, setConsent] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "upload" | "restore" | "delete" | null
  >(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const ensureAccount = async () => {
    const result = await client!.auth.getUser();
    if (
      result.error ||
      result.data.user?.id !== session?.user.id ||
      !active.current
    )
      throw Error("account-changed");
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      if (active.current) {
        const code = (e as { code?: string }).code;
        setError(
          e instanceof ConflictError
            ? t(
                "Копия изменилась на другом устройстве. Обновите сведения, прежде чем сохранять или удалять.",
                "The backup changed on another device. Refresh its details before saving or deleting.",
              )
            : code === "42P01"
              ? t(
                  "Облачная база ещё не создана. Завершите настройку Supabase по инструкции.",
                  "The cloud database is not created yet. Complete the Supabase setup instructions.",
                )
              : t(
                  "Не удалось выполнить действие. Проверьте интернет, данные входа и настройку облака. Локальные результаты сохранены.",
                  "Action failed. Check connectivity, login details and cloud configuration. Local results are preserved.",
                ),
        );
      }
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const refresh = async () => {
    const next = await readBackup(client!);
    if (active.current) {
      setBackup(next);
      setChecked(true);
    }
  };
  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      if (recovering) {
        const { error } = await client!.auth.updateUser({ password });
        if (error) throw error;
        finishRecovery();
        setPassword("");
        setMessage(t("Пароль обновлён.", "Password updated."));
        return;
      }
      if (mode === "reset") {
        const { error } = await client!.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirect(),
        });
        if (error) throw error;
        setMessage(
          t(
            "Если аккаунт существует, на почту отправлена ссылка для смены пароля.",
            "If the account exists, a password reset link has been sent.",
          ),
        );
        return;
      }
      const { data: auth, error } =
        mode === "signup"
          ? await client!.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: authRedirect() },
            })
          : await client!.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword("");
      if (mode === "signup" && !auth.session)
        setMessage(
          t(
            "Проверьте почту и подтвердите адрес, затем войдите.",
            "Check your email and confirm your address, then sign in.",
          ),
        );
    });
  };
  const confirm = () =>
    run(async () => {
      await ensureAccount();
      if (confirmation === "upload") {
        const saved = await writeBackup(
          client!,
          data,
          backup?.revision ?? null,
        );
        if (active.current) {
          setBackup(saved);
          setChecked(true);
          setMessage(t("Облачная копия сохранена.", "Cloud backup saved."));
        }
      }
      if (confirmation === "restore") {
        // Re-read before replacing local data; never restore an outdated preview.
        const latest = await readBackup(client!);
        await ensureAccount();
        if (!latest || latest.revision !== backup?.revision)
          throw new ConflictError();
        download(
          `premind-before-cloud-restore-${Date.now()}.json`,
          JSON.stringify(data, null, 2),
        );
        await update(() => latest.document);
        if (active.current)
          setMessage(
            t(
              "Облачная копия загружена. Предыдущая локальная база скачана в JSON.",
              "Cloud backup restored. Your previous local database was downloaded as JSON.",
            ),
          );
      }
      if (confirmation === "delete") {
        await removeBackup(client!, backup!.revision);
        if (active.current) {
          setBackup(null);
          setMessage(
            t(
              "Облачная копия удалена. Локальные данные сохранены.",
              "Cloud backup deleted. Local data is preserved.",
            ),
          );
        }
      }
      if (active.current) setConfirmation(null);
    });
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">PREMIND ACCOUNT</span>
          <h1>{t("Аккаунт и облако", "Account and cloud")}</h1>
          <p>
            {t(
              "Входите на разных устройствах и переносите свои исследования.",
              "Sign in on different devices and transfer your research.",
            )}
          </p>
        </div>
        <span className="badge">
          <Cloud size={15} />
          {session
            ? t("Вход выполнен", "Signed in")
            : t("Гостевой режим", "Guest mode")}
        </span>
      </div>
      <div className="research-grid">
        <section className="card account-card">
          <div className="icon-box">
            <LogIn />
          </div>
          <h2>
            {session && !recovering
              ? t("Ваш аккаунт", "Your account")
              : recovering
                ? t("Новый пароль", "New password")
                : t("Добро пожаловать", "Welcome back")}
          </h2>
          {!configured ? (
            <div className="notice">
              {invalidConfig
                ? t(
                    "Параметры подключения некорректны. Нужны URL проекта и публичный ключ Supabase.",
                    "Cloud configuration is invalid. A project URL and public Supabase key are required.",
                  )
                : t(
                    "Облако пока не подключено. Чтобы включить Google и email, владелец сайта должен настроить Supabase. Все тесты доступны без регистрации.",
                    "Cloud is not connected yet. The site owner must configure Supabase to enable Google and email. All tests remain available without registration.",
                  )}
              <details>
                <summary>{t("Как подключить", "How to connect")}</summary>
                <ol>
                  <li>
                    {t(
                      "Создайте проект на supabase.com.",
                      "Create a project at supabase.com.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Выполните SQL из supabase/migrations в SQL Editor.",
                      "Run the SQL from supabase/migrations in SQL Editor.",
                    )}
                  </li>
                  <li>
                    {t(
                      "В настройках сборки укажите VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.",
                      "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your build configuration.",
                    )}
                  </li>
                  <li>
                    {t(
                      "Включите Google в Authentication → Providers и настройте адрес возврата. Подробности — docs/CLOUD_SETUP.md в репозитории.",
                      "Enable Google in Authentication → Providers and configure the redirect URL. See docs/CLOUD_SETUP.md in the repository.",
                    )}
                  </li>
                </ol>
              </details>
            </div>
          ) : loading ? (
            <p role="status">{t("Проверяем вход…", "Checking sign-in…")}</p>
          ) : session && !recovering ? (
            <>
              <p>
                <Mail size={14} />{" "}
                {session.user.email ?? t("Аккаунт Google", "Google account")}
              </p>
              <p className="footnote">
                {t(
                  "Аккаунт предназначен для хранения исследований. Реальные имена участников не добавляются к результатам автоматически.",
                  "Your account stores research. Participant names are not automatically added to results.",
                )}
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const { error } = await client!.auth.signOut({
                      scope: "local",
                    });
                    if (error) throw error;
                  })
                }
              >
                <LogOut size={16} />
                {t("Выйти", "Sign out")}
              </button>
              <p className="footnote">
                {t(
                  "Выход не удаляет локальные результаты с этого устройства. На общем компьютере очистите их в настройках.",
                  "Signing out does not erase local results. On a shared computer, clear them in settings.",
                )}
              </p>
            </>
          ) : (
            <>
              {!recovering && (
                <>
                  <button
                    className="button google-button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const { error } = await client!.auth.signInWithOAuth({
                          provider: "google",
                          options: { redirectTo: authRedirect() },
                        });
                        if (error) throw error;
                      })
                    }
                  >
                    <span className="google-mark" aria-hidden="true">
                      G
                    </span>
                    {t("Продолжить с Google", "Continue with Google")}
                  </button>
                  <div className="auth-divider">
                    {t("или по email", "or use email")}
                  </div>
                  <div className="actions auth-tabs">
                    <button
                      className={`button ${mode === "signin" ? "primary" : "ghost"}`}
                      disabled={busy}
                      onClick={() => {
                        setMode("signin");
                        setMessage("");
                        setError("");
                      }}
                    >
                      {t("Вход", "Sign in")}
                    </button>
                    <button
                      className={`button ${mode === "signup" ? "primary" : "ghost"}`}
                      disabled={busy}
                      onClick={() => {
                        setMode("signup");
                        setMessage("");
                        setError("");
                      }}
                    >
                      {t("Регистрация", "Create account")}
                    </button>
                  </div>
                </>
              )}
              <form
                onSubmit={authenticate}
                aria-label={t("Вход в аккаунт", "Account authentication")}
              >
                {!recovering && (
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                )}
                {(mode !== "reset" || recovering) && (
                  <label>
                    {t("Пароль", "Password")}
                    <input
                      required
                      type="password"
                      autoComplete={
                        mode === "signup" || recovering
                          ? "new-password"
                          : "current-password"
                      }
                      minLength={mode === "signup" || recovering ? 8 : 1}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                )}
                {mode === "signup" && (
                  <p className="footnote">
                    {t(
                      "Минимум 8 символов. Сохранение результатов в облако включается отдельно, с вашего согласия.",
                      "At least 8 characters. Cloud storage of results requires your separate consent.",
                    )}
                  </p>
                )}
                <div className="actions">
                  <button className="button primary" disabled={busy}>
                    {busy
                      ? t("Подождите…", "Please wait…")
                      : recovering
                        ? t("Сохранить пароль", "Save password")
                        : mode === "signup"
                          ? t("Создать аккаунт", "Create account")
                          : mode === "reset"
                            ? t("Отправить ссылку", "Send reset link")
                            : t("Войти по email", "Sign in with email")}
                  </button>
                  {!recovering && (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={busy}
                      onClick={() => {
                        setMode("reset");
                        setMessage("");
                        setError("");
                      }}
                    >
                      {t("Забыли пароль?", "Forgot password?")}
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
          {(authError || error) && (
            <div role="alert" className="notice">
              {error ||
                t(
                  "Не удалось восстановить вход. Попробуйте войти снова.",
                  "Could not restore your session. Try signing in again.",
                )}
            </div>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </section>
        <section className="card">
          <div className="icon-box">
            <ShieldCheck />
          </div>
          <h2>
            {t(
              "Ваши исследования — под контролем",
              "Your research, under your control",
            )}
          </h2>
          <p>
            {t(
              "По умолчанию результаты сохраняются на устройстве. Вход через Google не отправляет их в облако. Только кнопка «Сохранить в облако» загружает текущую базу в ваш аккаунт.",
              "Results are stored on your device by default. Google sign-in does not upload them. Only Save to cloud uploads your current database to your account.",
            )}
          </p>
          <div className="notice">
            {t(
              "Перенос между устройствами выполняется вручную: сохраните копию здесь и загрузите её на другом устройстве. Автоматического объединения данных нет.",
              "Transfer between devices is manual: save a copy here, then restore it on another device. Data is not automatically merged.",
            )}
          </div>
          <p>
            {t(
              "Облачная копия включает тесты, протоколы, самооценки, комментарии и отметки согласия. Не загружайте сведения других участников без разрешения на облачное хранение.",
              "The cloud backup includes tests, protocols, self-ratings, comments and consent records. Obtain permission before uploading other participants’ data.",
            )}
          </p>
          {session && configured && !recovering && (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() => run(refresh)}
              >
                {t("Проверить облачную копию", "Check cloud backup")}
              </button>
              {checked && (
                <>
                  <p>
                    {backup
                      ? `${t("Сохранено", "Saved")}: ${new Date(backup.updated_at).toLocaleString(lang)} · ${backup.document.results.length} ${t("измерений", "measurements")} · v${backup.revision}`
                      : t(
                          "В этом аккаунте ещё нет облачной копии.",
                          "This account has no cloud backup yet.",
                        )}
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      disabled={busy}
                    />
                    {t(
                      "Согласен отправить текущую базу в мой аккаунт Supabase. Получены необходимые разрешения участников.",
                      "I consent to uploading this database to my Supabase account and have the required participant permissions.",
                    )}
                  </label>
                  <div className="actions">
                    <button
                      className="button primary"
                      disabled={busy || !consent}
                      onClick={() => setConfirmation("upload")}
                    >
                      <CloudUpload size={16} />
                      {t("Сохранить в облако", "Save to cloud")}
                    </button>
                    <button
                      className="button"
                      disabled={busy || !backup}
                      onClick={() => setConfirmation("restore")}
                    >
                      <CloudDownload size={16} />
                      {t("Загрузить на устройство", "Restore to device")}
                    </button>
                    <button
                      className="button danger"
                      disabled={busy || !backup}
                      onClick={() => setConfirmation("delete")}
                    >
                      <Trash2 size={16} />
                      {t("Удалить облачную копию", "Delete cloud backup")}
                    </button>
                  </div>
                </>
              )}
              {confirmation && (
                <div
                  className="notice"
                  role="region"
                  aria-label={t(
                    "Подтверждение действия",
                    "Confirm cloud action",
                  )}
                >
                  <p>
                    {confirmation === "upload"
                      ? t(
                          "Текущая база заменит облачную копию этого аккаунта. Другие устройства должны сначала загрузить новую копию.",
                          "Your current database will replace this account’s cloud backup. Other devices should restore the updated copy first.",
                        )
                      : confirmation === "restore"
                        ? t(
                            "Загрузка заменит всю локальную базу. Сначала автоматически скачается JSON с текущими данными.",
                            "Restoring replaces your entire local database. A JSON copy of your current data will be downloaded first.",
                          )
                        : t(
                            "Облачная копия будет удалена без возможности отмены. Локальная база останется на устройстве.",
                            "The cloud backup will be permanently deleted. Your local database will remain on this device.",
                          )}
                  </p>
                  <div className="actions">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={confirm}
                    >
                      {t("Подтвердить", "Confirm")}
                    </button>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => setConfirmation(null)}
                    >
                      {t("Отмена", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
