// Runs the real name model (the files the build serves from public/models/)
// through Painfold's post-processing, in Node. It checks that the pinned model,
// its tokenizer and core/detect/names.ts work together. Needs `npm run models`
// first; CI runs it with `npm run test:model` after the build.
//
// Node runs the model with ONNX Runtime's native CPU build, whose int8 kernels
// differ between platforms (a place or part of a double name can be labelled on
// macOS and not on Linux x64). So these tests only check what holds everywhere;
// the joining rules are unit-tested with real token sequences, and accuracy is
// measured with the WebAssembly build that browsers use.
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

const names = async (text: string) => nameDetections(text, await classify(text, { ignore_labels: ['O'] }) as ModelToken[]).map(found => `${found.type}:${found.value}`)

describe('the served name model', () => {
  it('finds German and English names, with diacritics, in full', async () => {
    expect(await names('Danke an Ayşe Yılmaz aus Wien, sehr hilfsbereit!')).toContain('NAME:Ayşe Yılmaz')
    expect(await names('Hi, I am Daniel Brindlecombe and I cannot log in.')).toContain('NAME:Daniel Brindlecombe')
  })

  it('finds nothing in feedback without names', async () => {
    expect(await names('Der Export dauert seit dem Update ewig.')).toEqual([])
  })
})
