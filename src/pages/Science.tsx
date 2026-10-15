import { useApp } from "../components/Context";
export default function Science({ privacy = false }: { privacy?: boolean }) {
  const { t } = useApp();
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {privacy ? "PRIVACY & CONSENT" : "ABOUT PREMIND"}
          </span>
          <h1>
            {privacy
              ? t("Ваши данные — ваши правила", "Your data, your rules")
              : t("Наука за измерениями", "The science behind measurements")}
          </h1>
          <p>Detect the decline before you feel it.</p>
        </div>
      </div>
      {(privacy
        ? [
            [
              t("Хранение на устройстве", "On-device storage"),
              t(
                "Данные хранятся в IndexedDB вашего браузера. Регистрация необязательна. Аккаунты обслуживаются Supabase Auth; Google используется только для входа. Результаты отправляются в Supabase лишь при явном сохранении облачной копии. Очистка браузера может удалить данные: регулярно экспортируйте резервную копию.",
                "Data is stored in your browser’s IndexedDB. Registration is optional. Supabase Auth manages accounts; Google is used only for sign-in. Results are uploaded to Supabase only when you explicitly save a cloud backup. Clearing browser storage can erase data; export backups regularly.",
              ),
            ],
            [
              t("Согласие и участники", "Consent and participants"),
              t(
                "Для исследования требуется добровольное информированное согласие. Для несовершеннолетних необходимо письменное согласие законного представителя и соблюдение правил школы. Не вводите реальные имена и личные сведения в названия и комментарии.",
                "Research requires voluntary informed consent. Minors need written guardian consent and compliance with school policies. Do not enter real names or personal details in titles or comments.",
              ),
            ],
            [
              t("Экспорт и удаление", "Export and deletion"),
              t(
                "JSON содержит полную базу для восстановления. CSV содержит обезличенные коды и сырые попытки. Вы сами решаете, кому передавать файлы. Локальные данные можно удалить в настройках; облачная копия удаляется отдельно на странице аккаунта. Выход из аккаунта не удаляет локальные данные или облачную копию. Для удаления самого аккаунта обратитесь к владельцу проекта.",
                "JSON contains the complete database for restoration. CSV contains pseudonymous codes and raw trials. You decide whom to share files with. Delete local data in settings and cloud backups separately on the account page. Signing out erases neither local data nor cloud backups. Contact the project owner to delete the account itself.",
              ),
            ],
          ]
        : [
            [
              t("Исследовательский вопрос", "Research question"),
              t(
                "Можно ли обнаружить объективное ухудшение концентрации раньше, чем человек самостоятельно его заметит? PREMIND помогает собирать наблюдения для проверки этой гипотезы, но не предполагает, что она уже доказана.",
                "Can objective concentration decline be detected before a person notices it? PREMIND collects observations to test this hypothesis; it does not assume it is proven.",
              ),
            ],
            [
              t("Методика и baseline", "Methodology and baseline"),
              t(
                "Пять задач измеряют разные аспекты выполнения: реакцию, интерференцию Струпа, Go/No-Go, воспроизведение цифр и визуальный поиск. Первые три предыдущих измерения одного теста на одном устройстве формируют личную опору. Это экспериментальные браузерные задачи, а не валидированные диагностические инструменты.",
                "Five tasks measure response latency, Stroop interference, Go/No-Go, digit recall and visual search. Three prior same-test, same-device measurements form a personal reference. These browser tasks are experimental, not validated diagnostic instruments.",
              ),
            ],
            [
              t("Критерии изменений", "Change criteria"),
              t(
                "По умолчанию: рост времени правильных ответов на 20% или снижение точности на 10 процентных пунктов. Это заранее заданные исследовательские критерии, не медицинские пороги. Ошибки, пропуски и ранние ответы сохраняются отдельно.",
                "Defaults: 20% increase in correct-response latency or 10 percentage point accuracy decline. These are predefined exploratory criteria, not medical thresholds. Errors, omissions and early responses are stored separately.",
              ),
            ],
            [
              t("Ограничения исследования", "Research limitations"),
              t(
                "Результаты зависят от устройства, частоты экрана, моторики, тренировки, сна, мотивации и отвлечений. Сравнивайте одинаковые тесты в одинаковых условиях. Небольшие выборки не подтверждают обобщаемость; корреляция не означает причинность. Нет медицинских диагнозов или гарантированного прогнозирования.",
                "Results depend on device, refresh rate, motor skills, practice, sleep, motivation and distractions. Compare like tests in consistent conditions. Small samples do not establish generalizability; correlation does not establish causation. No diagnoses or guaranteed predictions.",
              ),
            ],
            [
              t("Будущий ML-модуль", "Future ML module"),
              t(
                "Модель пока не обучена. Будущая проверка должна разделять участников между обучением и тестом, использовать только прошлые данные, сравнивать простой baseline и публиковать precision, recall, F1 и ROC-AUC при применимости. Вероятности допустимы только после калибровки на отложенных данных.",
                "No model has been trained. Future validation must split by participant, use only past data, compare a simple baseline and publish precision, recall, F1 and ROC-AUC where applicable. Probabilities require calibration on held-out data.",
              ),
            ],
          ]
      ).map(([title, text]) => (
        <section className="card prose" key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
    </>
  );
}
