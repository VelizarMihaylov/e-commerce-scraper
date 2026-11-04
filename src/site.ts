export const TARGET_URL = 'https://webscraper.io/test-sites/e-commerce/static';

export function normalizeCatalogueUrl(
  href: string,
  pageUrl: string,
  rootUrl = TARGET_URL,
): string | null {
  let url: URL;
  try {
    url = new URL(href, pageUrl);
  } catch {
    return null;
  }
  const root = new URL(rootUrl);
  const rootPath = root.pathname.replace(/\/$/, '');
  if (
    url.origin !== root.origin ||
    url.username ||
    url.password ||
    (url.pathname !== rootPath && !url.pathname.startsWith(`${rootPath}/`))
  ) {
    return null;
  }

  url.pathname = url.pathname.replace(/\/$/, '');
  url.hash = '';
  const page = url.searchParams.get('page');
  url.search = '';
  if (!isProductUrl(url.href, rootUrl) && page !== null && page !== '1') {
    if (!/^[1-9]\d*$/.test(page)) return null;
    url.searchParams.set('page', page);
  }
  return url.href;
}

export function isProductUrl(url: string, rootUrl = TARGET_URL): boolean {
  const prefix = `${new URL(rootUrl).pathname.replace(/\/$/, '')}/product/`;
  const path = new URL(url).pathname;
  return path.startsWith(prefix) && /^\d+$/.test(path.slice(prefix.length));
}
