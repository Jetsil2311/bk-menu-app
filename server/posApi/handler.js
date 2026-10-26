// POS API — read-only access to Bubble Kaapeh's business data for the owner's
// finance app (Tally). Every route needs a POS API key with 'finance:read'
// (created in the admin: Ajustes → Conexiones). Full reference: docs/POS_API.md
//
//   GET /api/v1                index: business + available resources
//   GET /api/v1/business       name, currency, time zone, what's set up
//   GET /api/v1/summary        sales, costs, profit and cash flow for a range
//   GET /api/v1/daily          the same, day by day
//   GET /api/v1/transactions   ledger: daily sales, ingredient purchases, fixed expenses
//   GET /api/v1/orders         paid orders with items (no customer data)
//   GET /api/v1/products       what each product sold and earned
//   GET /api/v1/expenses       recurring fixed expenses
//   GET /api/v1/inventory      ingredients in stock, value and low-stock status
//   GET /api/v1/register       Caja sessions: cash counted vs expected
//
// Ranged routes take ?from=YYYY-MM-DD&to=YYYY-MM-DD (café local dates,
// inclusive; default = this month so far).
import { FieldPath, getDb, Timestamp } from './firebaseAdmin.js'
import { ApiError, authenticate } from './auth.js'
import { SCOPES } from '../../src/utils/apiKeys.js'
import {
  CURRENCY, buildDaily, buildInventory, buildLedger, buildProducts, buildSummary,
  dayResource, expenseResource, orderResource, paidOrdersInRange, parseRange,
  rangeInfo, registerResource,
} from './finance.js'

export const BUSINESS = {
  name: 'Bubble Kaapeh',
  currency: CURRENCY,
  timeZone: 'America/Mexico_City',
}

// All day math (what counts as "today", which day a sale belongs to) runs in
// the café's time zone, not the server's (UTC on Vercel).
process.env.TZ = BUSINESS.timeZone

const VERSION = '1'

const RESOURCES = {
  business: { ranged: false, description: 'Business profile and what is set up' },
  summary: { ranged: true, description: 'Sales, ingredient cost, fixed costs, profit and cash flow for the range' },
  daily: { ranged: true, description: 'Summary figures for every day in the range' },
  transactions: { ranged: true, description: 'Ledger: one income per day of sales, one expense per ingredient purchase, one per fixed-expense due date' },
  orders: { ranged: true, description: 'Paid orders with their items, payment method and cost (no customer data)' },
  products: { ranged: true, description: 'Units sold, revenue, cost and margin per product' },
  expenses: { ranged: false, description: 'Recurring fixed expenses with their weekly/monthly/annual equivalents' },
  inventory: { ranged: false, description: 'Ingredients in stock, their value and low-stock status' },
  register: { ranged: true, description: 'Daily cash register sessions: opening cash, sales, movements, counted vs expected' },
}

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

// ── Loaders ────────────────────────────────────────────────────────────────
// Orders are read by creation date with a week of margin before the range:
// a tab opened earlier and paid inside the range is a sale of that range.
const loadOrders = async (db, range) => {
  const since = new Date(range.start)
  since.setDate(since.getDate() - 7)
  return docs(await db.collection('orders')
    .where('createdAt', '>=', Timestamp.fromDate(since))
    .where('createdAt', '<=', Timestamp.fromDate(range.end))
    .get())
}

const loadCatalog = async (db) => {
  const [recipes, products] = await Promise.all([db.collection('recipes').get(), db.collection('products').get()])
  return {
    recipes: docs(recipes),
    products: products.docs.map((d) => ({ docId: d.id, ...d.data() })),
  }
}

const loadPurchases = async (db) => docs(await db.collection('stockMovements').where('type', '==', 'purchase').get())
const loadMaterials = async (db) => docs(await db.collection('rawMaterials').get())
const loadExpenses = async (db) => docs(await db.collection('expenses').get())

const paidOrders = async (db, range) => {
  const [orders, catalog] = await Promise.all([loadOrders(db, range), loadCatalog(db)])
  return paidOrdersInRange(orders, catalog, range)
}

// ── Routes ─────────────────────────────────────────────────────────────────
const routes = {
  index: async () => ({
    api: 'Bubble Kaapeh POS API',
    version: VERSION,
    business: BUSINESS,
    resources: Object.fromEntries(Object.entries(RESOURCES).map(([name, r]) => [name, {
      path: `/api/v1/${name}`, ranged: r.ranged, description: r.description,
    }])),
  }),

  business: async (db) => {
    const [products, materials, expenses, recipes] = await Promise.all([
      db.collection('products').get(), db.collection('rawMaterials').get(),
      db.collection('expenses').get(), db.collection('recipes').get(),
    ])
    return {
      ...BUSINESS,
      kind: 'café',
      setup: {
        products: products.size,
        productsWithRecipe: recipes.size,
        ingredients: materials.size,
        fixedExpenses: expenses.size,
      },
    }
  },

  summary: async (db, range) => {
    const [orders, purchases, expenses, materials] = await Promise.all([
      paidOrders(db, range), loadPurchases(db), loadExpenses(db), loadMaterials(db),
    ])
    return buildSummary({ paidOrders: orders, purchases, expenses, materials, range })
  },

  daily: async (db, range) => {
    const [orders, expenses] = await Promise.all([paidOrders(db, range), loadExpenses(db)])
    return { ...rangeInfo(range), currency: CURRENCY, data: buildDaily({ paidOrders: orders, expenses, range }).map(dayResource) }
  },

  transactions: async (db, range) => {
    const [orders, purchases, expenses, materials] = await Promise.all([
      paidOrders(db, range), loadPurchases(db), loadExpenses(db), loadMaterials(db),
    ])
    return { ...rangeInfo(range), currency: CURRENCY, data: buildLedger({ paidOrders: orders, purchases, materials, expenses, range }) }
  },

  orders: async (db, range) => {
    const orders = await paidOrders(db, range)
    const data = orders.map(orderResource).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
    return { ...rangeInfo(range), currency: CURRENCY, data }
  },

  products: async (db, range) => ({
    ...rangeInfo(range), currency: CURRENCY, data: buildProducts(await paidOrders(db, range)),
  }),

  expenses: async (db) => ({ currency: CURRENCY, data: (await loadExpenses(db)).map(expenseResource) }),

  inventory: async (db) => buildInventory(await loadMaterials(db)),

  register: async (db, range) => {
    const { from, to } = rangeInfo(range)
    // Session docs are keyed by local date (YYYY-MM-DD)
    const snap = await db.collection('register_sessions')
      .where(FieldPath.documentId(), '>=', from).where(FieldPath.documentId(), '<=', to).get()
    return { from, to, currency: CURRENCY, data: docs(snap).map(registerResource).sort((a, b) => (a.date < b.date ? 1 : -1)) }
  },
}

// ── Entry point (Vercel Node function: api/v1/[resource].js) ───────────────
const send = (res, status, body) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

const fail = (res, status, code, message) => send(res, status, { error: { code, message } })

export const handle = async (req, res, resourceName) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return fail(res, 405, 'method_not_allowed', 'This API is read-only: use GET')
  }
  const name = resourceName || 'index'
  const route = routes[name]
  if (!route) return fail(res, 404, 'not_found', `Unknown resource "${name}". See GET /api/v1`)

  try {
    const db = getDb()
    const key = await authenticate(db, req.headers, SCOPES.financeRead)

    let range = null
    if (RESOURCES[name]?.ranged) {
      const url = new URL(req.url, 'http://localhost')
      range = parseRange({ from: url.searchParams.get('from'), to: url.searchParams.get('to') })
      if (range.error) return fail(res, 400, 'invalid_range', range.error)
    }

    const body = await route(db, range)
    return send(res, 200, { ...body, meta: { key: key.name, generatedAt: new Date().toISOString() } })
  } catch (err) {
    if (err instanceof ApiError || err.code === 'not_configured') {
      return fail(res, err.status || 500, err.code, err.message)
    }
    console.error('POS API error:', err)
    return fail(res, 500, 'server_error', 'Something went wrong reading the café data')
  }
}
