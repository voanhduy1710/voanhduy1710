import { notFound } from 'next/navigation'

// Any unknown path under /{lang} renders [lang]/not-found.tsx inside the shell (instead of Next's bare 404).
// It always throws, so there is nothing for instant-navigation validation to check.
export const instant = false

export default function UnknownPage() {
  notFound()
}
