import { describe, it, expect } from 'vitest'
import {
  emptyReviewState, withOrder, withShown, withReviewed, shouldInvite, SNOOZE_DAYS,
} from './reviewPrompt'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-01T18:00:00').getTime()

describe('review invitation timing', () => {
  it('never invites on the first order', () => {
    expect(shouldInvite(withOrder(emptyReviewState()), NOW)).toBe(false)
  })

  it('invites from the second order on', () => {
    const state = withOrder(withOrder(emptyReviewState()))
    expect(shouldInvite(state, NOW)).toBe(true)
  })

  it('stays quiet for the snooze period after being shown', () => {
    const shown = withShown(withOrder(withOrder(emptyReviewState())), NOW)
    expect(shouldInvite(withOrder(shown), NOW + (SNOOZE_DAYS - 1) * DAY)).toBe(false)
    expect(shouldInvite(withOrder(shown), NOW + SNOOZE_DAYS * DAY)).toBe(true)
  })

  it('never invites again after the customer went to review', () => {
    const reviewed = withReviewed(withOrder(withOrder(emptyReviewState())))
    expect(shouldInvite(withOrder(reviewed), NOW + 365 * DAY)).toBe(false)
  })
})
