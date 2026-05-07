export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { topic, duration, style, includeThumbnail } = req.body;

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

  // Word count per minute is ~150 words spoken naturally
  const validDurations = [150, 300, 450, 750, 1500, 2250, 3000];
  const wordCount = validDurations.includes(Number(duration)) ? Number(duration) : 300;
  const minutes = Math.round(wordCount / 150);

  // Scale scenes based on length
  let sceneCount = '6-10';
  if (minutes >= 10) sceneCount = '15-20';
  else if (minutes >= 5) sceneCount = '10-15';

  const thumbnailPrompt = includeThumbnail ? `
  "thumbnails": [
    "Thumbnail concept 1: describe text overlay, background, colors, and emotion",
    "Thumbnail concept 2: describe text overlay, background, colors, and emotion",
    "Thumbnail concept 3: describe text overlay, background, colors, and emotion"
  ],` : '"thumbnails": [],';

  const prompt = `You are a professional YouTube video scriptwriter. Generate a COMPLETE and DETAILED video script.

Topic: "${topic.trim()}"
Style: ${validStyle}
Target length: ${minutes} minutes (~${wordCount} words total)
Number of scenes: ${sceneCount}

IMPORTANT: Write FULL detailed narration for every scene. Do NOT summarize or shorten. Each scene narration must be complete sentences that a person would actually speak. The total narration across all scenes should add up to approximately ${wordCount} words.

Return ONLY valid JSON (no markdown, no backticks) in this exact structure:
{
  "title": "Compelling YouTube title",
  "hook": "One-sentence attention-grabbing hook for the first 3 seconds",
  "description": "2-sentence YouTube video description",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7"],
  "totalDuration": ${minutes * 60},
  ${thumbnailPrompt}
  "scenes": [
    {
      "type": "Hook",
      "duration": 20,
      "visual": "Detailed cinematic camera shot description",
      "narration": "Full word-for-word narration text that would be spoken out loud",
      "broll": "B-roll footage suggestion"
    }
  ]
}

Scene types to use: Hook, Intro, Background, Main Point 1, Main Point 2, Main Point 3, Example, Story, Tips, Summary, Conclusion, CTA
Generate exactly ${sceneCount.split('-')[1]} scenes minimum. Each scene should be 20-60 seconds of spoken content. Make every narration detailed, engaging, and complete — never cut short.`;

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
        max_tokens: 8000,
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
