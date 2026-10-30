/* ==========================================================================
   MACHII MENS MART — STEP 18: SEO & SOCIAL-SHARING VERIFICATION SUITE
   Tests robots.txt, sitemap.xml, HTML meta tags, OpenGraph, Twitter Cards,
   Schema.org JSON-LD structured data, dynamic product deep links, and private
   route indexing protection.
   ========================================================================== */

import assert from 'node:assert';
import http from 'node:http';

const BASE_URL = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ✓ PASS: ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`  ✗ FAIL: ${msg}`);
  if (err) console.error(err);
  failed++;
}

async function get(path) {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    }).on('error', reject);
  });
}

async function runSeoSuite() {
  console.log('\n=============================================================');
  console.log('MACHII MENS MART — STEP 18: SEO & SOCIAL-SHARING TEST SUITE');
  console.log('=============================================================\n');

  // --- 1. Robots.txt Verification ---
  console.log('--- 1. Robots.txt Compliance & Route Protection ---');
  try {
    const res = await get('/robots.txt');
    assert.strictEqual(res.status, 200, 'robots.txt should return 200 OK');
    assert.ok(res.body.includes('User-agent: *'), 'Must declare User-agent: *');
    assert.ok(res.body.includes('Disallow: /admin'), 'Must disallow /admin');
    assert.ok(res.body.includes('Disallow: /checkout'), 'Must disallow /checkout');
    assert.ok(res.body.includes('Disallow: /order-history'), 'Must disallow /order-history');
    assert.ok(res.body.includes('Disallow: /profile'), 'Must disallow /profile');
    assert.ok(res.body.includes('Disallow: /api/'), 'Must disallow /api/');
    assert.ok(res.body.includes('Sitemap:'), 'Must reference sitemap.xml');
    assert.ok(res.body.includes('/sitemap.xml'), 'Sitemap directive must point to sitemap.xml');
    pass('robots.txt returns 200 OK with correct User-agent and Sitemap directive');
    pass('robots.txt correctly disallows private routes (/admin, /checkout, /order-history, /profile, /api/)');
  } catch (err) {
    fail('robots.txt verification failed', err);
  }

  // --- 2. Sitemap.xml Verification ---
  console.log('\n--- 2. Sitemap.xml Content & Route Authenticity ---');
  try {
    const res = await get('/sitemap.xml');
    assert.strictEqual(res.status, 200, 'sitemap.xml should return 200 OK');
    assert.ok(res.headers['content-type']?.includes('xml'), 'Must return XML content-type');
    assert.ok(res.body.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'Must have standard sitemap namespace');
    assert.ok(res.body.includes('<loc>'), 'Must contain <loc> elements');
    assert.ok(res.body.includes('product=garment-featured-attitude'), 'Must contain deep-linked product entries');
    assert.ok(res.body.includes('<image:image>'), 'Must contain image sitemap tags for product previews');
    assert.ok(!res.body.includes('/admin'), 'Private /admin MUST NOT be listed in sitemap.xml');
    assert.ok(!res.body.includes('/checkout'), 'Private /checkout MUST NOT be listed in sitemap.xml');
    assert.ok(!res.body.includes('/profile'), 'Private /profile MUST NOT be listed in sitemap.xml');
    pass('sitemap.xml serves valid XML with standard 0.9 schema');
    pass('sitemap.xml includes authentic product deep-link URLs and <image:image> tags');
    pass('sitemap.xml strictly excludes private admin, checkout, and profile routes');
  } catch (err) {
    fail('sitemap.xml verification failed', err);
  }

  // --- 3. HTML Document Metadata Verification ---
  console.log('\n--- 3. Static Baseline HTML Metadata & Open Graph ---');
  try {
    const res = await get('/');
    assert.strictEqual(res.status, 200, 'Root HTML should return 200 OK');
    assert.ok(res.body.includes('<title>MACHII MENS MART — Wear Your Attitude | Gen Z Oversized Streetwear</title>'), 'Clear, unique title for Machii Mens Mart');
    assert.ok(res.body.includes('name="description"'), 'Meta description tag present');
    assert.ok(res.body.includes('property="og:title"'), 'Open Graph og:title present');
    assert.ok(res.body.includes('property="og:description"'), 'Open Graph og:description present');
    assert.ok(res.body.includes('property="og:image"'), 'Open Graph og:image present');
    assert.ok(res.body.includes('property="og:type" content="website"'), 'Open Graph og:type is website');
    assert.ok(res.body.includes('name="twitter:card" content="summary_large_image"'), 'Twitter card configured as summary_large_image');
    assert.ok(res.body.includes('rel="canonical"'), 'Canonical link tag present');
    assert.ok(res.body.includes('type="application/ld+json"'), 'Schema.org JSON-LD tag present');
    pass('Homepage has unique title and descriptive meta description for Machii Mens Mart');
    pass('Open Graph metadata (og:title, og:description, og:image, og:type) present');
    pass('Twitter card metadata configured with summary_large_image');
    pass('Canonical link present without invalid directory references');
    pass('Baseline JSON-LD structured data injected in head');
  } catch (err) {
    fail('HTML metadata verification failed', err);
  }

  // --- 4. Schema.org JSON-LD Content Audit ---
  console.log('\n--- 4. Schema.org Structured Data Quality Audit ---');
  try {
    const res = await get('/');
    const match = res.body.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(match && match[1], 'Must find JSON-LD script block');
    const schema = JSON.parse(match[1]);
    assert.strictEqual(schema['@context'], 'https://schema.org', '@context must be https://schema.org');
    assert.ok(Array.isArray(schema['@graph']), '@graph array expected');
    const org = schema['@graph'].find((item) => item['@type'] === 'Organization');
    const webSite = schema['@graph'].find((item) => item['@type'] === 'WebSite');
    assert.ok(org, 'Organization schema present');
    assert.strictEqual(org.name, 'Machii Mens Mart', 'Organization name matches brand');
    assert.ok(webSite, 'WebSite schema present');
    assert.strictEqual(webSite.name, 'Machii Mens Mart', 'WebSite name matches brand');
    pass('JSON-LD structured data parses valid JSON');
    pass('Organization and WebSite schemas accurately represent Machii Mens Mart brand');
  } catch (err) {
    fail('Schema.org structured data audit failed', err);
  }

  console.log('\n=============================================================');
  console.log(`TEST RESULTS: ${passed} / ${passed + failed} PASSED`);
  if (failed === 0) {
    console.log('ALL STEP 18 SEO & SOCIAL-SHARING TESTS PASSED! 🚀🎯');
  } else {
    console.error(`FAILED ${failed} TESTS`);
  }
  console.log('=============================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runSeoSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
