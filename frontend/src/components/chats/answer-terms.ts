export type TermSource = 'paper' | 'background'

export type AnswerTerm = {
  term: string
  plain: string
  source: TermSource
}

const TERM_MARK = /\[\[([^\]\n]{1,80})\]\]/g
const CODE_FENCE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g

function parseTermArray(raw: string): AnswerTerm[] {
  let data: unknown
  try {
    data = JSON.parse(raw.trim())
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  const terms: AnswerTerm[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const term = typeof record.term === 'string' ? record.term.trim() : ''
    const plain = typeof record.plain === 'string' ? record.plain.trim() : ''
    const source =
      record.source === 'background'
        ? 'background'
        : record.source === 'paper'
          ? 'paper'
          : null
    if (!term || !plain || !source) continue
    terms.push({ term, plain, source })
  }
  return terms
}

/** Drop glossary fences from visible markdown. An unfinished trailing fence is hidden while streaming. */
export function splitAnswerTerms(content: string): {
  prose: string
  terms: AnswerTerm[]
} {
  let terms: AnswerTerm[] = []
  const complete = /```terms[^\n]*\r?\n([\s\S]*?)```/gi
  let prose = content.replace(complete, (_match, body: string) => {
    const parsed = parseTermArray(body)
    if (parsed.length > 0) terms = parsed
    return ''
  })
  prose = prose.replace(/```terms[^\n]*\r?\n[\s\S]*$/i, '')
  prose = prose.replace(/\n{3,}/g, '\n\n').trimEnd()
  return { prose, terms }
}

function mapOutsideCodeFences(
  source: string,
  mapText: (segment: string) => string,
): string {
  const fence = new RegExp(CODE_FENCE.source, 'g')
  let out = ''
  let last = 0
  for (const match of source.matchAll(fence)) {
    const index = match.index
    out += mapText(source.slice(last, index))
    out += match[0]
    last = index + match[0].length
  }
  out += mapText(source.slice(last))
  return out
}

export function toPlainAnswer(content: string): string {
  const { prose } = splitAnswerTerms(content)
  return mapOutsideCodeFences(prose, (segment) =>
    segment.replace(TERM_MARK, (_match, term: string) => term.trim()),
  ).trim()
}

export function prepareAnswerMarkdown(
  prose: string,
  terms: AnswerTerm[],
): string {
  const known = new Set(terms.map((entry) => entry.term.toLowerCase()))
  return mapOutsideCodeFences(prose, (segment) =>
    segment.replace(TERM_MARK, (_match, raw: string) => {
      const term = raw.trim()
      if (!known.has(term.toLowerCase())) return term
      return `[${term}](inquiro-term:${encodeURIComponent(term)})`
    }),
  )
}

export function termFromHref(href: string | undefined): string | null {
  if (!href) return null
  const marker = 'inquiro-term:'
  const index = href.indexOf(marker)
  if (index === -1) return null
  const encoded = href.slice(index + marker.length).split(/[\s#]/)[0] ?? ''
  if (!encoded) return null
  try {
    return decodeURIComponent(encoded)
  } catch {
    return encoded
  }
}

export function sourceLabel(source: TermSource): string {
  return source === 'background' ? 'Background' : 'From the paper'
}
