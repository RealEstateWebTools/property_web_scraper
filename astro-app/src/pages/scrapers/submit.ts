import type { APIRoute } from 'astro';
import { retrieveListing } from '@lib/services/listing-retriever.js';

/**
 * POST /scrapers/submit
 * Port of Ruby ScraperController#ajax_submit.
 * Returns HTML partial (success/error card).
 */
export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') || '';
  let importUrl = '';
  let html: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    importUrl = (formData.get('import_url') as string || '').trim();
    const htmlFile = formData.get('html_file');
    if (htmlFile && htmlFile instanceof File && htmlFile.size > 0) {
      html = await htmlFile.text();
    } else {
      const htmlParam = formData.get('html') as string;
      if (htmlParam) html = htmlParam;
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    importUrl = (params.get('import_url') || '').trim();
    html = params.get('html') || undefined;
  }

  console.log(`[Submit] URL: "${importUrl}"`);
  console.log(`[Submit] HTML provided: ${html ? `yes (${html.length} chars)` : 'no'}`);

  const result = await retrieveListing(importUrl, html);

  console.log(`[Submit] Result: success=${result.success}, hasListing=${!!result.retrievedListing}, error=${result.errorMessage || '(none)'}`);
  if (result.success && result.retrievedListing) {
    const l = result.retrievedListing;
    console.log(`[Submit] Listing: title="${l.title || ''}", price="${l.price_string || ''}", images=${(l.image_urls || []).length}`);
  }

  if (result.success && result.retrievedListing) {
    const listing = result.retrievedListing;
    const imageUrls = listing.image_urls || [];
    const attrs = [
      'reference', 'title', 'description', 'price_string', 'price_float',
      'area_unit', 'address_string', 'currency', 'country', 'longitude',
      'latitude', 'main_image_url', 'for_rent', 'for_sale',
      'count_bedrooms', 'count_bathrooms',
    ];

    return new Response(renderSuccessHtml(listing, imageUrls, attrs), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response(renderErrorHtml(result.errorMessage || 'Unknown error'), {
    headers: { 'Content-Type': 'text/html' },
  });
};

function renderSuccessHtml(listing: any, imageUrls: string[], attrs: string[]): string {
  const firstImage = imageUrls.length > 0 ? imageUrls[0] : '';
  const imageHtml = firstImage
    ? `<img src="${escapeHtml(firstImage)}" alt="Property image" class="w-full h-[200px] object-cover bg-gray-200">`
    : '';

  const statsHtml = [
    listing.price_string ? `<span class="inline-flex items-center gap-1.5 bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-full text-sm"><i class="bi bi-tag-fill"></i> ${escapeHtml(listing.price_string)} ${escapeHtml(listing.currency || '')}</span>` : '',
    listing.count_bedrooms > 0 ? `<span class="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-700"><i class="bi bi-door-open text-blue-600"></i> ${listing.count_bedrooms} beds</span>` : '',
    listing.count_bathrooms > 0 ? `<span class="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-700"><i class="bi bi-droplet text-blue-600"></i> ${listing.count_bathrooms} baths</span>` : '',
    listing.constructed_area > 0 ? `<span class="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-700"><i class="bi bi-arrows-angle-expand text-blue-600"></i> ${listing.constructed_area} ${escapeHtml(listing.area_unit || '')}</span>` : '',
    listing.for_sale ? `<span class="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-700"><i class="bi bi-house text-blue-600"></i> For Sale</span>` : '',
    listing.for_rent ? `<span class="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-sm text-gray-700"><i class="bi bi-key text-blue-600"></i> For Rent</span>` : '',
  ].filter(Boolean).join('\n');

  const fieldsHtml = attrs
    .map((attr) => {
      const val = listing[attr];
      if (val == null || val === '' || val === 0 || val === false) return '';
      const label = attr.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      return `<tr class="even:bg-gray-50"><td class="font-semibold py-1.5 px-2" style="width:35%">${escapeHtml(label)}</td><td class="py-1.5 px-2">${escapeHtml(String(val))}</td></tr>`;
    })
    .filter(Boolean)
    .join('\n');

  const thumbsHtml = imageUrls.slice(0, 6).map((url) =>
    `<a href="${escapeHtml(url)}" target="_blank"><img src="${escapeHtml(url)}" alt="Property" class="w-20 h-15 object-cover rounded-md border border-gray-200"></a>`
  ).join('\n');

  const moreCount = imageUrls.length > 6 ? imageUrls.length - 6 : 0;

  return `
<div class="flex items-center gap-3 bg-green-100 text-green-900 px-5 py-3 rounded-xl mb-6 font-medium">
  <i class="bi bi-check-circle-fill text-xl"></i> Property data extracted successfully
</div>
<div class="rounded-2xl shadow-md overflow-hidden mb-4 border-0">
  ${imageHtml}
  <div class="p-6">
    ${listing.title ? `<h5 class="text-lg font-semibold text-gray-900 mb-3">${escapeHtml(listing.title)}</h5>` : ''}
    <div class="flex flex-wrap gap-2 mb-4">${statsHtml}</div>
    ${listing.address_string ? `<p class="text-gray-500 mb-3 text-sm"><i class="bi bi-geo-alt mr-1"></i> ${escapeHtml(listing.address_string)}</p>` : ''}
    <div class="flex flex-wrap gap-2 mb-3">
      <a href="/single_property_view?url=${encodeURIComponent(listing.import_url || '')}" class="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 no-underline inline-flex items-center gap-1"><i class="bi bi-eye"></i> View Full Details</a>
      <a href="/retriever/as_json?url=${encodeURIComponent(listing.import_url || '')}" class="border border-gray-300 text-gray-600 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 no-underline inline-flex items-center gap-1"><i class="bi bi-braces"></i> Get JSON</a>
    </div>
    <button class="pws-details-toggle text-sm text-blue-600 cursor-pointer inline-flex items-center gap-1.5 border-0 bg-transparent p-0 mt-2 hover:underline" type="button">
      <i class="bi bi-chevron-down"></i> Show all extracted fields
    </button>
    <div class="hidden mt-3" id="all-fields">
      <table class="w-full text-sm mb-3"><tbody>${fieldsHtml}</tbody></table>
      ${imageUrls.length > 0 ? `
        <p class="font-semibold mb-2 text-sm">${imageUrls.length} image${imageUrls.length === 1 ? '' : 's'} found</p>
        <div class="flex flex-wrap gap-2 mb-2">
          ${thumbsHtml}
          ${moreCount > 0 ? `<span class="inline-block bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs self-center">+ ${moreCount} more</span>` : ''}
        </div>
      ` : ''}
    </div>
  </div>
</div>`;
}

function renderErrorHtml(errorMessage: string): string {
  const isUnsupported = errorMessage === 'Unsupported Url';
  const supportedSites = ['idealista.com', 'rightmove.co.uk', 'zoopla.co.uk', 'realtor.com', 'fotocasa.es', 'pisos.com', 'realestateindia.com'];

  if (isUnsupported) {
    return `
<div class="bg-amber-50 rounded-2xl p-6">
  <div class="text-3xl text-amber-600 mb-3"><i class="bi bi-exclamation-triangle"></i></div>
  <h5 class="font-semibold text-amber-900 mb-2">This website isn't supported yet</h5>
  <p class="text-amber-800 text-sm">We don't have a scraper mapping configured for that host.</p>
  <div class="bg-white/60 rounded-lg p-4 mt-4 text-sm text-gray-600">
    <i class="bi bi-info-circle text-blue-600 mr-1"></i> <strong>Supported sites:</strong>
    <div class="mt-2">${supportedSites.map((s) => `<span class="inline-block bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs mx-0.5 my-0.5">${s}</span>`).join(' ')}</div>
  </div>
</div>`;
  }

  return `
<div class="bg-amber-50 rounded-2xl p-6">
  <div class="text-3xl text-amber-600 mb-3"><i class="bi bi-exclamation-triangle"></i></div>
  <h5 class="font-semibold text-amber-900 mb-2">Something went wrong</h5>
  <p class="text-amber-800 text-sm">${escapeHtml(errorMessage)}</p>
  <div class="bg-white/60 rounded-lg p-4 mt-4 text-sm text-gray-600">
    <i class="bi bi-lightbulb text-blue-600 mr-1"></i> <strong>Tips:</strong> Make sure the URL is a direct link to a single property page. If the site uses JavaScript rendering, try switching to <strong>Paste HTML</strong> or <strong>Upload File</strong> mode above.
  </div>
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
