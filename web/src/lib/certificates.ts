/**
 * Certificate PDFs, shown in-site at `/{lang}/certifications/<no>`. The content sync downloads them from the public
 * repo voanhduy1710/Certifications (`<no>. <name>.pdf`) to `public/content/certificates/<no>.pdf` and writes the
 * numbers it downloaded to `content/certificates.json`. No imports, so the sync script, the nav model (client) and the
 * pages (server) can all use it.
 */

/** The sync's list of downloaded certificate numbers, relative to `content/`. */
export const CERTIFICATES_MANIFEST = 'certificates.json'

/** Where a certificate's PDF is stored, relative to `public/content/`. */
export const certificatePdfPath = (no: number) => `certificates/${no}.pdf`

/** The served URL of a certificate's PDF. */
export const certificatePdfUrl = (no: number) => `/content/${certificatePdfPath(no)}`

/** The in-site page that shows a certificate's PDF. */
export const certificateHref = (lang: string, no: number) => `/${lang}/certifications/${no}`

/** A README status that means the certificate is issued (its PDF is then required). */
export const isCompleted = (status: string) => status.trim().toLowerCase() === 'completed'
