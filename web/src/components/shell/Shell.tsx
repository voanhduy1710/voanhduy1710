import type { ReactNode } from 'react'
import type { HeaderData, Lang } from '@/lib/content/types'
import { ui } from '@/lib/i18n/ui'
import type { Nav } from '@/lib/nav'
import type { PreloadTier } from '@/lib/preload/plan'
import { ActivityBar } from './ActivityBar'
import { activityLinks } from './activityLinks'
import { Explorer } from './Explorer'
import { PreloadScheduler } from './PreloadScheduler'
import { ReadingPositionRestore } from './ReadingPositionRestore'
import { SidebarProvider } from './SidebarState'
import { SIDEBAR_WIDTH_BOOT } from './sidebarWidth'
import { StatusBar } from './StatusBar'
import { Tabs } from './Tabs'
import { TileBackground } from './TileBackground'
import { TitleBar } from './TitleBar'

/** The VS Code-style frame around every page. Every chrome element is hidden when printing. */
export function Shell({
  lang,
  nav,
  header,
  cvHref,
  preload = [],
  children,
}: {
  lang: Lang
  nav: Nav
  header: HeaderData
  cvHref: string
  /** Background preload order (lib/preload/plan.ts). */
  preload?: PreloadTier[]
  children: ReactNode
}) {
  const t = ui(lang)
  return (
    <SidebarProvider>
      {/* Applies the stored explorer width before the first paint (no jump after hydration). */}
      <script dangerouslySetInnerHTML={{ __html: SIDEBAR_WIDTH_BOOT }} />
      <div className="flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
        <TitleBar
          name={header.name}
          labels={{
            menuBar: t.menuBar,
            portfolio: t.portfolio,
            toggleSidebar: t.toggleSidebar,
            togglePanel: t.togglePanel,
            toggleSecondarySidebar: t.toggleSecondarySidebar,
            minimize: t.minimize,
            restore: t.restore,
            closeWindow: t.closeWindow,
          }}
        />
        <div className="relative flex min-h-0 flex-1 print:block">
          <ActivityBar
            lang={lang}
            links={activityLinks(header, nav, cvHref, t.downloadCv)}
            labels={{
              bar: t.activityBar,
              explorer: t.actExplorer,
              search: t.actSearch,
              sourceControl: t.actSourceControl,
              runDebug: t.actRunDebug,
              extensions: t.actExtensions,
              github: t.actGithub,
              accounts: t.actAccounts,
              settings: t.actSettings,
              language: t.language,
              switchToEn: t.switchToEn,
              switchToVi: t.switchToVi,
            }}
          />
          <Explorer
            lang={lang}
            nav={nav}
            rootName="voanhduy1710"
            labels={{
              title: t.explorer,
              language: t.language,
              switchToEn: t.switchToEn,
              switchToVi: t.switchToVi,
              openEditors: t.openEditors,
              outline: t.outline,
              timeline: t.timeline,
              scripts: t.scripts,
              outlineEmpty: t.outlineEmpty,
              timelineEmpty: t.timelineEmpty,
              scriptsEmpty: t.scriptsEmpty,
              closeTab: t.closeTab,
              searchPlaceholder: t.searchPlaceholder,
              noResults: t.noResults,
              folderWorks: t.folderWorks,
              folderBi: t.folderBi,
              folderCertifications: t.folderCertifications,
              resizeExplorer: t.resizeExplorer,
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col bg-vsc-editor print:block print:bg-transparent">
            <Tabs
              nav={nav}
              labels={{
                openEditors: t.openEditors,
                closeTab: t.closeTab,
                openChanges: t.openChanges,
                splitEditor: t.splitEditor,
                moreActions: t.moreActions,
              }}
            />
            <div className="relative min-h-0 flex-1 print:block">
              <TileBackground />
              <main id="editor" className="relative h-full overflow-auto print:h-auto print:overflow-visible">
                {children}
              </main>
              <ReadingPositionRestore />
            </div>
          </div>
        </div>
        <PreloadScheduler tiers={preload} />
        <StatusBar nav={nav} labels={{ spaces: t.spaces, noProblems: t.noProblems, goLive: t.goLive }} />
      </div>
    </SidebarProvider>
  )
}
