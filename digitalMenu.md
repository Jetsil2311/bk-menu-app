# Bubble Kaapeh — Digital Menu Log

Base template: https://github.com/Jetsil2311/menu-demo
Client: Bubble Kaapeh (BK)
Last updated: 2026-06-17

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

## Known Issues / Follow-ups

- Thermal printer features (SettingsChips, printReceipt utilities) are present in the codebase but NOT wired to POS.jsx or Orders.jsx yet (user skipped those connections). Wire up when ready: import useSettings + printReceipt in POS.jsx for auto-print after payment; add reprint button to Orders.jsx pagado cards.
- POS.jsx still has `allCustomers` state loaded on mount for client-side customer search. Nativa replaced this with `isSearching` + real-time query. Can be refactored later.
- `bg-main-900` used in AdminLayout main area — verify it matches the intended dark brown (`#26100b`) visually vs the old `#2a1208`.
