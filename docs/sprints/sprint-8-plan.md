# Sprint 8 Plan

## Goal

**Email-уведомления** и **release hardening** перед выводом в прод: клиент получает письма по ключевым статусам; шаблоны, env для провайдера, policy при сбое доставки; расширенные smoke- и runbook-процедуры (checkout + admin + email + склад).

## Scope In

- Выбор/подключение email-провайдера (SendGrid, SES, Resend, др.) - **только через env**, секреты не в репозитории.
- Сервис отправки: асинхронно или `try/catch` с записью "notification failed" без отката заказа (см. [guest-checkout-mvp-lifecycle](../architecture/guest-checkout-mvp-lifecycle.md) п.5).
- Триггеры (минимум): заказ создан, счет выставлен, оплата подтверждена, в доставке, выполнен, отменен.
- HTML/text шаблоны, без PII в логах; correlation `orderId`.
- Runbook: [release-process](../runbooks/release-process.md) дополнение smoke, ручной resend, проверка очереди.
- Runbook: проверка складской консистентности (ссылка на [rollback-and-recovery](../runbooks/rollback-and-recovery.md) при необходимости).
- Расширение CI при появлении e2e (опция): smoke job.

## Scope Out

- SMS, Telegram, push.
- Маркетинговые рассылки.
- Механизм гарантированной доставки 99.99% (достаточно best-effort + ручной recovery в MVP).

## Dependencies

- Sprint 5-7: корректные события/статусы, по которым слать письма.
- Безопасный email в заказе: `customerEmail` из snapshot.

## Risks

- Письма в dev - sandbox; не слать production accidentally.
- Rate limits API провайдера.

## Definition of Done

- На key transitions приходит письмо (проверено в sandbox) или зафиксирован controlled skip в staging с инструкцией.
- Сбой email не портит инварианты заказа/склада; есть retry или manual resend.
- Runbookи обновлены; smoke checklist пройден.

## Acceptance Checklist

- [ ] `docs/sprints/sprint-8-backlog.md` - P0 закрыты.
- [ ] `docs/runbooks/...` - дополнения внесены.
- [ ] Секреты не в репо.
