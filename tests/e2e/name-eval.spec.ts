import { readItems, NAMES_PATH } from '../../scripts/eval'
import { namesInPage, readStoredDetections, storedFormat } from '../../scripts/eval-browser'
import { NAME_MODEL } from '../../deploy/model'
import { expect, test } from './fixtures'

// The stored detections (data/eval/name-detections.json, written by
// `npm run eval:names -- --save`) are what the published name numbers are
// computed from. This reruns the built worker on the same texts and fails if
// it finds anything different, so the numbers cannot go stale. Pass or fail
// only: it is not used to tune anything.
const stored = readStoredDetections()

test('the stored name detections are for the current model', () => {
  expect(stored?.model).toBe(NAME_MODEL.revision)
})

for (const split of ['dev', 'test'] as const) {
  test(`the name model still finds exactly the stored names and places (${split} split)`, async ({ page }) => {
    test.skip(!stored?.splits[split], `no stored detections for the ${split} split yet`)
    test.setTimeout(120_000)
    const items = readItems(NAMES_PATH, split)
    await page.goto('/')
    const run = await namesInPage(page, items.map(item => item.text))
    expect(run.threads).toBe(true)
    expect(storedFormat(items.map(item => item.id), run.detections)).toEqual(stored!.splits[split])
  })
}
