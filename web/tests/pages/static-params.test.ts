import { afterAll, beforeAll, describe, expect, it, vi as vitest } from 'vitest'

/**
 * The page modules are imported once per describe, in beforeAll with its own generous timeout: a cold import
 * transforms the whole page tree (Next, components, the content parser) and took over 5 s, the default *test*
 * timeout, when the machine was busy (the flaky failure seen in Task 15e/15f).
 */
const IMPORT_TIMEOUT = 60_000

const SLUGS = [
  'atino-booking',
  'caro-app',
  'qandastudy-booking',
  'atino-approval-web',
  'atino-approval-api',
  'atino-workspace',
  'data-analyst-portfolio',
]

describe('projects/[slug] generateStaticParams', () => {
  const previous = process.env.CONTENT_DIR
  let generateStaticParams: typeof import('@/app/[lang]/projects/[slug]/page').generateStaticParams

  beforeAll(async () => {
    // loadContent reads README.md + READMEVN.md from CONTENT_DIR (default `content`, cwd-relative).
    process.env.CONTENT_DIR = 'tests/fixtures'
    vitest.resetModules()
    ;({ generateStaticParams } = await import('@/app/[lang]/projects/[slug]/page'))
  }, IMPORT_TIMEOUT)

  afterAll(() => {
    if (previous === undefined) delete process.env.CONTENT_DIR
    else process.env.CONTENT_DIR = previous
    vitest.resetModules()
  })

  it('returns every { lang, slug } pair: 2 languages x 7 projects', async () => {
    const params = await generateStaticParams()
    expect(params).toHaveLength(14)
    expect(params).toContainEqual({ lang: 'vi', slug: 'caro-app' })
    for (const lang of ['en', 'vi']) {
      expect(params.filter((p) => p.lang === lang).map((p) => p.slug)).toEqual(SLUGS)
    }
  })

  it('narrows to the parent [lang] when Next passes it', async () => {
    const params = await generateStaticParams({ params: { lang: 'vi' } })
    expect(params).toEqual(SLUGS.map((slug) => ({ lang: 'vi', slug })))
  })
})

describe('certifications/[no] generateStaticParams', () => {
  const previous = process.env.CONTENT_DIR
  let generateStaticParams: typeof import('@/app/[lang]/certifications/[no]/page').generateStaticParams

  beforeAll(async () => {
    // tests/fixtures/certificates.json lists PDFs 1-7; README № 8 (in progress) has none.
    process.env.CONTENT_DIR = 'tests/fixtures'
    vitest.resetModules()
    ;({ generateStaticParams } = await import('@/app/[lang]/certifications/[no]/page'))
  }, IMPORT_TIMEOUT)

  afterAll(() => {
    if (previous === undefined) delete process.env.CONTENT_DIR
    else process.env.CONTENT_DIR = previous
    vitest.resetModules()
  })

  it('returns every { lang, no } of a certification with a synced PDF', async () => {
    const params = await generateStaticParams()
    const nos = ['1', '2', '3', '4', '5', '6', '7']
    expect(params).toEqual([...nos.map((no) => ({ lang: 'en', no })), ...nos.map((no) => ({ lang: 'vi', no }))])
    expect(await generateStaticParams({ params: { lang: 'vi' } })).toEqual(nos.map((no) => ({ lang: 'vi', no })))
  })
})
