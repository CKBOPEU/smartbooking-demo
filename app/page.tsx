"use client";
import { useEffect, useRef, useState } from "react";
import {
  addDays,
  cancelBooking,
  completeBooking,
  createBooking,
  dateKey,
  endsAt,
  minutes,
  monday,
  parseDay,
  serviceFor,
  services,
  slots,
  startsAt,
  updateBooking,
  type Booking,
  type Draft,
  type Language,
  type ServiceId,
} from "../lib/booking";
import {
  LANG_KEY,
  STORAGE_KEY,
  mutateBookings,
  readBookings,
} from "../lib/storage";

export default function Home() {
  const [lang, setLang] = useState<Language>("en"),
    [bookings, setBookings] = useState<Booking[]>([]),
    [ready, setReady] = useState(false),
    [now, setNow] = useState(0),
    [day, setDay] = useState(""),
    [view, setView] = useState(0),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [confirm, setConfirm] = useState(false),
    [draft, setDraft] = useState<Draft>({
      name: "",
      email: "",
      date: "",
      time: "",
      service: "discovery",
      notes: "",
    });
  const dialog = useRef<HTMLDialogElement>(null);
  const t = (en: string, ru: string) => (lang === "en" ? en : ru);
  const serviceName = (id: ServiceId) =>
    id === "discovery"
      ? t("Discovery call", "Знакомство")
      : id === "review"
        ? t("Design review", "Разбор дизайна")
        : t("Strategy workshop", "Стратегическая сессия");
  const statusName = (status: string) =>
    status === "confirmed"
      ? t("Confirmed", "Подтверждена")
      : status === "completed"
        ? t("Completed", "Завершена")
        : t("Cancelled", "Отменена");
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ru-RU", {
      ...options,
      timeZone: "UTC",
    }).format(parseDay(date));
  const errorText = (error: unknown) => {
    const code = error instanceof Error ? error.message : "";
    return (
      (
        {
          name: t(
            "Enter a name (2–80 characters).",
            "Введите имя (2–80 символов).",
          ),
          email: t("Enter a valid email.", "Введите корректный email."),
          past: t("Choose a future time.", "Выберите время в будущем."),
          closed: t(
            "The studio is closed on Sundays.",
            "В воскресенье студия закрыта.",
          ),
          conflict: t(
            "This time was just booked. Choose another slot.",
            "Это время уже занято. Выберите другое.",
          ),
          time: t("Choose an available time.", "Выберите доступное время."),
          locked: t(
            "This booking can no longer be changed.",
            "Эту запись уже нельзя изменить.",
          ),
          corrupt: t(
            "Stored data is invalid. It has been preserved; booking changes are unavailable.",
            "Сохранённые данные повреждены. Они сохранены без изменений; редактирование недоступно.",
          ),
          storage: t(
            "Browser storage is unavailable. Changes were not saved.",
            "Хранилище браузера недоступно. Изменения не сохранены.",
          ),
        } as Record<string, string>
      )[code] ||
      t(
        "Could not save. Check your data and browser storage.",
        "Не удалось сохранить. Проверьте данные и хранилище браузера.",
      )
    );
  };
  useEffect(() => {
    setNow(Date.now());
    setDay(dateKey(new Date()));
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "ru") setLang("ru");
    } catch {}
    mutateBookings((b) => b)
      .then(setBookings)
      .catch((e) => setFailure(e.message))
      .finally(() => setReady(true));
    const update = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null)
        try {
          setBookings(readBookings());
          setFailure("");
        } catch (e) {
          setFailure(e instanceof Error ? e.message : "storage");
        }
    };
    window.addEventListener("storage", update);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.removeEventListener("storage", update);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    if (ready)
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch {}
  }, [lang, ready]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  const today = now ? dateKey(new Date(now)) : "";
  const week = day ? monday(day) : "";
  const days = week
    ? Array.from({ length: 7 }, (_, i) => addDays(week, i))
    : [];
  const selected = bookings.find((b) => b.id === editing);
  const editable =
    !selected || (selected.status === "confirmed" && startsAt(selected) > now);
  const available = draft.date
    ? slots(draft.date, draft.service, bookings, editing || undefined, now)
    : [];
  function open(
    id?: string,
    date = day,
    time?: string,
    service: ServiceId = "discovery",
  ) {
    setNotice("");
    setConfirm(false);
    setEditing(id || null);
    const found = bookings.find((b) => b.id === id);
    if (found) setDraft({ ...found });
    else {
      let target = date < today ? today : date;
      let choices = slots(target, service, bookings, undefined, Date.now());
      for (let i = 0; !choices.length && i < 14; i++) {
        target = addDays(target, 1);
        choices = slots(target, service, bookings, undefined, Date.now());
      }
      setDraft({
        name: "",
        email: "",
        notes: "",
        date: target,
        service,
        time: time && choices.includes(time) ? time : choices[0] || "",
      });
    }
    setModal(true);
  }
  async function save(change: (b: Booking[]) => Booking[]) {
    setBusy(true);
    try {
      setBookings(await mutateBookings(change));
      setModal(false);
      setNotice(
        t(
          "Your changes are saved in this browser.",
          "Изменения сохранены в этом браузере.",
        ),
      );
      setFailure("");
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const weekly = bookings.filter((b) => days.includes(b.date));
  const active = weekly.filter((b) => b.status !== "cancelled");
  const agenda = bookings
    .filter((b) => b.date === day && b.status !== "cancelled")
    .sort((a, b) => a.time.localeCompare(b.time));
  const filtered = bookings
    .filter(
      (b) =>
        (filter === "all" || b.status === filter) &&
        `${b.name} ${b.email}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const clients = Array.from(new Set(bookings.map((b) => b.email))).map(
    (email) => ({
      email,
      name: bookings.find((b) => b.email === email)!.name,
      count: bookings.filter(
        (b) => b.email === email && b.status !== "cancelled",
      ).length,
    }),
  );
  if (!ready)
    return (
      <main className="loading">
        <span className="logo">▦</span>
        <h1>SmartBooking</h1>
        <p>Loading workspace / Загрузка…</p>
      </main>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setView(0)}>
          <span className="logo">▦</span>SmartBooking
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="avatar">S</span>
          <div>
            <strong>{t("Studio workspace", "Кабинет студии")}</strong>
            <small>{t("Personal demo", "Учебный проект")}</small>
          </div>
          <span>⌄</span>
        </div>
        <p className="eyebrow">{t("WORKSPACE", "РАБОЧЕЕ МЕСТО")}</p>
        <nav>
          {[
            t("Calendar", "Календарь"),
            t("Bookings", "Записи"),
            t("Clients", "Клиенты"),
            t("Services", "Услуги"),
          ].map((label, i) => (
            <button
              className={view === i ? "nav active" : "nav"}
              key={i}
              onClick={() => {
                setView(i);
                setQuery("");
                setFilter("all");
              }}
            >
              <span aria-hidden="true">{["▦", "☷", "♧", "◇"][i]}</span>
              {label}
              {i === 1 && <small>{bookings.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          {t(
            "A little space to do great work.",
            "Больше времени для хорошей работы.",
          )}
          <p>
            {t("Monday – Saturday", "Понедельник — суббота")}
            <br />
            09:00 – 18:00 · UTC
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="languages" aria-label="Language / Язык">
            {(["en", "ru"] as const).map((l) => (
              <button
                key={l}
                className={lang === l ? "chosen" : ""}
                onClick={() => {
                  setLang(l);
                  setNotice("");
                }}
                aria-pressed={lang === l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <small>
            {t(
              "Local demo · no account needed",
              "Локальное демо · без регистрации",
            )}
          </small>
        </div>
      </aside>
      <main className="main">
        <div className="topline">
          <span>
            {t("Workspace", "Кабинет")} <span className="slash">/</span>{" "}
            {
              [
                t("Calendar", "Календарь"),
                t("Bookings", "Записи"),
                t("Clients", "Клиенты"),
                t("Services", "Услуги"),
              ][view]
            }
          </span>
          <span className="demo-pill">
            <span className="live-dot" />
            {t("Portfolio demo", "Демо для портфолио")}
          </span>
        </div>
        <header>
          <div>
            <p className="eyebrow">
              {t("MAKE ROOM FOR WHAT MATTERS", "ВРЕМЯ ДЛЯ ГЛАВНОГО")}
            </p>
            <h1>
              {
                [
                  t("Your week, in focus.", "Ваша неделя — на виду."),
                  t(
                    "Every booking, in one place.",
                    "Все записи в одном месте.",
                  ),
                  t(
                    "Good work starts with people.",
                    "Хорошая работа начинается с людей.",
                  ),
                  t("Your time. Your expertise.", "Ваше время. Ваш опыт."),
                ][view]
              }
            </h1>
            <p className="muted">
              {t(
                "A calmer way to keep your studio moving.",
                "Удобный ритм работы вашей студии.",
              )}
            </p>
          </div>
          <button
            className="primary"
            onClick={() => open()}
            disabled={!!failure}
          >
            ＋ {t("New booking", "Новая запись")}
          </button>
        </header>
        <div className="demo-note">
          {t(
            "Fictional clients & sample prices. Data stays in this browser. All times are UTC.",
            "Вымышленные клиенты и примерные цены. Данные хранятся в этом браузере. Всё время — UTC.",
          )}
        </div>
        {failure && (
          <p role="alert" className="error">
            {errorText(new Error(failure))}
          </p>
        )}
        {notice && !modal && (
          <p role="status" className="notice">
            {notice}
            <button
              aria-label={t("Dismiss", "Закрыть")}
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </p>
        )}
        {view === 0 && (
          <>
            <section className="stats">
              <div>
                <span>{t("Bookings this week", "Записей за неделю")}</span>
                <strong>{active.length.toString().padStart(2, "0")}</strong>
                <small>{t("Excluding cancellations", "Без отменённых")}</small>
              </div>
              <div>
                <span>{t("Time on the calendar", "Время в расписании")}</span>
                <strong>
                  {active.reduce(
                    (n, b) => n + serviceFor(b.service).duration,
                    0,
                  ) / 60}
                  <em> {t("hrs", "ч")}</em>
                </strong>
                <small>
                  {t("Scheduled & completed", "Запланировано и завершено")}
                </small>
              </div>
              <div>
                <span>{t("Clients this week", "Клиентов за неделю")}</span>
                <strong>
                  {new Set(active.map((b) => b.email)).size
                    .toString()
                    .padStart(2, "0")}
                </strong>
                <small>
                  {t("A week of connections", "Каждая встреча важна")}
                </small>
              </div>
            </section>
            <div className="calendar-layout">
              <section className="panel calendar">
                <div className="calendar-toolbar">
                  <div>
                    <h2>{format(week, { month: "long", year: "numeric" })}</h2>
                    <p className="muted">
                      {format(week, { day: "numeric", month: "short" })} –{" "}
                      {format(addDays(week, 6), {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="controls">
                    <button
                      aria-label={t("Previous week", "Предыдущая неделя")}
                      onClick={() => setDay(addDays(day, -7))}
                    >
                      ‹
                    </button>
                    <button onClick={() => setDay(today)}>
                      {t("Today", "Сегодня")}
                    </button>
                    <button
                      aria-label={t("Next week", "Следующая неделя")}
                      onClick={() => setDay(addDays(day, 7))}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="week-head">
                  <span className="zone">UTC</span>
                  {days.map((d) => (
                    <button
                      key={d}
                      className={`${day === d ? "selected" : ""} ${today === d ? "today" : ""}`}
                      onClick={() => setDay(d)}
                    >
                      <small>{format(d, { weekday: "short" })}</small>
                      <strong>{format(d, { day: "numeric" })}</strong>
                    </button>
                  ))}
                </div>
                <div className="week-grid">
                  <div className="hours">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span key={i}>{i + 9}:00</span>
                    ))}
                  </div>
                  {days.map((d, i) => (
                    <div
                      className={`day-column ${i === 6 ? "closed" : ""}`}
                      key={d}
                    >
                      {i === 6 ? (
                        <span className="closed-label">
                          {t("Rest day", "Выходной")}
                        </span>
                      ) : (
                        Array.from({ length: 18 }, (_, j) => (
                          <button
                            className="empty-slot"
                            key={j}
                            disabled={
                              !!failure ||
                              startsAt({
                                date: d,
                                time: `${String(9 + Math.floor(j / 2)).padStart(2, "0")}:${j % 2 ? "30" : "00"}`,
                              }) <= now
                            }
                            aria-label={`${t("Book", "Записаться")} ${d} ${9 + Math.floor(j / 2)}:${j % 2 ? "30" : "00"} UTC`}
                            onClick={() =>
                              open(
                                undefined,
                                d,
                                `${String(9 + Math.floor(j / 2)).padStart(2, "0")}:${j % 2 ? "30" : "00"}`,
                              )
                            }
                          />
                        ))
                      )}
                      {bookings
                        .filter((b) => b.date === d && b.status !== "cancelled")
                        .map((b) => (
                          <button
                            key={b.id}
                            className={`event ${serviceFor(b.service).color}`}
                            style={{
                              top: ((minutes(b.time) - 540) / 540) * 100 + "%",
                              height:
                                (serviceFor(b.service).duration / 540) * 100 +
                                "%",
                            }}
                            onClick={() => open(b.id)}
                          >
                            <strong>{b.name}</strong>
                            <span>
                              {b.time} · {serviceFor(b.service).duration}
                              {t("m", "м")}
                            </span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
                <footer className="calendar-footer">
                  <span>
                    ●{" "}
                    {t("Select a slot to book", "Нажмите на время для записи")}
                  </span>
                  <span>
                    {t("Single studio calendar", "Расписание одной студии")}
                  </span>
                </footer>
              </section>
              <aside className="panel agenda">
                <div className="agenda-heading">
                  <span className="eyebrow">
                    {t("DAILY AGENDA", "ПЛАН НА ДЕНЬ")}
                  </span>
                  <h2>{format(day, { weekday: "long" })}</h2>
                  <p>{format(day, { day: "numeric", month: "long" })}</p>
                </div>
                {agenda.length ? (
                  agenda.map((b) => (
                    <button
                      key={b.id}
                      className="agenda-item"
                      onClick={() => open(b.id)}
                    >
                      <span className="agenda-time">
                        {b.time}
                        <small>
                          {serviceFor(b.service).duration} {t("min", "мин")}
                        </small>
                      </span>
                      <span
                        className={`agenda-bar ${serviceFor(b.service).color}`}
                      />
                      <span>
                        <strong>{b.name}</strong>
                        <small>{serviceName(b.service)}</small>
                        <span className={`status ${b.status}`}>
                          {statusName(b.status)}
                        </span>
                      </span>
                      <span>›</span>
                    </button>
                  ))
                ) : (
                  <div className="empty">
                    <span>☀</span>
                    <h3>{t("A little breathing room", "Можно выдохнуть")}</h3>
                    <p>
                      {t(
                        "No appointments on this day.",
                        "На этот день записей нет.",
                      )}
                    </p>
                    <button
                      className="secondary"
                      disabled={!!failure}
                      onClick={() => open()}
                    >
                      {t("Plan a session", "Запланировать встречу")}
                    </button>
                  </div>
                )}
                <div className="legend">
                  <p className="eyebrow">{t("YOUR SERVICES", "ВАШИ УСЛУГИ")}</p>
                  {services.map((s) => (
                    <div key={s.id}>
                      <i className={s.color} />
                      {serviceName(s.id)}
                      <small>
                        {s.duration}
                        {t("m", "м")}
                      </small>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </>
        )}
        {view === 1 && (
          <section className="panel list-panel">
            <div className="list-tools">
              <input
                aria-label={t("Search clients", "Поиск клиентов")}
                placeholder={t(
                  "Search name or email…",
                  "Поиск по имени или email…",
                )}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label={t("Booking status", "Статус записи")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">{t("All statuses", "Все статусы")}</option>
                {["confirmed", "completed", "cancelled"].map((s) => (
                  <option key={s} value={s}>
                    {statusName(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Client", "Клиент"),
                      t("Session", "Услуга"),
                      t("Date & time · UTC", "Дата и время · UTC"),
                      t("Status", "Статус"),
                      t("Details", "Подробности"),
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.name}</strong>
                        <small>{b.email}</small>
                      </td>
                      <td>{serviceName(b.service)}</td>
                      <td>
                        {format(b.date, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        <small>{b.time}</small>
                      </td>
                      <td>
                        <span className={`status ${b.status}`}>
                          {statusName(b.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => open(b.id)}
                        >
                          {t("View", "Открыть")} ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="empty">
                <h3>{t("No matching bookings", "Записи не найдены")}</h3>
                <p>
                  {t(
                    "Try another search or status.",
                    "Измените поиск или статус.",
                  )}
                </p>
              </div>
            )}
          </section>
        )}
        {view === 2 && (
          <section className="cards">
            {clients.map((c) => (
              <button
                className="panel client"
                key={c.email}
                onClick={() => {
                  setQuery(c.email);
                  setFilter("all");
                  setView(1);
                }}
              >
                <span className="client-avatar">
                  {c.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <h2>{c.name}</h2>
                <p className="muted">{c.email}</p>
                <div>
                  {c.count} {t("sessions", "встреч")}
                  <span>{t("View bookings", "Смотреть записи")} ↗</span>
                </div>
              </button>
            ))}
          </section>
        )}
        {view === 3 && (
          <section className="cards">
            {services.map((s, i) => (
              <article className="panel service" key={s.id}>
                <span className={`service-icon ${s.color}`}>
                  {["✳", "◇", "✦"][i]}
                </span>
                <p className="eyebrow">
                  0{i + 1} / {t("STUDIO SESSION", "ВСТРЕЧА В СТУДИИ")}
                </p>
                <h2>{serviceName(s.id)}</h2>
                <p className="muted">
                  {
                    [
                      t(
                        "Get to know the project, ask questions and find the next step.",
                        "Знакомство с проектом, вопросы и определение следующего шага.",
                      ),
                      t(
                        "A focused review of an interface, with practical feedback.",
                        "Внимательный разбор интерфейса с практическими рекомендациями.",
                      ),
                      t(
                        "Make room for ideas and turn them into an actionable plan.",
                        "Обсуждение идей и составление конкретного плана действий.",
                      ),
                    ][i]
                  }
                </p>
                <div className="service-price">
                  ${s.price}
                  <span>
                    / {s.duration} {t("min", "мин")}
                  </span>
                </div>
                <small>
                  {t(
                    "Illustrative price · no payments",
                    "Примерная цена · без платежей",
                  )}
                </small>
                <button
                  className="secondary"
                  disabled={!!failure}
                  onClick={() => open(undefined, day, undefined, s.id)}
                >
                  {t("Book this session", "Выбрать встречу")} ↗
                </button>
              </article>
            ))}
          </section>
        )}
        <footer className="page-footer">
          SmartBooking <span>✦</span>{" "}
          {t(
            "Made for a more intentional workday.",
            "Для продуманного рабочего дня.",
          )}
        </footer>
      </main>
      <dialog
        aria-label={t("Booking form", "Форма записи")}
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(false);
        }}
        onClose={() => setModal(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save((b) =>
              editing
                ? updateBooking(editing, draft, b)
                : createBooking(draft, b, crypto.randomUUID()),
            );
          }}
        >
          <div className="modal-header">
            <div>
              <p className="eyebrow">
                {t("STUDIO SESSION · UTC", "ВСТРЕЧА · UTC")}
              </p>
              <h2>
                {editing
                  ? t("Booking details", "Детали записи")
                  : t("Make time for good work.", "Время для хорошей работы.")}
              </h2>
            </div>
            <button
              type="button"
              className="close"
              disabled={busy}
              aria-label={t("Close dialog", "Закрыть окно")}
              onClick={() => setModal(false)}
            >
              ×
            </button>
          </div>
          {notice && (
            <p role="alert" className="error">
              {notice}
            </p>
          )}
          {selected && (
            <p className={`status ${selected.status}`}>
              {statusName(selected.status)}
            </p>
          )}
          {confirm ? (
            <div className="confirmation">
              <h3>{t("Cancel this booking?", "Отменить эту запись?")}</h3>
              <p>
                {t(
                  "The time slot will become available again. The cancelled booking stays in your history.",
                  "Время снова станет доступным. Отменённая запись останется в истории.",
                )}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  {t("Keep booking", "Оставить запись")}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => save((b) => cancelBooking(editing!, b))}
                >
                  {t("Confirm cancellation", "Подтвердить отмену")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <fieldset disabled={!editable || busy || !!failure}>
                <label>
                  {t("Session type", "Тип встречи")}
                  <select
                    value={draft.service}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        service: e.target.value as ServiceId,
                        time: "",
                      })
                    }
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {serviceName(s.id)} · {s.duration} {t("min", "мин")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Date", "Дата")}
                  <input
                    type="date"
                    required
                    min={today}
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value, time: "" })
                    }
                  />
                </label>
                <label>
                  {t(
                    "Available start times · UTC",
                    "Доступное время начала · UTC",
                  )}
                  <select
                    required
                    value={draft.time}
                    onChange={(e) =>
                      setDraft({ ...draft, time: e.target.value })
                    }
                  >
                    <option value="">
                      {t("Choose a time", "Выберите время")}
                    </option>
                    {!editable &&
                      draft.time &&
                      !available.includes(draft.time) && (
                        <option value={draft.time}>{draft.time}</option>
                      )}
                    {available.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                </label>
                {editable && !available.length && (
                  <p className="muted">
                    {t(
                      "No available times. Try another day.",
                      "Нет свободного времени. Выберите другой день.",
                    )}
                  </p>
                )}
                <div className="form-row">
                  <label>
                    {t("Client name", "Имя клиента")}
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      value={draft.name}
                      placeholder="Alex Morgan"
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      maxLength={254}
                      value={draft.email}
                      placeholder="alex@example.com"
                      onChange={(e) =>
                        setDraft({ ...draft, email: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  {t("Notes (optional)", "Заметки (необязательно)")}
                  <textarea
                    maxLength={500}
                    rows={2}
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                  />
                </label>
              </fieldset>
              <p className="muted form-hint">
                {t(
                  "Demo only. Use fictional contact details. No emails are sent.",
                  "Учебное демо. Используйте вымышленные контакты. Письма не отправляются.",
                )}
              </p>
              <div className="modal-actions">
                {selected?.status === "confirmed" && (
                  <button
                    type="button"
                    className="text-danger"
                    disabled={busy || !!failure}
                    onClick={() => setConfirm(true)}
                  >
                    {t("Cancel booking", "Отменить запись")}
                  </button>
                )}
                {selected?.status === "confirmed" &&
                  endsAt(selected) <= now && (
                    <button
                      type="button"
                      className="primary"
                      disabled={busy || !!failure}
                      onClick={() =>
                        save((b) => completeBooking(selected.id, b))
                      }
                    >
                      {t("Mark completed", "Отметить завершённой")}
                    </button>
                  )}
                {editable && (
                  <button
                    className="primary"
                    disabled={
                      busy || !!failure || !available.includes(draft.time)
                    }
                  >
                    {busy
                      ? t("Saving…", "Сохранение…")
                      : editing
                        ? t("Save changes", "Сохранить изменения")
                        : t("Create booking", "Создать запись")}
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      </dialog>
    </div>
  );
}
