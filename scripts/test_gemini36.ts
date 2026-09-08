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

async function testGemini36Direct() {
  const apiKey = process.env.GEMINI_API_KEY;
  const buf = fs.readFileSync('Cars/WhatsApp Image 2026-09-08 at 06.51.32.jpeg');
  const base64Data = buf.toString('base64');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  const tStart = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: 'Identify this vehicle. Return JSON: {"make": "...", "model": "...", "generation": "..."}' },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await res.json();
  console.log(`Status: ${res.status} in ${Date.now() - tStart} ms`);
  console.log('Result:', JSON.stringify(data).slice(0, 300));
}

testGemini36Direct().catch(console.error);
