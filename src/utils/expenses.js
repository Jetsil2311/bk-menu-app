// Pure calculation helpers for recurring fixed-expense tracking (Finance → Equilibrio).
// An expense is { name, amount, period: 'monthly' | 'annual', dueDay: 1-31, dueMonth?: 1-12 }.
// dueMonth only applies when period === 'annual'; monthly expenses recur every month on dueDay.

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate()

const clampDueDay = (day, year, monthIndex) =>
  Math.min(Math.max(1, Math.round(Number(day)) || 1), daysInMonth(year, monthIndex))

// Next occurrence of the expense's due date, on or after today.
export const getNextDueDate = (expense) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (expense.period === 'annual') {
    const month = Math.min(Math.max(1, Math.round(Number(expense.dueMonth)) || 1), 12) - 1
    let year = today.getFullYear()
    let due = new Date(year, month, clampDueDay(expense.dueDay, year, month))
    if (due < today) {
      year += 1
      due = new Date(year, month, clampDueDay(expense.dueDay, year, month))
    }
    return due
  }

  let year = today.getFullYear()
  let month = today.getMonth()
  let due = new Date(year, month, clampDueDay(expense.dueDay, year, month))
  if (due < today) {
    month += 1
    if (month > 11) { month = 0; year += 1 }
    due = new Date(year, month, clampDueDay(expense.dueDay, year, month))
  }
  return due
}

// Positive = days from now until due, 0 = due today, negative would only occur
// for same-day edge cases around midnight and is clamped to 0 by getNextDueDate.
export const daysUntilDue = (expense) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = getNextDueDate(expense)
  return Math.round((due - today) / 86400000)
}

// Spreads the expense's amount evenly across the days it actually covers —
// current calendar month length for monthly expenses, 365 for annual ones —
// so the break-even calculator can add every fixed expense onto one "cost per day".
export const dailyEquivalent = (expense) => {
  const amount = Number(expense.amount) || 0
  if (expense.period === 'annual') return amount / 365
  const now = new Date()
  return amount / daysInMonth(now.getFullYear(), now.getMonth())
}

export const monthlyEquivalent = (expense) => {
  const amount = Number(expense.amount) || 0
  return expense.period === 'annual' ? amount / 12 : amount
}

export const annualEquivalent = (expense) => {
  const amount = Number(expense.amount) || 0
  return expense.period === 'annual' ? amount : amount * 12
}

export const computeTotals = (expenses) => ({
  dailyFixedCosts: expenses.reduce((s, e) => s + dailyEquivalent(e), 0),
  monthlyTotal: expenses.reduce((s, e) => s + monthlyEquivalent(e), 0),
  annualTotal: expenses.reduce((s, e) => s + annualEquivalent(e), 0),
  count: expenses.length,
})

// Fixed cost that falls on one specific calendar day: monthly expenses are
// spread over that month's real length, annual ones over that year's.
export const fixedCostForDay = (expenses, date) => {
  const monthDays = daysInMonth(date.getFullYear(), date.getMonth())
  const yearDays = daysInMonth(date.getFullYear(), 1) === 29 ? 366 : 365
  return expenses.reduce((sum, e) => {
    const amount = Number(e.amount) || 0
    return sum + (e.period === 'annual' ? amount / yearDays : amount / monthDays)
  }, 0)
}
