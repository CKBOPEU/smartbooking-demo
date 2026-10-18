# SmartBooking — studio scheduling concept

Small studios need a clear way to organise sessions without losing track of clients or double-booking their time. This self-directed portfolio project explores that workflow with fictional data.

The desktop experience combines a weekly overview with a daily agenda. On phones, the same date selection leads to a readable daily list instead of a compressed calendar grid. Restrained violet, teal and amber identify services; text labels communicate status independently of colour.

The central interaction is a complete booking lifecycle: choose a service, select a free start time, enter fictional contact details, then reschedule or cancel. Availability accounts for service duration and is rechecked against current stored data at save time. An explicit cancellation confirmation prevents accidental changes.

Built with Next.js, React, TypeScript and CSS, with Codex assistance. Eight deterministic tests cover domain rules. Browser checks covered creation, persistence, rescheduling, cancellation, searching, translation and responsive layouts.

Scope: local frontend demonstration, no backend or payment system. A production version would need authentication, server-side validation, database transactions, privacy controls, backups, timezone configuration and delivery integrations. No business performance or client outcomes are claimed.

Suggested portfolio caption: “SmartBooking — a bilingual appointment management demo with duration-aware availability, booking lifecycle controls and a responsive calendar. Next.js / React / TypeScript. Built with AI assistance.”
