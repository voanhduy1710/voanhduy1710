// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContactSection } from '@/components/home/ContactSection'
import { ui } from '@/lib/i18n/ui'

afterEach(cleanup)

const links = [
  { label: 'GitHub', href: 'https://github.com/voanhduy1710' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/duy-v-983894369/' },
  { label: 'Email', href: 'mailto:voanhduy1710@gmail.com' },
  { label: 'CV_EN (PDF)', href: '/content/CV_Vo%20Anh%20Duy_EN.pdf' },
  { label: 'CV_VN (PDF)', href: '/content/CV_Vo%20Anh%20Duy_VN.pdf' },
]

function renderSection(lang: 'en' | 'vi') {
  const t = ui(lang)
  const formLabels = {
    title: t.formTitle, name: t.formName, email: t.formEmail, company: t.formCompany, message: t.formMessage,
    optional: t.formOptional, namePlaceholder: t.formNamePlaceholder, emailPlaceholder: t.formEmailPlaceholder,
    companyPlaceholder: t.formCompanyPlaceholder, messagePlaceholder: t.formMessagePlaceholder, send: t.formSend,
    sending: t.formSending, sent: t.formSent, error: t.formError, invalid: t.formInvalid, tooFast: t.formTooFast,
    stale: t.formStale, rateLimited: t.formRateLimited, fallback: t.formFallback, orEmail: t.formOrEmail,
  }
  return render(
    <ContactSection lang={lang} labels={{ title: 'Contact', links: 'Links' }} formLabels={formLabels} contact={[]} links={links} />,
  )
}

describe('ContactSection', () => {
  it('Links row: GitHub, LinkedIn and both CVs; no Email chip', () => {
    renderSection('en')
    const list = screen.getByRole('heading', { name: 'Links' }).closest('section')!.querySelector('ul')!
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['GitHub', 'LinkedIn', 'CV_EN (PDF)', 'CV_VN (PDF)'])
    expect(list.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('message placeholder is "Leave a message" / "Để lại lời nhắn"', () => {
    renderSection('en')
    expect(screen.getByLabelText(/Message/).getAttribute('placeholder')).toBe('Leave a message')
    cleanup()
    renderSection('vi')
    expect(document.querySelector('#contact-message')!.getAttribute('placeholder')).toBe('Để lại lời nhắn')
  })
})
