// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContactForm, type ContactFormLabels } from '@/components/home/ContactForm'

const labels: ContactFormLabels = {
  title: 'Send a message',
  name: 'Name',
  email: 'Email',
  company: 'Company',
  message: 'Message',
  optional: 'optional',
  namePlaceholder: '',
  emailPlaceholder: '',
  companyPlaceholder: '',
  messagePlaceholder: '',
  send: 'Send',
  sending: 'Sending',
  sent: 'Sent',
  error: 'Error',
  invalid: 'Invalid',
  tooFast: 'Too fast',
  stale: 'Please reload the page',
  rateLimited: 'Rate limited',
  fallback: 'Fallback',
  orEmail: 'Or email',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function fillAndSend() {
  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Jane' } })
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText(/Message/), { target: { value: 'Hello there, a role for you.' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!)
}

describe('ContactForm', () => {
  it('sends how long the form was open (monotonic clock), not an absolute time', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000)
    // A wildly wrong wall clock must not matter.
    vi.spyOn(Date, 'now').mockReturnValue(0)
    const fetchMock = answer(200, { ok: true })
    render(<ContactForm lang="en" labels={labels} />)
    now.mockReturnValue(9_400.6)
    fillAndSend()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.elapsedMs).toBe(8_401)
    expect(body).not.toHaveProperty('startedAt')
    expect(await screen.findByText('Sent')).toBeTruthy()
  })

  it('a `stale` answer asks the visitor to reload the page', async () => {
    answer(400, { error: 'stale' })
    render(<ContactForm lang="en" labels={labels} />)
    fillAndSend()
    expect(await screen.findByText('Please reload the page')).toBeTruthy()
  })

  it('a `too_fast` answer still shows the wait message', async () => {
    answer(400, { error: 'too_fast' })
    render(<ContactForm lang="en" labels={labels} />)
    fillAndSend()
    expect(await screen.findByText('Too fast')).toBeTruthy()
  })
})
