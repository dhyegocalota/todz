export enum SiteIcon {
  Favicon = 'favicon',
  Vector = 'vector',
  AppleTouch = 'apple-touch',
  Icon192 = 'icon-192',
  Icon512 = 'icon-512',
  Maskable192 = 'maskable-192',
  Maskable512 = 'maskable-512',
}

export enum IconPurpose {
  Any = 'any',
  Maskable = 'maskable',
}

export type SiteIconFile = { path: string; size: number | null; mediaType: string; purpose: IconPurpose };

export const SITE_ICONS: Record<SiteIcon, SiteIconFile> = {
  [SiteIcon.Favicon]: { path: '/favicon.ico', size: 48, mediaType: 'image/x-icon', purpose: IconPurpose.Any },
  [SiteIcon.Vector]: { path: '/icon.svg', size: null, mediaType: 'image/svg+xml', purpose: IconPurpose.Any },
  [SiteIcon.AppleTouch]: { path: '/apple-touch-icon.png', size: 180, mediaType: 'image/png', purpose: IconPurpose.Any },
  [SiteIcon.Icon192]: { path: '/icon-192.png', size: 192, mediaType: 'image/png', purpose: IconPurpose.Any },
  [SiteIcon.Icon512]: { path: '/icon-512.png', size: 512, mediaType: 'image/png', purpose: IconPurpose.Any },
  [SiteIcon.Maskable192]: { path: '/icon-maskable-192.png', size: 192, mediaType: 'image/png', purpose: IconPurpose.Maskable },
  [SiteIcon.Maskable512]: { path: '/icon-maskable-512.png', size: 512, mediaType: 'image/png', purpose: IconPurpose.Maskable },
};

export const OPEN_GRAPH_IMAGE = {
  path: '/og/todz.png',
  width: 1200,
  height: 630,
  mediaType: 'image/png',
  alt: 'todz: your tasks, shared with your agents, shown as a Mac window with a task list',
};
