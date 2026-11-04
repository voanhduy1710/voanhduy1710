import { PageIcon } from './shell/icons'

export type CertificateViewLabels = { openOriginal: string; downloadPdf: string; pdfFallback: string; openPdf: string }

const button =
  'flex h-[1.45rem] shrink-0 items-center rounded-[3px] px-[0.52rem] text-(length:--ui-text-sm) whitespace-nowrap hover:bg-vsc-hover'

/**
 * A certificate PDF as an editor: a small toolbar (name, status, "Open original" when the README links it, "Download
 * PDF"), then the browser's own PDF viewer filling the editor. Phones (and browsers that cannot show a PDF inline)
 * get a plain link instead. Server-rendered; no client JavaScript.
 */
export function CertificateView({
  name,
  status,
  href,
  pdfUrl,
  fileName,
  labels,
}: {
  name: string
  status: string
  href?: string
  pdfUrl: string
  /** Suggested name of the downloaded file. */
  fileName: string
  labels: CertificateViewLabels
}) {
  return (
    <div className="flex h-full min-h-0 flex-col font-ui text-(length:--ui-text)">
      <div className="flex min-h-[1.9rem] shrink-0 flex-wrap items-center gap-x-[0.62rem] gap-y-1 border-b border-vsc-border bg-vsc-editor px-[0.83rem] py-1 text-vsc-text">
        <PageIcon icon="pdf" />
        <h1 className="min-w-0 truncate font-normal text-white">{name}</h1>
        <span className="shrink-0 rounded-[3px] bg-white/8 px-[0.42rem] text-(length:--ui-text-sm) text-vsc-muted">{status}</span>
        <span className="ml-auto flex shrink-0 items-center gap-[0.2rem]">
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`${button} text-vsc-link`}>
              {labels.openOriginal} ↗
            </a>
          )}
          <a href={pdfUrl} download={fileName} className={`${button} bg-vsc-accent text-white hover:bg-[#1f8ad2]`}>
            {labels.downloadPdf}
          </a>
        </span>
      </div>
      <iframe
        src={`${pdfUrl}#view=FitH`}
        title={name}
        className="min-h-0 w-full flex-1 border-0 bg-[#525659] max-md:hidden"
      />
      <p className="px-5 py-8 text-vsc-muted md:hidden">
        {labels.pdfFallback}{' '}
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-vsc-link underline">
          {labels.openPdf}
        </a>
      </p>
    </div>
  )
}
