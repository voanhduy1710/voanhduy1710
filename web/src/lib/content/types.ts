export type Lang = 'en' | 'vi'
export const LANGS: readonly Lang[] = ['en', 'vi']

export const SECTION_IDS = [
  'header',
  'summary',
  'tech-stack',
  'skills',
  'experience',
  'projects',
  'languages',
  'education',
  'contact',
  'certifications',
  'previews',
] as const

export type SectionId = (typeof SECTION_IDS)[number]

export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; children: Inline[] }

export type HeaderData = {
  name: string
  title: string
  links: { label: string; href: string }[]
  /** From the invisible `<!-- site: status = ... -->` line; undefined when absent. */
  status?: string
  /** From the invisible `<!-- site: roles = a | b -->` line; empty when absent. */
  roles: string[]
}

export type TechItem = { name: string; logo: string }

export type SkillRow = { category: string; tools: string[] }

export type LanguageItem = { name: string; level: string }

export type EducationData = { school: string; degrees: { text: Inline[]; note?: string }[] }[]

export type ContactItem = { label: string; value: Inline[] }

/** `no` is the README table's № column (also the number its PDF in the Certifications repo starts with). */
export type Certification = { no: number; name: string; href?: string; status: string }

export type ExperienceEntry = { company: string; role: string; period: string; location: string; bullets: Inline[][] }

/** `alt` is the README's image alt text (usually the real tech name, e.g. `Supabase` for a `Database` badge). */
export type Badge = { label: string; message: string; color: string; href?: string; alt?: string }

export type Project = {
  slug: string
  group: string
  title: string
  repoUrl: string
  liveUrl?: string
  liveLabel?: string
  note?: string
  badges: Badge[]
  description: Inline[][]
  bullets: Inline[][]
}

export type PreviewSet = { slug: string; images: { src: string; alt: string }[] }
