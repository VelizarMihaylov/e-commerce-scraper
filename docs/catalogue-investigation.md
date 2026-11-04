# Catalogue investigation

Inspected on 2026-11-04 for [issue #3](https://github.com/VelizarMihaylov/e-commerce-scraper/issues/3). This records observations and implementation decisions; it does not implement catalogue traversal or extraction.

## Navigation and product identity

The [home page](https://webscraper.io/test-sites/e-commerce/static) exposes three featured products and two category links. Category pages also show featured products; they are not the complete catalogue. Visiting Computers reveals Laptops and Tablets, while Phones reveals Touch.

| Leaf listing                                                                    | Observed pagination | Products on first / last page |
| ------------------------------------------------------------------------------- | ------------------- | ----------------------------- |
| [Laptops](https://webscraper.io/test-sites/e-commerce/static/computers/laptops) | Pages 1–20          | 6 / 3                         |
| [Tablets](https://webscraper.io/test-sites/e-commerce/static/computers/tablets) | Pages 1–4           | 6 / 3                         |
| [Touch phones](https://webscraper.io/test-sites/e-commerce/static/phones/touch) | Pages 1–2           | 6 / 3                         |

These are observations from the first and last pages, not a verified full-catalogue count. Do not hardcode page counts or generate product IDs from their apparent numeric range.

Useful selectors in the fetched HTML:

- `#side-menu a.category-link` and `#side-menu a.subcategory-link`: category discovery.
- `.test-site a.title[href]`: product detail links, including featured products.
- `#static-pagination a[rel="next"]`: next listing page. The last page has a disabled span rather than a next-page anchor.

Laptops page 1 omits middle page numbers behind an ellipsis. Reading only the numbered links on that first page would miss products. Follow the actual next links until none remain, with a visited set. Numbered and next links can point to the same page; category navigation also repeats on listings.

Resolve relative links against their page URL. Restrict traversal to the same origin and the exact `/test-sites/e-commerce/static` path or its descendants. Treat the bare listing URL and `?page=1` as the same listing, retain other page values, and remove URL fragments.

Product URLs have the form `/test-sites/e-commerce/static/product/<id>`. Use that canonical URL or ID for identity, adding the storage value for an expanded configuration. [Touch page 2](https://webscraper.io/test-sites/e-commerce/static/phones/touch?page=2) contains IDs 7, 8 and 9, all named `Iphone` and priced at $899.99. Name or price deduplication would incorrectly discard distinct products.

## Product fields and configurations

Read the original product-detail HTML, scoped to `.test-site .thumbnail`:

| Field       | Source                              | Handling                                                                                                             |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Name        | `h4.title[itemprop="name"]`         | Trim whitespace and preserve the full title. Listing anchor text can be truncated; its `title` attribute is full.    |
| Description | `p.description`                     | Decode HTML entities and normalize whitespace without rewriting the specification.                                   |
| Base price  | `h4.price`                          | Read the dollar amount as integer cents; the raw HTML also has a `span[itemprop="price"]` and USD currency metadata. |
| Storage     | `.swatches button.swatch`           | Read `value`, active state and `disabled`, independently of colour controls.                                         |
| Colours     | `select[aria-label="color"] option` | Ignore the empty placeholder; normalize nonempty available values and deduplicate.                                   |

Price strings are not always padded to two decimals: the captures include `$372.7` and `$1399`. Parse these as 37270 and 139900 cents respectively, alongside ordinary two-decimal prices.

The [long-name laptop](https://webscraper.io/test-sites/e-commerce/static/product/127) is displayed as `Asus VivoBook...` in a category card but has the full detail title `Asus VivoBook Pro 15 N580VN-FI006T Gold Metal`.

### Storage pricing evidence

Storage buttons contain values but no prices. The linked [JavaScript bundle](https://webscraper.io/js/app.js?id=e95f7d9783f442c064c61e4f45794b47) defines `EcommerceProduct`: it saves the initial price, then applies an absolute modifier when a storage button is clicked. The handler updates the DOM directly and contains no price-fetch request.

| Storage value | Modifier from initial price | Availability in sampled storage products |
| ------------- | --------------------------- | ---------------------------------------- |
| 128           | $0                          | Enabled and initially active             |
| 256           | $20                         | Enabled                                  |
| 512           | $40                         | Enabled                                  |
| 1024          | $60                         | Disabled                                 |

Browser interaction on [Dell Latitude 5480, ID 136](https://webscraper.io/test-sites/e-commerce/static/product/136) confirmed $1310.39 initially, $1330.39 for 256, $1350.39 for 512, and $1310.39 again after selecting 128. Adjustments are relative to the initial price, not cumulative. The 1024 modifier is source-code evidence only; its disabled control was not activated.

Implementation decision: interpret “available” as enabled options and omit disabled 1024 entries. Append the selected value as `128 GB`, `256 GB` or `512 GB`, as required by the assessment. Keep the original description: this test site's Dell description says `256GB SSD` even while 128 is selected. The controls determine configurations; description text is not a reliable option list.

For this site, fetch plus Cheerio remains sufficient. Put the observed modifier map in the site-specific parser, use integer-cent additions, and document its source. Fail clearly on unfamiliar enabled storage values or an unexpected initial configuration rather than inventing a price. Recheck the rule during the final live smoke test. A future site with server-priced configurations would need a different adapter.

### Colours and combined options

[Samsung Galaxy, ID 3](https://webscraper.io/test-sites/e-commerce/static/product/3) has `Gold`, `White` and `Black` options and an empty `Select color` placeholder. Selecting Gold in the browser changed the title to `Samsung Galaxy Gold`; the price remained $93.99. Preserve the original title and collect the colours without clicking each one.

[Lenovo IdeaTab, ID 10](https://webscraper.io/test-sites/e-commerce/static/product/10) has both storage buttons and the same colour dropdown. Therefore each storage result should carry the colours array; colours do not create additional results. The sampled laptops have no colour dropdown, even when their names contain colour words. Do not infer selectable colours from names or descriptions.

Normalize colours to lowercase to match the assessment example, preserving their source order. Emit `colors` only when more than one distinct available value remains. No single-colour dropdown or product lacking both types of control was observed in this sample; cover those with explicitly synthetic fixtures when implementing the parser.

Expected examples for subsequent tests (prices derived from the observed base and verified handler):

| Product ID | Output names                                    | Prices                      | Colours                           |
| ---------- | ----------------------------------------------- | --------------------------- | --------------------------------- |
| 3          | Samsung Galaxy                                  | 93.99                       | gold, white, black                |
| 10         | Lenovo IdeaTab 128 GB / 256 GB / 512 GB         | 69.99 / 89.99 / 109.99      | gold, white, black on each result |
| 136        | Dell Latitude 5480 128 GB / 256 GB / 512 GB     | 1310.39 / 1330.39 / 1350.39 | Omit                              |
| 127        | Full detail title plus 128 GB / 256 GB / 512 GB | 1235.49 / 1255.49 / 1275.49 | Omit                              |

## Fixture provenance and limits

The [fixture manifest](../src/__tests__/fixtures/catalogue/manifest.json) lists each file's source URL, purpose and SHA-256 hashes for the downloaded source and retained fixture. HTML fixtures retain the `.test-site` subtree, with images, ratings and detail-page sidebars removed. Cheerio serializes the fragments and inter-tag whitespace is compacted and trailing line whitespace trimmed; product data, navigation links, option values and disabled states are preserved. They are not complete pages and contain no analytics, cookie banners or unrelated marketing content.

`product-behaviour.txt` is an exact excerpt from the captured bundle, retained as evidence rather than executable application or test code. Fixture contents are intentionally excluded from automatic formatting so captures remain stable.

The fixture set covers nested categories, featured-product overlap, pagination gaps and termination, equal names/prices on distinct IDs, long names, storage-only products, colours-only products and combined options. It is not a complete crawl and does not prove that all products share these shapes. HTTP failure/retry cases and malformed data still need controlled test inputs in the implementation tickets.

Next: implement traversal in #4 and extraction/aggregation in #5 using this evidence. Full catalogue counts, output totals and a live end-to-end run belong to #6. No scraper behaviour changed in this investigation.
