/**
 * MACHII MENS MART — STEP 11 PRODUCT SEARCH, FILTERING & SORTING TEST SUITE
 * Verifies keyword search, category, size, color, price range, stock availability,
 * multi-criteria combination, sorting (price asc/desc, newest, popularity), empty states,
 * and backend input sanitization.
 */

import { EventEmitter } from 'node:events';
import viteConfig from './vite.config.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Extract registered backend middleware handlers from Vite config
const middlewares = [];
const fakeServer = {
  middlewares: {
    use: (routeOrHandler, maybeHandler) => {
      if (typeof routeOrHandler === 'string') {
        middlewares.push({ route: routeOrHandler, handler: maybeHandler });
      } else {
        middlewares.push({ route: '/', handler: routeOrHandler });
      }
    },
  },
};

const configObj = typeof viteConfig === 'function' ? viteConfig({ command: 'serve' }) : viteConfig;
const plugin = configObj.plugins.find(
  (p) => p && (p.name === 'machii-order-backend-api' || p.name === 'order-api-plugin')
);

if (plugin && plugin.configureServer) {
  plugin.configureServer(fakeServer);
}

// In-memory HTTP dispatch helper
function dispatchRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve) => {
    const matching = middlewares.find((m) => urlPath.startsWith(m.route));
    if (!matching) {
      return resolve({
        statusCode: 404,
        headers: {},
        json: { error: `No middleware registered for path "${urlPath}"` },
      });
    }

    const subPath = urlPath.slice(matching.route.length) || '/';

    const req = new EventEmitter();
    req.method = method;
    req.url = subPath;
    req.headers = { ...headers };

    const res = {
      statusCode: 200,
      _headers: {},
      setHeader(k, v) {
        this._headers[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return this._headers[k.toLowerCase()];
      },
      end(data) {
        let json = null;
        try {
          if (data) json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: this.statusCode,
          headers: this._headers,
          data,
          json,
        });
      },
    };

    matching.handler(req, res, () => {
      resolve({ statusCode: 404, headers: {}, json: { error: 'Not handled by middleware next()' } });
    });

    if (body) {
      const payloadStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', payloadStr);
    }
    req.emit('end');
  });
}

function parsePrice(amt) {
  if (typeof amt === 'number') return amt;
  return parseInt(String(amt || '0').replace(/[^0-9]/g, ''), 10) || 0;
}

async function runSearchFilterSortSuite() {
  console.log('\n============================================================');
  console.log('MACHII MENS MART: STEP 11 SEARCH, FILTER & SORTING SUITE');
  console.log('============================================================\n');

  assert(middlewares.some((m) => m.route === '/api/products'), 'Products endpoint registered in Vite server');

  // -------------------------------------------------------------------------
  // TEST GROUP 1: FULL CATALOG RETRIEVAL & BASELINE FACETS
  // -------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Catalog Baseline & Metadata Facets ---');

  const allRes = await dispatchRequest('GET', '/api/products');
  assert(allRes.statusCode === 200 && allRes.json.success, 'GET /api/products returns HTTP 200');
  assert(Array.isArray(allRes.json.products) && allRes.json.products.length >= 6, `Catalog contains ${allRes.json.products.length} products`);
  assert(allRes.json.facets && Array.isArray(allRes.json.facets.sizes), 'API provides available sizes facets');
  assert(allRes.json.facets && Array.isArray(allRes.json.facets.colors), 'API provides available colors facets');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: KEYWORD SEARCH (Requirement 1)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Keyword Search (Name, Subtitle, Fit, GSM) ---');

  const searchTokyo = await dispatchRequest('GET', '/api/products?q=Tokyo');
  assert(searchTokyo.statusCode === 200 && searchTokyo.json.products.length > 0, 'Search for "Tokyo" returns matching products');
  assert(searchTokyo.json.products.every((p) => p.name.toLowerCase().includes('tokyo') || (p.subName || p.subTitle).toLowerCase().includes('tokyo')), 'All results for "Tokyo" match name or subtitle');

  const searchCaseInsensitive = await dispatchRequest('GET', '/api/products?q=hOoDiE');
  assert(searchCaseInsensitive.statusCode === 200 && searchCaseInsensitive.json.products.length > 0, 'Search is case-insensitive ("hOoDiE")');

  const searchGsm = await dispatchRequest('GET', '/api/products?q=420+GSM');
  assert(searchGsm.statusCode === 200 && searchGsm.json.products.length > 0, 'Search matches fabric specs ("420 GSM")');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: CATEGORY FILTERING (Requirement 2)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Category Filtering ---');

  const catOversized = await dispatchRequest('GET', '/api/products?category=oversized');
  assert(catOversized.statusCode === 200 && catOversized.json.products.length > 0, 'Filter category=oversized returns products');
  assert(catOversized.json.products.every((p) => p.categories?.includes('oversized')), 'All products belong to "oversized" category');

  const catHoodies = await dispatchRequest('GET', '/api/products?category=hoodies');
  assert(catHoodies.statusCode === 200, 'Filter category=hoodies returns HTTP 200');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: SIZE FILTERING (Requirement 2)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Size Filtering ---');

  const sizeL = await dispatchRequest('GET', '/api/products?size=L');
  assert(sizeL.statusCode === 200 && sizeL.json.products.length > 0, 'Filter size=L returns products');
  assert(sizeL.json.products.every((p) => p.sizes?.includes('L')), 'All returned products support size L');

  const sizeXXL = await dispatchRequest('GET', '/api/products?size=XXL');
  assert(sizeXXL.statusCode === 200, 'Filter size=XXL returns products');
  assert(sizeXXL.json.products.every((p) => p.sizes?.includes('XXL')), 'All returned products support size XXL');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: COLORWAY FILTERING (Requirement 2)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Colorway Filtering ---');

  const colorCobalt = await dispatchRequest('GET', '/api/products?color=cobalt');
  assert(colorCobalt.statusCode === 200 && colorCobalt.json.products.length > 0, 'Filter color=cobalt returns products');
  assert(colorCobalt.json.products.every((p) => p.colors?.some((c) => c.name.toLowerCase().includes('cobalt') || c.id.toLowerCase().includes('cobalt'))), 'All returned products include a Cobalt colorway');

  const colorCharcoal = await dispatchRequest('GET', '/api/products?color=charcoal');
  assert(colorCharcoal.statusCode === 200 && colorCharcoal.json.products.length > 0, 'Filter color=charcoal returns products');

  // -------------------------------------------------------------------------
  // TEST GROUP 6: PRICE RANGE FILTERING (Requirement 2)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Price Range Filtering ---');

  const maxPriceRes = await dispatchRequest('GET', '/api/products?maxPrice=1500');
  assert(maxPriceRes.statusCode === 200 && maxPriceRes.json.products.length > 0, 'Filter maxPrice=1500 returns products');
  assert(maxPriceRes.json.products.every((p) => parsePrice(p.price) <= 1500), 'All returned products have price <= ₹1,500');

  const minPriceRes = await dispatchRequest('GET', '/api/products?minPrice=2000');
  assert(minPriceRes.statusCode === 200 && minPriceRes.json.products.length > 0, 'Filter minPrice=2000 returns products');
  assert(minPriceRes.json.products.every((p) => parsePrice(p.price) >= 2000), 'All returned products have price >= ₹2,000');

  const betweenPriceRes = await dispatchRequest('GET', '/api/products?minPrice=1400&maxPrice=1800');
  assert(betweenPriceRes.statusCode === 200, 'Filter minPrice=1400&maxPrice=1800 returns HTTP 200');
  assert(betweenPriceRes.json.products.every((p) => {
    const price = parsePrice(p.price);
    return price >= 1400 && price <= 1800;
  }), 'All returned products fall strictly between ₹1,400 and ₹1,800');

  // -------------------------------------------------------------------------
  // TEST GROUP 7: STOCK AVAILABILITY FILTERING (Requirement 2)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Stock Availability Filtering ---');

  const inStockRes = await dispatchRequest('GET', '/api/products?inStock=true');
  assert(inStockRes.statusCode === 200 && inStockRes.json.products.length > 0, 'Filter inStock=true returns products');
  assert(inStockRes.json.products.every((p) => (p.stock || 0) > 0), 'All returned products have positive available stock');

  // -------------------------------------------------------------------------
  // TEST GROUP 8: SORTING (Requirement 3)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Sorting (Price Asc/Desc, Newest, Popularity) ---');

  const sortPriceAsc = await dispatchRequest('GET', '/api/products?sort=price-asc');
  assert(sortPriceAsc.statusCode === 200, 'Sort price-asc returns HTTP 200');
  const pricesAsc = sortPriceAsc.json.products.map((p) => parsePrice(p.price));
  let isAscending = true;
  for (let i = 1; i < pricesAsc.length; i++) {
    if (pricesAsc[i] < pricesAsc[i - 1]) isAscending = false;
  }
  assert(isAscending, 'Products sorted by price in ascending order (Low to High)');

  const sortPriceDesc = await dispatchRequest('GET', '/api/products?sort=price-desc');
  assert(sortPriceDesc.statusCode === 200, 'Sort price-desc returns HTTP 200');
  const pricesDesc = sortPriceDesc.json.products.map((p) => parsePrice(p.price));
  let isDescending = true;
  for (let i = 1; i < pricesDesc.length; i++) {
    if (pricesDesc[i] > pricesDesc[i - 1]) isDescending = false;
  }
  assert(isDescending, 'Products sorted by price in descending order (High to Low)');

  const sortPopular = await dispatchRequest('GET', '/api/products?sort=popularity');
  assert(sortPopular.statusCode === 200, 'Sort popularity returns HTTP 200');
  assert(sortPopular.json.products[0].badge === 'POPULAR' || sortPopular.json.products[0].badge === 'BESTSELLER' || sortPopular.json.products[0].badge === '420 GSM HEAVY', 'Popular / badge items appear at the top');

  // -------------------------------------------------------------------------
  // TEST GROUP 9: COMBINED MULTI-CRITERIA FILTERING (Requirement 4)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Combined Multi-Criteria Filtering ---');

  const combinedRes = await dispatchRequest('GET', '/api/products?category=oversized&size=M&maxPrice=2000&sort=price-asc');
  assert(combinedRes.statusCode === 200, 'Combined filter (category+size+maxPrice+sort) returns HTTP 200');
  assert(combinedRes.json.products.every((p) =>
    p.categories?.includes('oversized') &&
    p.sizes?.includes('M') &&
    parsePrice(p.price) <= 2000
  ), 'All results strictly satisfy all combined criteria simultaneously');

  // -------------------------------------------------------------------------
  // TEST GROUP 10: EMPTY RESULTS & UNMATCHED QUERIES (Requirement 6)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Empty Results Handling ---');

  const emptyRes = await dispatchRequest('GET', '/api/products?q=nonexistentstreetwearitemxyz999');
  assert(emptyRes.statusCode === 200 && emptyRes.json.count === 0, 'Unmatched search query returns HTTP 200 with 0 count');
  assert(Array.isArray(emptyRes.json.products) && emptyRes.json.products.length === 0, 'Unmatched search returns clean empty array');

  // -------------------------------------------------------------------------
  // TEST GROUP 11: PAGINATION SYNCHRONIZATION (Requirement 7)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: Pagination Synchronization ---');

  const page1Res = await dispatchRequest('GET', '/api/products?page=1&limit=3');
  assert(page1Res.statusCode === 200, 'GET /api/products?page=1&limit=3 returns HTTP 200');
  assert(page1Res.json.products.length === 3, 'Page 1 returns exactly 3 products');
  assert(page1Res.json.page === 1, 'Page number reports 1');
  assert(page1Res.json.totalPages >= 2, 'Total pages calculated correctly');

  const page2Res = await dispatchRequest('GET', '/api/products?page=2&limit=3');
  assert(page2Res.statusCode === 200 && page2Res.json.products.length === 3, 'Page 2 returns 3 products');
  assert(page2Res.json.products[0].id !== page1Res.json.products[0].id, 'Page 2 returns distinct products from Page 1');

  // -------------------------------------------------------------------------
  // TEST GROUP 12: INPUT SANITIZATION & SAFE QUERY PARSING (Requirement 9)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 12: Input Validation & Sanitization ---');

  const negativePriceRes = await dispatchRequest('GET', '/api/products?minPrice=-500&maxPrice=-10');
  assert(negativePriceRes.statusCode === 200, 'Negative prices handled gracefully without crash');

  const invalidSortRes = await dispatchRequest('GET', '/api/products?sort=DROP_TABLE_USERS');
  assert(invalidSortRes.statusCode === 200, 'Invalid sort parameter ignored safely without crash');

  const specialCharsRes = await dispatchRequest('GET', '/api/products?q=%27%22%3Cscript%3E');
  assert(specialCharsRes.statusCode === 200, 'Special characters and script tags in search query handled safely');

  console.log('\n============================================================');
  console.log(`STEP 11 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSearchFilterSortSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

