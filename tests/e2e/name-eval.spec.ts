import { itemsOf } from '../../scripts/eval'
import { namesInPage } from '../../scripts/eval-browser'
import { readStoredDetections, STORED_SETS, storedFormat, type StoredSet } from '../../scripts/name-detections'
import { NAME_MODEL } from '../../deploy/model'
import { expect, test } from './fixtures'

// The stored detections (data/eval/name-detections.json, written by
// `npm run eval:names -- --set <set> --save`) are what the published name
// numbers are computed from. This reruns the built worker on the same texts
// and fails if it finds anything different, so the numbers cannot go stale.
// Pass or fail only: it is not used to tune anything.
const stored = readStoredDetections()

test('the stored name detections are for the current model', () => {
  expect(stored?.model).toBe(NAME_MODEL.revision)
})

for (const set of Object.keys(STORED_SETS) as StoredSet[]) {
  test(`the name model still finds exactly the stored names and places (${set})`, async ({ page }) => {
    test.skip(!stored?.sets[set], `no stored detections for ${set}`)
    test.setTimeout(180_000)
    const items = itemsOf(set)
    await page.goto('/')
    const run = await namesInPage(page, items.map(item => item.text), { firstNames: STORED_SETS[set].firstNames })
    expect(run.threads).toBe(true)
    expect(storedFormat(items.map(item => item.id), run.detections)).toEqual(stored!.sets[set])
  })
}
