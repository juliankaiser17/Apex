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

async function testModel(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Respond with exactly the word OK' }] }]
    })
  });
  const data = await res.json();
  console.log(`[${modelName}] Status: ${res.status}`);
  if (res.status !== 200) {
    console.log(`  Error: ${data.error?.message?.slice(0, 200)}`);
  } else {
    console.log(`  Output: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
  }
}

async function main() {
  await testModel('gemini-2.5-flash');
  await testModel('gemini-2.5-flash-lite');
  await testModel('gemini-3.6-flash');
  await testModel('gemini-flash-latest');
}

main().catch(console.error);
