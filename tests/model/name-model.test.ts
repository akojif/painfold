// Runs the real name model (the files the build serves from public/models/)
// through Painfold's post-processing, in Node. It checks that the pinned model,
// its tokenizer and core/detect/names.ts work together. Needs `npm run models`
// first; CI runs it with `npm run test:model` after the build.
//
// Node runs the model with ONNX Runtime's native CPU build, whose int8 kernels
// depend on the processor: on one GitHub runner "Daniel Brindlecombe" was found,
// on another nothing at all. So these tests check the plumbing, not what the
// model finds; the joining rules are unit-tested with real token sequences, and
// recall is measured with the WebAssembly build that browsers use, which gives
// the same results on every machine.
import { env, pipeline } from '@huggingface/transformers'
import { beforeAll, describe, expect, it } from 'vitest'
import { nameDetections, type ModelToken } from '../../core/detect/names'
import { NAME_MODEL } from '../../deploy/model'

type Classify = (text: string, options: { ignore_labels: string[] }) => Promise<unknown>
let classify: Classify

beforeAll(async () => {
  env.allowRemoteModels = false
  env.localModelPath = 'public/models/'
  classify = await pipeline('token-classification', `${NAME_MODEL.id}/${NAME_MODEL.revision}`, { dtype: NAME_MODEL.dtype }) as unknown as Classify
}, 60_000)

const detect = async (text: string) => nameDetections(text, await classify(text, { ignore_labels: ['O'] }) as ModelToken[])

describe('the served name model', () => {
  it('loads, and its labels become detections that point at the text', async () => {
    let count = 0
    for (const text of ['Danke an Ayşe Yılmaz aus Wien, sehr hilfsbereit!', 'Hi, I am Daniel Brindlecombe and I cannot log in.']) {
      for (const found of await detect(text)) {
        expect(['NAME', 'PLACE']).toContain(found.type)
        expect(text.slice(found.start, found.end)).toBe(found.value)
        count++
      }
    }
    // Something is found in two sentences this clear; nothing at all means the files or the tokenizer are broken.
    expect(count).toBeGreaterThan(0)
  })

  it('finds nothing in feedback without names', async () => {
    expect(await detect('Der Export dauert seit dem Update ewig.')).toEqual([])
  })
})
