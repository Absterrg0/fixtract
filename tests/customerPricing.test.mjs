import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commissionedAmount, commissionedExtraCost, commissionedExtraCostTotal } from '../lib/customerPricing.ts'

// Same cases as fixera-server src/tests/utils/customerPricing.test.ts, so the
// price shown here is the one the server charges.
const commission = 9.5155
const unit = { pricingType: 'unit', unitAmount: 15, quantity: 30 }

test('a unit package costs quantity x the whole-cent unit price', () => {
  assert.equal(commissionedAmount(450, commission), 492.82)
  assert.equal(commissionedAmount(450, commission, unit), 492.9)
  assert.equal(commissionedAmount(500, commission, unit), 492.9 + 54.76)
})

test('unit extra costs are priced per unit, the rest as a whole', () => {
  const costs = [
    { type: 'unit_adjustment', estimatedUnits: 30, actualUnits: 35, unitPrice: 15, amount: 75 },
    { type: 'condition', amount: 50 },
  ]
  assert.equal(commissionedExtraCost(costs[0], commission), 82.15)
  assert.equal(commissionedExtraCostTotal(costs, 125, commission), 136.91)
  assert.equal(commissionedExtraCost({ type: 'unit_adjustment', estimatedUnits: 30, actualUnits: 27.5, unitPrice: 15, amount: -37.5 }, commission), -41.08)
  assert.equal(commissionedExtraCostTotal(costs, 40, commission), 43.81)
})
