import fs from 'fs';

async function checkDeployment() {
  const url = 'https://apex-spotter.vercel.app/api/analyze';
  console.log(`Checking deployment status at ${url}...`);

  // Send an empty POST request. In our updated code, empty body returns:
  // 400: { error: 'Invalid payload: Missing base64 image data.' }
  // Or send an invalid token to check if code is running:
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'origin': 'capacitor://localhost'
    },
    body: JSON.stringify({
      idempotencyKey: 'deploy_check_' + Date.now()
    })
  });

  console.log(`Status: ${res.status}`);
  const data = await res.json().catch(() => ({}));
  console.log('Response JSON:', JSON.stringify(data, null, 2));
  console.log('X-Vercel-Id:', res.headers.get('x-vercel-id'));
  console.log('X-RateLimit-Limit:', res.headers.get('x-ratelimit-limit'));
}

checkDeployment().catch(console.error);
