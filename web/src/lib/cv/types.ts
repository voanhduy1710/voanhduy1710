import type { Inline, Lang } from '../content/types'

/**
 * The CV model, read from `web/public/cv/cv.en.yaml` / `cv.vi.yaml` (deployed with the site, no sync). One shared
 * template (`components/cv/CvDocument.tsx`) renders both languages. Free-text fields (summary, bullets, project
 * descriptions) are inline markdown (`**bold**`, `*italic*`, `[text](https://...)`), parsed into the site's inline model.
 */
export type CvContact = {
  email?: string
  phone?: string
  location?: string
  /** Full https:// URLs; the CV shows them without the scheme (`github.com/x`). */
  website?: string
  github?: string
  linkedin?: string
}

export type CvSkillCategory = { category: string; items: string[] }

export type CvExperience = { role: string; company: string; location?: string; period: string; bullets: Inline[][] }

export type CvProject = { name: string; link?: string; tech: string[]; description: Inline[] }

export type CvDegree = { degree: string; detail?: string; period?: string; note?: string }

export type CvEducation = { school: string; location?: string; degrees: CvDegree[] }

export type CvCertification = { name: string; issuer?: string; link?: string; status: string }

export type CvLanguage = { name: string; level: string }

export type CvModel = {
  lang: Lang
  name: string
  title: string
  contact: CvContact
  summary: Inline[][]
  skills: CvSkillCategory[]
  experience: CvExperience[]
  /** Optional sections: empty when the YAML leaves them out. */
  projects: CvProject[]
  education: CvEducation[]
  certifications: CvCertification[]
  languages: CvLanguage[]
}
