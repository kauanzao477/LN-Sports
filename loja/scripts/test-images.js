import { onRequest } from '../functions/api/image-proxy.js';

async function runTests() {
  const placeholders = [
    { id: '2425-kids-m-u-third-away-size-16-28', url: 'https://photo.yupoo.com/minkang/7345e44c/43baa1ab.jpeg' },
    { id: 'southampton-2526-home-jersey-s-xxl', url: 'https://photo.yupoo.com/minkang/bf2deae9/5d701013.jpg' },
    { id: '2425-player-m-u-away-s-3xl', url: 'https://photo.yupoo.com/minkang/a0984d77/e2024130.jpeg' },
    { id: 'santos-2425-away-kids-kit-jersey-szie16-28', url: 'https://photo.yupoo.com/minkang/34593203/3cf9d802.jpg' },
    { id: 'arsenal-2425-home-kids-kit-jersey-szie-16-28', url: 'https://photo.yupoo.com/minkang/ee38fd0b/3fc7a623.jpg' }
  ];

  console.log('=== TEST 1: Verifying 5 Placeholder Products Return 404 via Proxy ===');
  for (const item of placeholders) {
    const req = new Request('http://localhost/api/image-proxy?url=' + encodeURIComponent(item.url));
    const res = await onRequest({ request: req });
    const text = await res.text();
    console.log(`[${item.id}] Status: ${res.status} | Body: ${text.slice(0, 45)}`);
    if (res.status !== 404) {
      throw new Error(`Expected 404 for placeholder: ${item.id}, got ${res.status}`);
    }
  }

  console.log('\n=== TEST 2: Verifying Normal photo.yupoo.com Image via Proxy Returns 200 ===');
  const normalPhoto = 'https://photo.yupoo.com/minkang/d1ed2c61/f09ab24b.jpg';
  const req2 = new Request('http://localhost/api/image-proxy?url=' + encodeURIComponent(normalPhoto));
  const res2 = await onRequest({ request: req2 });
  const buf2 = await res2.arrayBuffer();
  console.log(`Status: ${res2.status} | Content-Type: ${res2.headers.get('content-type')} | Size: ${buf2.byteLength} bytes`);
  if (res2.status !== 200 || buf2.byteLength < 100000) {
    throw new Error('Expected valid 200 photo');
  }

  console.log('\n=== TEST 3: Verifying uvd.yupoo.com Image Direct Fetch Returns 200 ===');
  const uvdUrl = 'https://uvd.yupoo.com/minkang/22618853_oneTrue.jpg';
  const res3 = await fetch(uvdUrl);
  const buf3 = await res3.arrayBuffer();
  console.log(`Status: ${res3.status} | Content-Type: ${res3.headers.get('content-type')} | Size: ${buf3.byteLength} bytes`);
  if (res3.status !== 200 || buf3.byteLength < 10000) {
    throw new Error('Expected valid 200 uvd image');
  }

  console.log('\n🎉 ALL 3 IMAGE TEST SUITES PASSED WITH 100% SUCCESS!');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
