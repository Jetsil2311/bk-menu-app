# Bubble Kaapeh POS API (v1)

Read-only access to the café's business data so another app can manage its
finances. It was built for **Tally**, the owner's finance app, which will get a
business workspace that reads everything from here. Nothing in this API can
change café data.

- Base URL: `https://<menu domain>/api/v1`
- Format: JSON. Money is a string with 2 decimals in **MXN** (`"4230.00"`), like Tally's own API.
- Time zone: all days are café days (`America/Mexico_City`).
- Code: `api/v1/[resource].js` (Vercel function) → `server/posApi/handler.js`
  (routes) → `server/posApi/finance.js` (calculations, unit-tested). The numbers
  come from the same `src/utils/financeCalculations.js` the admin's Finanzas uses.

## Connecting (like "Sign in with…", but with a key)

1. In the café admin: **Ajustes → Conexiones (API) → Crear clave** (e.g. name it "Tally").
2. Copy the key (`bkpos_…`). It's shown **once**; the café only stores its SHA-256 hash.
3. The other app sends it on every request:

```
Authorization: Bearer bkpos_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

(`X-API-Key: bkpos_…` also works.)

To disconnect, press the trash icon next to the key in Ajustes. It stops working immediately.
Keys have the scope `finance:read`; every route below requires it.

## Ranges

Routes marked *ranged* take `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, café
dates, up to 366 days). Without them: from the 1st of this month to today.

## Routes

| Route | Ranged | What it returns |
|---|---|---|
| `GET /api/v1` | | Index: business info and every resource |
| `GET /api/v1/business` | | Name, currency, time zone, how much is set up |
| `GET /api/v1/summary` | ✓ | Totals for the range: sales, payment mix, ingredient cost, profit, cash flow |
| `GET /api/v1/daily` | ✓ | The same figures for every day (days without sales included, at 0) |
| `GET /api/v1/transactions` | ✓ | Ledger ready to become finance-app entries |
| `GET /api/v1/orders` | ✓ | Paid orders with items, options, payment method and cost |
| `GET /api/v1/products` | ✓ | Units sold, revenue, cost and margin per product |
| `GET /api/v1/expenses` | | Recurring fixed expenses (weekly / monthly / annual) |
| `GET /api/v1/inventory` | | Ingredients: stock, value, low-stock status |
| `GET /api/v1/register` | ✓ | Caja sessions: opening cash, sales, cash in/out, counted vs expected |

Every successful response also has `meta: { key, generatedAt }`.

### `/summary`

```json
{
  "from": "2026-10-01", "to": "2026-10-26", "currency": "MXN",
  "orders": 55, "daysWithSales": 18, "averageTicket": "79.45",
  "revenue": "4370.00",
  "paidWith": { "cash": "4370.00", "card": "0.00", "rewards": "0.00" },
  "ingredientCost": "833.40", "grossProfit": "3536.60", "grossMarginPercent": 80.9,
  "fixedCosts": "10987.08", "netProfit": "-7450.48",
  "revenueWithoutRecipe": "860.00",
  "cashFlow": { "moneyIn": "4370.00", "ingredientPurchases": "0.00", "fixedExpensesDue": "12500.00", "net": "-8130.00" }
}
```

There are two ways to read profit, and both are included:

- **Profit (accrual)**: `revenue − ingredientCost − fixedCosts = netProfit`. Ingredient cost is what the
  sold products used up (from their recipes). Fixed costs are spread evenly per day (a monthly expense
  over that month's real length, a weekly one over 7 days, an annual one over the year). This is
  Finanzas → "Te quedó".
- **Cash flow**: money that came in (sales) minus money that went out (ingredient purchases registered
  in Inventario and fixed expenses whose due date falls in the range).

`revenueWithoutRecipe` is the part of sales from products that have no recipe yet. Their cost
counts as $0, so profit is overstated by up to that amount until the recipes exist.

Rewards (`paidWith.rewards`) are part of the sale value, but that money was earned and stored by the
customer earlier, not received as cash or card that day.

### `/transactions`: the ledger

Designed to map 1:1 onto finance-app transactions. Sorted newest first.

```json
{
  "id": "sales-2026-10-26",            // stable: use it to skip duplicates on re-import
  "type": "income",                    // income | expense
  "status": "confirmed",               // confirmed | scheduled
  "amount": "375.00", "currency": "MXN",
  "date": "2026-10-26T23:15:00.000Z",  // ISO instant
  "localDate": "2026-10-26",           // café day
  "description": "Ventas del día (4 pedidos)",
  "category": { "key": "sales", "name": "Ventas" },
  "merchant": "Bubble Kaapeh",
  "source": "bk-pos",
  "details": { "orders": 4, "paidWith": { … }, "ingredientCost": "46.30", "grossProfit": "328.70" }
}
```

| Entry | id | type / status | category.key |
|---|---|---|---|
| Sales of one day (one per day, as chosen by the owner) | `sales-YYYY-MM-DD` | income / confirmed | `sales` |
| Ingredient purchase (Inventario → Registrar compra) | `purchase-<docId>` | expense / confirmed | `ingredients` |
| Fixed expense due date (renta, sueldos…) | `fixed-<expenseId>-YYYY-MM-DD` | expense / **scheduled** | `fixed_expenses` |

- `scheduled` means the café knows the expense is due that day but doesn't record whether it was
  paid. It maps naturally to Tally's `unverified` recurring charges.
- Refunded and cancelled orders are never sales. A refunded order is simply not counted.
- Ingredient *cost* (what sales used up) is not a ledger entry. The money left when the ingredients
  were bought (the `purchase-…` entries). It's in `/summary` and `/daily`.

### `/orders`

No customer names, phones or ids are ever included.

```json
{
  "id": "…", "code": "WEB-UU3TEOF", "paidAt": "…", "channel": "web_menu",   // web_menu | counter
  "total": "140.00", "ingredientCost": "0.00", "grossProfit": "140.00",
  "paidWith": { "cash": "140.00", "card": "0.00", "rewards": "0.00" },
  "items": [{ "productId": "product-4", "name": "Slushy", "quantity": 2,
              "options": ["Mango", "Tapioca extra"], "total": "140.00", "ingredientCost": null }]
}
```

### `/products`

`ingredientCost`, `grossProfit` and `marginPercent` are `null` when the product has no recipe
(`hasRecipe: false`), so a missing cost is never shown as a 100% margin.

### `/expenses`

```json
{ "id": "…", "name": "Sueldos", "amount": "1400.00", "frequency": "weekly",
  "dueDay": null, "dueWeekday": 1, "dueMonth": null,      // dueWeekday: 0 = Sunday
  "nextDueDate": "2026-10-26",
  "equivalents": { "daily": "200.00", "weekly": "1400.00", "monthly": "6066.67", "annual": "72800.00" } }
```

This maps onto Tally's recurring payments.

### `/inventory`

`{ totalValue, lowCount, items: [{ id, name, unit, inStock, costPerUnit, value, warnAt, status: ok | low | out, supplier }] }`

### `/register`

One session per day: `openingCash, cashSales, cardSales, paidWithRewards, cashIn, cashOut,
movements[], expectedCash, countedCash, difference` (difference < 0 = cash missing).

## Errors

```json
{ "error": { "code": "invalid_key", "message": "…" } }
```

| Status | code | When |
|---|---|---|
| 400 | `invalid_range` | Bad `from`/`to` |
| 401 | `missing_key` / `invalid_key` | No key, wrong key or revoked key |
| 403 | `insufficient_scope` | Key without `finance:read` |
| 404 | `not_found` | Unknown resource |
| 405 | `method_not_allowed` | Anything but GET |
| 503 | `not_configured` | The server has no Firestore credentials (see below) |

## Server setup (once)

The function reads Firestore with the Firebase Admin SDK. It needs one Vercel environment variable:

- `FIREBASE_SERVICE_ACCOUNT`: Firebase console → Project settings → Service accounts → *Generate new
  private key*. Paste the whole JSON as the value (or the JSON base64-encoded). Production
  environment only. Keep it secret: it gives full database access, and it never reaches the browser.

Also deploy `firestore.rules` (it adds the `api_keys` rule the admin needs to create keys):
`firebase deploy --only firestore:rules`.

## Local testing

With the emulators running (`npm run dev:test`), the handler uses the emulator automatically when
`FIRESTORE_EMULATOR_HOST` is set. Create a key in the local admin (Ajustes → Conexiones), then for
example with `vercel dev`:

```
curl -H "Authorization: Bearer bkpos_…" "http://localhost:3000/api/v1/summary?from=2026-10-01&to=2026-10-31"
```
