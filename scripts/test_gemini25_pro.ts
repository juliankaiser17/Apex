import fs from 'fs';

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function testGemini25Pro() {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
  const tStart = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Respond with exactly OK' }] }]
    })
  });
  const data = await res.json();
  console.log(`[gemini-2.5-pro] Status: ${res.status} in ${Date.now() - tStart} ms`);
  if (res.status !== 200) {
    console.log('Error:', data.error);
  } else {
    console.log('Success:', data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
  }
}

testGemini25Pro().catch(console.error);
