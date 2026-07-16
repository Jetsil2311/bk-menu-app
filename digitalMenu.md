# Bubble Kaapeh — Digital Menu Log

Base template: https://github.com/Jetsil2311/menu-demo
Client: Bubble Kaapeh (BK)
Last updated: 2026-07-16

---

## Brand

- Primary color: `--color-main-500: #743121` (dark terracotta/brown)
- Dark bg: `--color-main-900: #26100b`, `--color-main-950: #1a0a07`
- Light: `--color-light-100: #fffbed` (cream)
- Heading font: (serif — confirm from index.css)
- Body font: (sans — confirm from index.css)
- Logo: `/public/bklogo.svg` + `/src/assets/bklogo.svg`
- Vibe: Warm, dark, cozy coffee shop. Deep browns and cream.

---

## Menu Structure

(To be filled in from Firestore / products.js data)

---

## Changes from Base Template

### 2026-04-21 — Mobile admin panel refactor
What changed: Full mobile-first refactor of the admin panel. Added BottomTabBar component with 4 primary tabs (Overview, POS, Pedidos, Clientes) and a "Más" drawer for secondary pages. Sidebar is hidden on mobile (`hidden md:flex`). Added MobileSettingsSheet component.
Files affected: src/components/admin/BottomTabBar.jsx (new), src/components/admin/MobileSettingsSheet.jsx (new), src/views/admin/AdminLayout.jsx, src/components/admin/Sidebar.jsx
Reason: Ported from Nativa — 2026-04-21. Admin owners use phones — the desktop sidebar was unusable on small screens.

### 2026-04-28 — PIN verification required before toggling screen lock
What changed: Clicking the lock/unlock icon in the navbar no longer writes to Firestore directly. Instead it opens a compact PIN confirmation modal (`PinPrompt`). The toggle only executes after the correct PIN is entered. Wrong PIN shakes the dots and clears for retry. Escape, backdrop click, and Cancelar all dismiss without action.
Files affected: src/components/admin/PinGate.jsx (added PinPrompt), src/components/admin/Topbar.jsx
Reason: Ported from Nativa — 2026-04-28. Security — lock toggle needs PIN verification so it can't be bypassed.

### 2026-04-28 — Per-screen PIN lock toggle + SmartPinGate
What changed: Every admin screen now has a Lock/LockOpen icon in the navbar. Clicking it toggles whether that screen requires a PIN. Config stored in Firestore `settings/general.pinGateConfig`, syncs in real-time. `SmartPinGate` component reads routeKey from Outlet context and conditionally wraps in `PinGate`. Fixes stale isLocked state across route navigations using reset-during-render pattern. All routes in main.jsx now use `<SmartPinGate routeKey="...">`. Defaults: Overview, Métricas, Promociones, Menú, Legacy = locked; Pedidos, POS, Clientes, Caja = unlocked.
Files affected: src/components/admin/PinGate.jsx (SmartPinGate + PinPrompt), src/views/admin/AdminLayout.jsx (pinGateConfig onSnapshot + Outlet context), src/components/admin/Topbar.jsx, src/main.jsx
Reason: Ported from Nativa — 2026-04-28. Configurable PIN protection per screen, no code changes required.

### 2026-04-28 — Notification bell in admin navbar
What changed: Bell icon opens a live dropdown showing last 3 "Nuevo" orders. Amber pulsing badge when new orders exist. Each card shows short ID, customer name, item preview, time ago, total. "Ver todos los pedidos" button navigates to /admin/pedidos. Closes on click-outside. Real-time Firestore onSnapshot listener.
Files affected: src/components/admin/Topbar.jsx
Reason: Ported from Nativa — 2026-04-28. Owner needs quick visibility into new orders from any screen.

### 2026-04-28 — Register history moved to Overview collapsible
What changed: Past sessions history removed from the Caja (Register) page — Register now only shows the current session. "Historial de Caja" collapsible section added to the bottom of Overview. Starts collapsed, lazy-loads last 30 past sessions from Firestore on first open. PastSessionRow exported from Register.jsx and imported by Overview.jsx.
Files affected: src/views/admin/Register.jsx (removed history state/query/UI, exported PastSessionRow), src/views/admin/Overview.jsx (added imports, history state + lazy-load logic, collapsible section)
Reason: Ported from Nativa — 2026-04-28. Caja is operational (manage today's cash); history belongs in Overview.

### 2026-04-28 — Desktop keyboard shortcuts across admin panel
What changed: (1) PIN entry (PinGate + PinPrompt) supports physical keyboard — typing 0–9 adds digits, Backspace deletes, only on `pointer: fine` devices. (2) Register open modal: Enter confirms. Deposit/withdraw form: Enter confirms. Escape closes any open form/modal.
Files affected: src/components/admin/PinGate.jsx, src/views/admin/Register.jsx, src/components/admin/RegisterOverlay.jsx, src/components/admin/MobileSettingsSheet.jsx, src/views/admin/Customers.jsx, src/views/admin/MenuEditor.jsx
Reason: Ported from Nativa — 2026-04-28. Desktop UX — keyboard is significantly faster than on-screen buttons.

### 2026-04-28 — Sort dropdown in Pedidos screen
What changed: Sort button/dropdown on Orders screen. Smart defaults: Pagado filter → sort by updatedAt desc; all others → createdAt desc. 3 options for Pagado ("Más reciente", "Más antiguo", "Recién pagado"), 2 for others. Button highlights teal on manual override. Sort resets to smart default when filter changes.
Files affected: src/views/admin/Orders.jsx
Reason: Ported from Nativa — 2026-04-28. Owner wanted most recently paid orders at the top.

### 2026-04-28 — AdminLayout mobile layout fixes
What changed: Sidebar margin changed from `ml-20`/`ml-60` to `md:ml-20`/`md:ml-60` so the margin only applies on desktop (mobile uses BottomTabBar). Main content background changed from hardcoded `#2a1208` to `bg-main-900` CSS token. Main area rounded corners and borders made responsive with `md:` prefix.
Files affected: src/views/admin/AdminLayout.jsx
Reason: Ported from Nativa — 2026-04-21. Hardcoded hex violates design token rule; mobile layout was broken with desktop margin on small screens.

### 2026-05-04 — "Haz click para ver opciones" label + admin menu auto-update
What changed: (1) Product cards with option groups show a small italic label "Haz click para ver opciones →" when `hasOptions` is true. (2) Admin menu editor: `handleAddProduct` immediately appends new product to local state after Firestore write (no refresh needed). `handleAddSection` immediately appends new section sorted by order.
Files affected: src/components/MenuCard.jsx, src/hooks/useAdminData.js
Reason: Ported from Nativa — 2026-05-04. Customer clarity + admin UX fix (new items appeared only after refresh).

### 2026-05-04 — Topping descriptions: info button + admin field
What changed: Added optional `description` field to toppings. Customer-facing: teal Info icon button appears next to price when description exists; tapping expands inline. Admin: "Descripción" textarea in add/edit topping forms. Hook tracks toppingDescription state and includes it in Firestore writes.
Files affected: src/components/ToppingsOverlay.jsx, src/views/admin/MenuEditor.jsx, src/hooks/useAdminData.js
Reason: Ported from Nativa — 2026-05-04. Toppings like tapioca or espresso need context for customers.

### 2026-05-04 — POS apartados real-time fix + localStorage draft cache
What changed: (1) `saveAsApartado` confirmed to write to `parked_orders` collection with correct document shape. Auto-switches to "Apartadas" tab after saving so the new entry is immediately visible. (2) "Nuevo" status badge (green pill) added to each ParkedOrderCard. (3) Send button (amber) on each ParkedOrderCard calls `sendToKitchen` — writes the order to `orders` as `status: 'Nuevo'` and removes from `parked_orders`. (4) localStorage auto-save: every change to `orderItems`, `generalNote`, or `customer` persisted under key `pos_draft_v1`. On mount, if draft exists it is restored and amber banner "Orden recuperada del caché local" shown (dismissable). Draft cleared on successful payment or park. (5) PaymentModal: Escape closes, Enter confirms.
Files affected: src/views/admin/POS.jsx
Reason: Ported from Nativa — 2026-05-04. Guardar tab auto-switch + draft cache survive accidental navigation.

### 2026-05-06 — Thermal receipt printing system (SettingsChips, printReceipt utilities)
What changed: Created full two-path printing architecture (WebUSB + Windows print dialog). New files: src/utils/printing/receiptContent.js, src/utils/printing/usbPrinter.js, src/utils/printing/windowsPrinter.js, src/utils/printing/printReceipt.js (router), src/utils/printReceipt.js (re-export shim). Added PrinterChip to src/components/admin/SettingsChips.jsx with method selector, USB device connect/disconnect, test print, master enable toggle, receipt fields. IVA (16%) breakdown on all receipts.
Files affected: src/utils/printReceipt.js, src/utils/printing/ (4 new files), src/components/admin/SettingsChips.jsx (new)
Reason: Ported from Nativa — 2026-05-06/09. Staff need fast touchless receipt and kitchen comanda printing.

---

### 2026-06-17 — Firestore crash fix + lock button always visible

What changed: (1) Fixed Firestore "INTERNAL ASSERTION FAILED: Unexpected state" white-screen crash. Root cause: `getDocs` was called inside the `onSnapshot` callback in `useAdminDashboard.js`, causing nested async in a real-time listener — on every order change it re-fetched all orders and the React StrictMode double-invocation triggered a race in Firestore's internal target state. Fix: split into two separate useEffects — one `onSnapshot` for the recent orders list, one `getDocs` for the stats (runs once on mount). (2) Added `alive` flag + `try { unsub() } catch {}` to ALL `onSnapshot` cleanups in `AdminLayout.jsx`, `Topbar.jsx`, `useSettings.js`, and `useAdminDashboard.js` — prevents Firestore's internal assertion from propagating when cleanup fires mid-event-delivery. (3) Fixed lock toggle button never appearing in Topbar: `pinGateConfig` was `null` when Firestore hadn't loaded yet, making `isCurrentScreenLocked` always `null`. Added `DEFAULT_PIN_GATE_CONFIG` constant in Topbar and changed fallback from `?? null` to `?? DEFAULT_PIN_GATE_CONFIG` — button now always shows on known routes using sensible defaults until Firestore responds.
Files affected: src/hooks/useAdminDashboard.js, src/hooks/useSettings.js, src/views/admin/AdminLayout.jsx, src/components/admin/Topbar.jsx
Reason: White-screen crash on navigation; PIN lock button was invisible on every admin screen.

---

### 2026-06-17 — Safe onSnapshot cleanup applied to all remaining Firestore listeners

What changed: The Firestore "INTERNAL ASSERTION FAILED: Unexpected state" crash (which occurs after navigating between admin screens repeatedly) was caused by bare `return unsub` / `return () => unsubscribe()` cleanup functions in 6 files. When React unmounts a component mid-event-delivery, calling `unsub()` synchronously in the cleanup throws inside Firestore's internal watch-stream state machine. Fix: every `onSnapshot` cleanup now uses `return () => { alive = false; try { unsub() } catch {} }` and an `alive` flag to guard all setState calls from firing after unmount.
Files affected: src/context/RegisterContext.jsx, src/views/admin/Register.jsx, src/views/admin/POS.jsx, src/views/admin/Customers.jsx, src/views/admin/Orders.jsx, src/views/admin/Promos.jsx
Reason: Crash was triggered by rapid screen switching in the admin panel — the previous partial fix (2026-06-17) only covered 4 of 10 files with onSnapshot.

### 2026-06-17 — POS search includes option group option names

What changed: The POS product search bar now matches against option names inside each product's `optionGroups[].options[].name` in addition to the product name. Typing "frío", "grande", or any option label now surfaces all products that have that option available, not just products whose name contains the term.
Files affected: src/views/admin/POS.jsx
Reason: Cashiers couldn't find products by option (e.g. searching "caliente" to find all drinks that have a hot option).

### 2026-06-17 — Refund button on Pedidos screen with register adjustment

What changed: Added refund flow to the Pedidos (Orders) screen. Each `Pagado` order now shows a rose-colored "Reembolsar" button next to "Reimprimir". Clicking it opens a `RefundModal` showing the exact cash/card/loyalty amounts that will be reversed. Confirming marks the order as `Reembolsado` in Firestore and decrements `cashSales`, `cardSales`, and `loyaltyRedemptions` in today's register session using `increment(-amount)`. Cash refund amount is computed as `order.total - card - loyalty` (matching how POS originally wrote to the register). `Reembolsado` is a new status with rose styling — shown as a filter tab in Pedidos, excluded from the "Activos" filter, and renders an inline notice instead of the progress stepper in expanded view.
Files affected: src/views/admin/Orders.jsx
Reason: Cashiers needed a way to reverse charges and have them automatically reflected in the daily register totals.

### 2026-06-17 — LoyaltyLookupModal: customer association before charging

What changed: Added `LoyaltyLookupModal` component in POS.jsx. When the cashier clicks "Cobrar" and no customer is linked to the active order, this modal now intercepts the flow. It shows: (1) an autofocused search bar to find existing customers by name or phone with up to 5 results displayed in a results list; (2) a "Registrar nuevo cliente" dashed button when idle or a "Registrar" link when search yields no results — both expand an inline form (name + phone) that saves to Firestore and immediately associates the new customer; (3) a "Continuar sin cliente" secondary button at the bottom to skip and proceed to PaymentModal without loyalty tracking. If a customer is already linked when "Cobrar" is clicked, the modal is skipped entirely. New customers created here are also pushed into POS's `allCustomers` array so the ticket's inline customer panel stays in sync.
Files affected: src/views/admin/POS.jsx
Reason: Cashiers were completing charges without associating loyalty clients — this creates a mandatory prompt to check before every payment, while keeping a clear skip path.

---

### 2026-06-17 — Firestore ca9 crash fix: deferred onSnapshot listeners

What changed: All 10 `onSnapshot` listeners in the admin panel now use a `setTimeout(0)` deferral before registering with Firestore. React StrictMode double-invokes `useEffect` — mount → cleanup → mount. Without the deferral, each component registered a listener, immediately destroyed it (cleanup), then registered it again. With three concurrent listeners on the `orders` collection (Topbar, useAdminDashboard, Orders), this rapid create/remove cycle triggered Firestore's `ca9` assertion (`INTERNAL ASSERTION FAILED: TargetState.markCurrent()`) inside the watch-stream async processor. Once `ca9` fires, the AsyncQueue is permanently poisoned — all subsequent screen navigations show a blank screen with no error. The `setTimeout(0)` fix: StrictMode's cleanup fires synchronously and calls `clearTimeout` before the timer fires, so no listener is ever created on the false mount. The real mount creates its timer, no cleanup arrives, and exactly one listener is registered per component. Files affected: src/hooks/useAdminDashboard.js, src/views/admin/Orders.jsx, src/components/admin/Topbar.jsx, src/views/admin/AdminLayout.jsx, src/hooks/useSettings.js, src/views/admin/Customers.jsx, src/views/admin/Promos.jsx, src/context/RegisterContext.jsx, src/views/admin/Register.jsx, src/views/admin/POS.jsx.
Reason: Navigating between admin screens randomly then clicking Pedidos triggered the ca9 error; any subsequent navigation showed a completely blank screen with no visible error.

---

### 2026-06-18 — Metrics view: revenue graph timezone fix + top products items array fix

What changed: Fixed two bugs in the Metrics view. (1) Revenue graph: each data point was filtering orders using `toISOString().split('T')[0]` which returns UTC dates. A sale at 9 PM Mexico time (UTC-6) was being stamped as the next calendar day in UTC, causing sales to appear on the wrong date and evening revenue to vanish from the expected day. Fix: added `localDateStr()` helper that uses `getFullYear/getMonth/getDate` (local time), applied to both the day bucket generation and the order filter. Refunded orders (status "Reembolsado") are now excluded from revenue totals. (2) Top products: `parseItemsFromContent(order.content)` only parsed a legacy text format; all modern orders written by POS.jsx use an `items: [{name, qty, ...}]` array and have no formatted `content` string, so `productCounts` was always empty and the chart showed "Datos insuficientes" permanently. Fix: added `getOrderItems(order)` helper that reads `order.items` array first and falls back to `parseItemsFromContent` for legacy orders. Refunded orders are also excluded from product counts. Summary cards (period totals) also now exclude refunded orders.
Files affected: src/views/admin/Metrics.jsx
Reason: Revenue graph was showing wrong day attributions due to UTC/local timezone mismatch. Top products was always empty because modern POS orders don't use the content string format the parser expected.

---

### 2026-06-18 — Edit client button in Clientes view

What changed: Each customer row in the Clientes admin view now has an "Editar" button (pencil icon) in the expanded detail section, alongside the existing "Ajustar saldo" button. Clicking it opens an `EditCustomerModal` pre-filled with the client's current name and phone number. Saving writes the updated fields to Firestore (`customers/{id}`) with `updatedAt: serverTimestamp()`. The list updates in real-time via the existing `onSnapshot` listener — no refresh needed. Escape closes the modal; Enter confirms. Also fixed a Tailwind canonical class warning (`bg-white/[0.02]` → `bg-white/2`).
Files affected: src/views/admin/Customers.jsx
Reason: Admins needed a way to correct client names and phone numbers after registration.

---

### 2026-06-18 — Visit history popup + last visit date in Clientes

What changed: (1) Each expanded customer row now shows "Última visita" date alongside "Cliente desde" in the detail info strip. (2) Added a "Ver historial" button (history icon) in the expanded row buttons. Clicking it opens `VisitHistoryModal`, which fetches all orders from Firestore where `customerId == customer.id`, sorts them newest-first client-side (no composite index required), and displays them as a scrollable accordion list. Each row shows date, time, item count, and total. Expanding a row shows the full items list (reads from `order.items` array for modern POS orders, falls back to legacy content string) plus a payment breakdown (efectivo / tarjeta / loyalty). Added `getVisitItems()` helper that mirrors the same dual-format logic used in Metrics.jsx. Imports added: `getDocs`, `where` from firestore; `History`, `Clock` from lucide-react.
Files affected: src/views/admin/Customers.jsx
Reason: Admins needed to see when a client last visited and review their purchase history per visit.

---

### 2026-07-01 — PinGate config + Auth system: Firestore-only, no local overrides

What changed: (1) **PinGate**: Removed `DEFAULT_PIN_GATE_CONFIG` const from both `AdminLayout.jsx` and `Topbar.jsx`. `AdminLayout` no longer bootstraps a default config into Firestore on first load — it simply passes `{}` if `pinGateConfig` is absent from the DB. `AdminLayout` shows a "Cargando..." state while `pinGateConfig === null` so `SmartPinGate` always receives a non-null config when it renders. `SmartPinGate` changed lock check from `config[routeKey] !== false` (defaulted to locked for missing keys) to `config[routeKey] === true` (opt-in locking; missing key = unlocked). Added a `useEffect` in `SmartPinGate` that watches `config` and calls `setIsLocked(config[routeKey] === true)` — this makes the lock button take effect in real time without requiring page navigation. Lock icon in `Topbar` updates instantly because `isCurrentScreenLocked` also uses `=== true`. `toggleLock` changed from `updateDoc` with dot-notation to `setDoc` with `merge: true` spreading the full config object — safe even if the settings doc doesn't yet have a `pinGateConfig` field. (2) **Auth**: Removed hardcoded `ALLOWED_EMAILS` array from `useAdminAuth.js`. Added `checkEmailAuthorized(email)` async helper that reads `settings/general.authorizedEmails` from Firestore — if the array exists and is non-empty, uses it; otherwise falls back to `FALLBACK_EMAILS` (the previous hardcoded list). Both `onAuthStateChanged` callback and `handleGoogleSignIn` now await this check. The `EmailsChip` in Overview/Settings (which already wrote to `authorizedEmails`) now actually controls who can log in. Added `active` flag to prevent state updates on unmounted component if auth fires during cleanup.
Files affected: src/hooks/useAdminAuth.js, src/components/admin/PinGate.jsx, src/views/admin/AdminLayout.jsx, src/components/admin/Topbar.jsx
Reason: PinGate config was being overridden by local hardcoded defaults — lock changes didn't survive a page refresh. Auth was controlled by code-level constants and ignored the `EmailsChip` UI in Overview that was supposed to manage access.

---

### 2026-07-01 — Lock button fix + auth open-access mode

What changed: (1) **Lock button**: Re-architectured pinGateConfig ownership. AdminLayout now owns the config AND a `toggleRouteKey(key)` function that updates local state IMMEDIATELY (optimistic) before writing to Firestore in background. Topbar receives `pinGateConfig` and `toggleRouteKey` as props — no longer reads from `useSettings()` for the lock. This eliminates the Firestore roundtrip delay; the lock icon and SmartPinGate both react within the same React render cycle. SmartPinGate's `useEffect` now depends on `configLocked` (a boolean primitive) instead of the `config` object reference — this is more reliable since React compares primitives with `Object.is` directly. (2) **Auth open-access mode**: `checkEmailAuthorized` now returns `true` (allow all) when `authorizedEmails` is absent or empty in Firestore. Previously it fell back to a hardcoded `FALLBACK_EMAILS` list. Now: no list = open access; list with entries = restricted to those entries only. Also changed network-error fallback to `return true` (fail open, don't lock admins out on bad connection).
Files affected: src/views/admin/AdminLayout.jsx, src/components/admin/Topbar.jsx, src/components/admin/PinGate.jsx, src/hooks/useAdminAuth.js
Reason: Lock button did nothing visible — Firestore roundtrip made the UI response appear broken; auth was falling back to hardcoded list when it should allow open access.

---

### 2026-07-16 — BottomSheet mobile touch hitbox fix

What changed: On phones, tapping buttons inside the product options bottom sheet (option pills, qty +/-, "Agregar") sometimes required tapping in the wrong spot to register. Root cause: the swipe-to-dismiss touch handlers (`onTouchStart/Move/End`) were attached to the entire sheet panel, not just the drag handle. Any tiny finger movement during a tap (natural hand tremor) was read as a drag gesture, which immediately shifted the whole sheet via `translateY` (no transition while dragging) — moving every button out from under the finger mid-tap before the touch ended. Fix: (1) moved the drag handlers off the full panel and onto a dedicated drag-handle strip only, sized to a 44px tap target, with `touchAction: 'none'` so the browser doesn't fight the gesture; (2) added `touchAction: 'manipulation'` to all sheet buttons (option pills, qty +/-, Agregar) to remove ambiguous tap/zoom handling; (3) bumped the qty +/- buttons from 36px (h-9 w-9) to the 44px minimum tap target (h-11 w-11) and gave option pills a 44px minHeight, per the project's mobile tap-target rule.
Files affected: src/components/BottomSheet.jsx
Reason: Buttons in the option sheet were effectively broken on touch screens — taps landed on the wrong element because the whole sheet moved under the finger during any tap due to overly broad swipe-to-dismiss listeners.

---

### 2026-07-16 — Admin panel mobile safe-area audit: navbar overlap + z-index + viewport-height fixes

What changed: Full mobile audit of the admin panel after report that the POS "Cobrar" flow was unreachable behind the BottomTabBar. Root causes found and fixed:
(1) **POS floating ticket button** was `fixed bottom-6 right-4 z-50` — sitting inside the BottomTabBar's own reserved footprint (64px + safe-area-inset-bottom) and below its z-60, so the tab bar painted over it. Moved to `bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` and `z-[65]` so it floats clear above the bar instead of overlapping it.
(2) **POS Cobrar sticky footer** (inside the mobile ticket sheet) sat flush with the true screen bottom via `justify-end` with no safe-area padding — added `paddingBottom: max(1rem, 1rem + env(safe-area-inset-bottom))`.
(3) **POS root height/margin mismatch**: POS.jsx opts out of `<main>`'s own padding via negative margins to size itself explicitly, but the margin values (`-mx-6/-mt-6/-mb-6`, `md:-mx-8...`) didn't match `<main>`'s actual padding (`p-4/pb-24` mobile, `p-6/pb-6` md, `p-8/pb-8` lg) — off by one breakpoint tier. On mobile this bled ~8px past `<main>`'s edges and, critically, canceled only 24px of the 96px (`pb-24`) `<main>` reserves specifically for the BottomTabBar, so POS's own scroll area extended behind the tab bar instead of stopping above it. Fixed to `-mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 -mb-24 md:-mb-6 lg:-mb-8 h-full`, dropping the separate `calc(100vh - 4rem)` height override in favor of inheriting `<main>`'s already-correct height.
(4) **Systemic z-index bug**: nearly every full-screen blocking modal across the admin panel (Orders refund confirm, all 3 Customers modals, Register "Abrir Caja", RegisterOverlay "Abrir Caja", MenuEditor product/section drawer + its delete-confirm) used `z-50`/`z-40`, both below the BottomTabBar's `z-60` and its Más drawer's `z-65`. On mobile this meant the tab bar rendered on top of these "blocking" modals and — more seriously — remained fully clickable through them, so a user could tap a nav icon and navigate away mid-modal (e.g. skip the mandatory "Abrir Caja" cash-count step). Also found `MenuEditor.jsx`'s delete-confirm dialog used the class `z-60`, which is not a real Tailwind utility (no matching scale value) and was silently a no-op — that dialog had no z-index at all. All of these were bumped to a `z-[70]`–`z-[72]` tier, consistently above both the tab bar and its drawer.
(5) **100vh → 100dvh**: `AdminLayout.jsx`'s root shell used `h-screen` (100vh), which on mobile browsers doesn't track the real visible area once the address bar collapses/expands, a common cause of content drifting under/behind fixed bars. Changed to `h-dvh`. Also updated POS.jsx's own `calc(100vh - 4rem)` → `calc(100dvh - 4rem)` (later replaced per item 3) and its register-loading placeholder from `h-screen` to `h-full` (it's nested inside `<main>`, not the whole viewport).
(6) **PinGate landscape/short-screen overflow**: both the full-screen PIN keypad and the compact PinPrompt modal were `flex items-center justify-center` with no scroll fallback — on a short/landscape phone the keypad's bottom rows (including Cancelar) could be clipped with no way to reach them. Added `overflow-y-auto` to both, plus safe-area-aware bottom padding on the full keypad.
Files affected: src/views/admin/POS.jsx, src/views/admin/AdminLayout.jsx, src/views/admin/MenuEditor.jsx, src/views/admin/Orders.jsx, src/views/admin/Customers.jsx, src/views/admin/Register.jsx, src/components/admin/RegisterOverlay.jsx, src/components/admin/PinGate.jsx
Reason: User reported the POS charge button was hidden beneath the bottom navbar and asked for a full mobile safe-area pass across the admin panel. The floating-button/z-index/viewport-height issues found above affect every mobile admin screen, not just POS, so all were fixed together as one pass.

Follow-up not done in this pass: a number of icon-only buttons across the admin panel (modal close "X" buttons using `p-1.5`, Topbar's `h-9 w-9` icon buttons, etc.) render below the 44px minimum tap target. They're not unreachable/broken like the issues above, just smaller than the accessibility guideline — flagged as a separate follow-up rather than rewritten here to avoid an app-wide visual change outside the requested scope.

---

## Known Issues / Follow-ups

- Thermal printer features (SettingsChips, printReceipt utilities) are present in the codebase but NOT wired to POS.jsx or Orders.jsx yet (user skipped those connections). Wire up when ready: import useSettings + printReceipt in POS.jsx for auto-print after payment; add reprint button to Orders.jsx pagado cards.
- POS.jsx still has `allCustomers` state loaded on mount for client-side customer search. Nativa replaced this with `isSearching` + real-time query. Can be refactored later.
- `bg-main-900` used in AdminLayout main area — verify it matches the intended dark brown (`#26100b`) visually vs the old `#2a1208`.
- Several icon-only buttons across the admin panel (modal close "X" buttons, Topbar's `h-9 w-9` icons) are below the 44px minimum tap target. Not broken, just smaller than ideal — worth a dedicated pass if it becomes a real usability complaint.
- Could not test the 2026-07-16 mobile safe-area fixes on an actual phone from this environment — please verify on a real device: POS floating ticket button clears the tab bar, Cobrar button is reachable, and none of the bumped-z-index modals (Orders refund, Customers x3, Register/RegisterOverlay "Abrir Caja", MenuEditor drawer + delete-confirm) render under the tab bar.
