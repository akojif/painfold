import { describe, expect, it } from 'vitest'
import { nameDetections, type ModelToken } from '../../core/detect/names'
import { handleNameRequest, type NameModel, type NameResponse } from '../../core/detect/worker-protocol'

// Token sequences as the name model (DistilBERT multilingual NER) returns them.
const tokens = (spec: string): ModelToken[] => spec.split(' ').map((pair) => {
  const [entity, word] = pair.split(':') as [string, string]
  return { entity, word }
})
const values = (text: string, spec: string) => nameDetections(text, tokens(spec)).map(found => `${found.type}:${found.value}`)

describe('nameDetections', () => {
  it('joins word pieces into names and places', () => {
    expect(values('Hi, I\'m Daniel Dunmore from Manchester.', 'B-PER:Daniel I-PER:Du I-PER:##n I-PER:##more B-LOC:Manchester'))
      .toEqual(['NAME:Daniel Dunmore', 'PLACE:Manchester'])
  })

  it('joins a double name the model splits at the hyphen', () => {
    expect(values('Contact: Olivia Fenwick-Lowe, olivia@example.org', 'B-PER:Olivia I-PER:Fe I-PER:##n I-PER:##wick B-PER:Lowe'))
      .toEqual(['NAME:Olivia Fenwick-Lowe'])
  })

  it('extends a name to the whole word when the model leaves out its last piece', () => {
    expect(values('Thanks, Daniel Brindlecombe', 'B-PER:Daniel I-PER:Br I-PER:##ind I-PER:##lec I-PER:##omb'))
      .toEqual(['NAME:Daniel Brindlecombe'])
  })

  it('keeps diacritics and finds names with particles', () => {
    expect(values('Frau Ayşe Yılmaz wartet.', 'B-PER:Ayşe I-PER:Yı I-PER:##lma I-PER:##z')).toEqual(['NAME:Ayşe Yılmaz'])
    expect(values('Sanne van der Berg says hi', 'B-PER:San I-PER:##ne I-PER:van I-PER:der I-PER:Berg')).toEqual(['NAME:Sanne van der Berg'])
  })

  it('ignores organisations and dates, and still finds what follows them', () => {
    expect(values('Painfold GmbH, 2026, Anna aus Wien', 'B-ORG:Pain I-ORG:##fold I-ORG:GmbH B-DATE:2026 B-PER:Anna B-LOC:Wien'))
      .toEqual(['NAME:Anna', 'PLACE:Wien'])
  })

  it('keeps separate names apart when other words are between them', () => {
    expect(values('Anna und Ben', 'B-PER:Anna B-PER:Ben')).toEqual(['NAME:Anna', 'NAME:Ben'])
  })

  it('finds each entity once, in order, and never overlapping', () => {
    const found = nameDetections('Brindlecombe and Brindlecombe', tokens('B-PER:Brind B-PER:##lecombe B-PER:Brind'))
    expect(found.map(f => [f.start, f.end])).toEqual([[0, 12], [17, 29]])
  })

  it('skips an entity that cannot be found in the text instead of guessing', () => {
    expect(values('Hallo zusammen', 'B-PER:Nobody')).toEqual([])
  })
})

describe('handleNameRequest', () => {
  const fakeModel = (labelled: string[]): NameModel => ({
    fits: () => true,
    async load(onProgress) {
      onProgress(50)
      onProgress(100)
    },
    async label(text) {
      labelled.push(text)
      return text.includes('Anna') ? tokens('B-PER:Anna') : []
    },
  })

  it('loads the model on its own, reporting the bytes downloaded', async () => {
    const sent: NameResponse[] = []
    await handleNameRequest({ kind: 'load', id: 3, ortPath: '/ort/x/' }, response => sent.push(response), fakeModel([]))
    expect(sent).toEqual([{ kind: 'model-progress', id: 3, loaded: 50 }, { kind: 'model-progress', id: 3, loaded: 100 }, { kind: 'loaded', id: 3 }])
  })

  it('reports the model download, then finds names item by item, with progress by unit', async () => {
    const sent: NameResponse[] = []
    const items = [{ id: 'a', text: 'Anna rief an', unit: 'r0' }, { id: 'b', text: 'Alles gut', unit: 'r1' }, { id: 'c', text: '2026-01-04', unit: 'r1' }]
    await handleNameRequest({ kind: 'names', id: 4, items, ortPath: '/ort/x/' }, response => sent.push(response), fakeModel([]))
    expect(sent.filter(r => r.kind === 'model-progress')).toEqual([{ kind: 'model-progress', id: 4, loaded: 50 }, { kind: 'model-progress', id: 4, loaded: 100 }])
    expect(sent.filter(r => r.kind === 'progress').at(-1)).toEqual({ kind: 'progress', id: 4, done: 2, total: 2 })
    expect(sent.at(-1)).toEqual({ kind: 'result', id: 4, items: [{ id: 'a', detections: [{ type: 'NAME', start: 0, end: 4, value: 'Anna' }] }] })
  })

  it('labels each distinct text once and skips cells without letters', async () => {
    const labelled: string[] = []
    const items = ['Anna rief an', 'Anna rief an', '12345', ''].map((text, index) => ({ id: String(index), text }))
    await handleNameRequest({ kind: 'names', id: 1, items, ortPath: '/ort/x/' }, () => {}, fakeModel(labelled))
    expect(labelled).toEqual(['Anna rief an'])
  })

  it('reports a failure without echoing the text', async () => {
    const sent: NameResponse[] = []
    const failing: NameModel = {
      fits: () => true,
      load: async () => {
        throw new Error('Model files missing')
      },
      label: async () => [],
    }
    await handleNameRequest({ kind: 'names', id: 2, items: [{ id: 'a', text: 'Anna aus Wien' }], ortPath: '/ort/x/' }, response => sent.push(response), failing)
    expect(sent).toEqual([{ kind: 'error', id: 2, message: 'Model files missing' }])
  })
})

describe('long texts', () => {
  // Like the real model, this one reads only its first 100 characters and ignores the rest.
  const LIMIT = 100
  const reading: NameModel = {
    fits: text => text.length <= LIMIT,
    async load() {},
    async label(text) {
      const read = text.slice(0, LIMIT)
      return [...read.matchAll(/\b(?:Anna|Ben|Clara)\b/g)].map(match => ({ entity: 'B-PER', word: match[0] }))
    },
  }
  const filler = 'Der Export dauert seit dem Update ewig und bricht manchmal ab. '

  it('finds names early, in the middle and late in a text far longer than the model reads', async () => {
    const text = `Anna schreibt: ${filler.repeat(4)}Ben hat das auch gesehen. ${filler.repeat(4)}Liebe Grüße, Clara`
    const sent: NameResponse[] = []
    await handleNameRequest({ kind: 'names', id: 1, items: [{ id: 'a', text }], ortPath: '/ort/x/' }, response => sent.push(response), reading)
    const result = sent.at(-1)
    expect(result?.kind).toBe('result')
    const found = result?.kind === 'result' ? result.items[0]!.detections.map(d => `${d.type}:${d.value}@${text.slice(d.start, d.end) === d.value}`) : []
    expect(found).toEqual(['NAME:Anna@true', 'NAME:Ben@true', 'NAME:Clara@true'])
  })
})
