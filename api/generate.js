export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic rate limiting header (Vercel handles most of this)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { topic, duration, style } = req.body;

  // Validate inputs
  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    return res.status(400).json({ error: 'Invalid topic provided' });
  }

  if (topic.length > 500) {
    return res.status(400).json({ error: 'Topic too long (max 500 characters)' });
  }

  const styleMap = {
    viral: 'viral, hook-driven, emotionally engaging, fast-paced with punchy sentences',
    educational: 'educational, clear, well-structured, informative with examples',
    storytelling: 'narrative-driven, emotional, strong story arc with beginning/middle/end',
    tutorial: 'step-by-step tutorial, practical, actionable with clear instructions'
  };

  const validStyle = styleMap[style] || styleMap.viral;
  const wordCount = [150, 300, 450].includes(Number(duration)) ? Number(duration) : 300;

  const prompt = `You are a professional YouTube video scriptwriter. Generate a complete video script.

Topic: "${topic.trim()}"
Style: ${validStyle}
Target word count: ~${wordCount} words

Return ONLY valid JSON (no markdown, no backticks) in this exact structure:
{
  "title": "Compelling YouTube title",
  "hook": "One-sentence attention-grabbing hook for the first 3 seconds",
  "description": "2-sentence YouTube video description",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "totalDuration": ${Math.round(wordCount / 2.5)},
  "scenes": [
    {
      "type": "Hook",
      "duration": 15,
      "visual": "What the camera shows",
      "narration": "Exact words spoken",
      "broll": "Optional b-roll suggestion"
    }
  ]
}

Scene types to use: Hook, Intro, Main Content, Transition, Conclusion, CTA
Generate 6-10 scenes. Keep each scene 10-40 seconds. Make narration conversational and engaging.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic API error:', err);
      return res.status(500).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Failed to generate script. Please try again.' });
  }
}

