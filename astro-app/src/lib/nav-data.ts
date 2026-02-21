export interface NavLink {
  label: string;
  href: string;
  icon?: string;
  external?: boolean;
  activePage?: string;
}

export const PUBLIC_NAV_LINKS: NavLink[] = [
  { label: 'Extract', href: '/extract/url' },
  { label: 'Guides', href: '/docs/get-html' },
  { label: 'Sites', href: '/sites' },
  { label: 'API', href: '/docs/api' },
  { label: 'My Hauls', href: '/hauls', icon: 'bi-box-seam' },
  { label: 'Extension', href: '/extension', icon: 'bi-puzzle' },
  { label: 'Admin', href: '/admin', icon: 'bi-gear' },
  { label: 'GitHub', href: 'https://github.com/RealEstateWebTools/property_web_scraper', icon: 'bi-github', external: true },
];

export const ADMIN_NAV_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '/admin', icon: 'bi-speedometer2', activePage: 'dashboard' },
  { label: 'Logs', href: '/admin/logs', icon: 'bi-journal-text', activePage: 'logs' },
  { label: 'Extractions', href: '/admin/extractions', icon: 'bi-collection', activePage: 'extractions' },
  { label: 'Config', href: '/admin/config', icon: 'bi-sliders', activePage: 'config' },
  { label: 'Storage', href: '/admin/storage', icon: 'bi-database', activePage: 'storage' },
  { label: 'Scrapers', href: '/admin/scrapers', icon: 'bi-cpu', activePage: 'scrapers' },
  { label: 'Health', href: '/admin/scraper-health', icon: 'bi-heart-pulse', activePage: 'scraper-health' },
  { label: 'Exports', href: '/admin/exports', icon: 'bi-download', activePage: 'exports' },
  { label: 'AI Map', href: '/admin/ai-map', icon: 'bi-magic', activePage: 'ai-map' },
];

export const ADMIN_FOOTER_LINKS: NavLink[] = [
  { label: 'Back to Site', href: '/', icon: 'bi-arrow-left' },
  { label: 'Logout', href: '/admin/logout', icon: 'bi-box-arrow-right' },
];
