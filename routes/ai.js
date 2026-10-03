import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import Cafe from '../models/Cafe.js';

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key',
});

router.post('/recommend', async (req, res) => {
  try {
    const { prompt, lat, lng } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // First fetch nearby cafes to give to the AI
    let cafes = [];
    if (lat && lng) {
      // Find cafes in local DB within ~10km (0.1 deg approx)
      const degreeOffset = 0.1;
      cafes = await Cafe.find({
        'location.lat': { $gte: Number(lat) - degreeOffset, $lte: Number(lat) + degreeOffset },
        'location.lng': { $gte: Number(lng) - degreeOffset, $lte: Number(lng) + degreeOffset },
      }).lean();
    } else {
      cafes = await Cafe.find().limit(50).lean();
    }

    if (cafes.length === 0) {
      return res.json({ 
        message: "I couldn't find any cafes nearby to recommend from! Try increasing your search radius or exploring another area.",
        recommendedCafes: [] 
      });
    }

    // Format cafes for the prompt
    const cafesContext = cafes.map(c => `
ID: ${c._id}
Name: ${c.name}
Tags: ${c.tags.join(', ')}
Rating: ${c.rating}
Price Level (1-4): ${c.priceLevel}
Description: ${c.description || 'No description'}
`).join('\n');

    // Call Anthropic API
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
      // Fallback if no real API key is present
      // Match locally via simple heuristics
      const lowerPrompt = prompt.toLowerCase();
      const scoredCafes = cafes.map(c => {
        let score = 0;
        if (c.tags.some(t => lowerPrompt.includes(t.toLowerCase()))) score += 10;
        if (c.name.toLowerCase().includes(lowerPrompt)) score += 5;
        if (c.description && c.description.toLowerCase().includes(lowerPrompt)) score += 5;
        if (lowerPrompt.includes('quiet') && c.tags.includes('quiet')) score += 20;
        if (lowerPrompt.includes('work') && c.tags.includes('wifi')) score += 20;
        return { cafe: c, score };
      }).sort((a, b) => b.score - a.score);

      const topCafes = scoredCafes.slice(0, 3).map(s => s.cafe);
      
      return res.json({
        message: `Based on your request "${prompt}", here are some highly recommended spots. (Note: using fallback heuristic search since Anthropic API key is not configured).`,
        recommendedCafes: topCafes
      });
    }

    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      temperature: 0.7,
      system: "You are an expert cafe concierge. Based on the user's mood/prompt and the provided list of local cafes, recommend the top 2-3 cafes that best fit their request. Respond with a friendly, conversational paragraph explaining why you picked them. End your response with a JSON array wrapped in <cafe_ids> tag containing ONLY the IDs of the cafes you recommended. For example: <cafe_ids>[\"id1\", \"id2\"]</cafe_ids>",
      messages: [
        {
          role: "user",
          content: `User's Request: "${prompt}"\n\nAvailable Cafes:\n${cafesContext}`
        }
      ]
    });

    const aiText = msg.content[0].text;
    
    // Extract IDs
    const idsMatch = aiText.match(/<cafe_ids>(.*?)<\/cafe_ids>/s);
    let recommendedIds = [];
    if (idsMatch) {
      try {
        recommendedIds = JSON.parse(idsMatch[1]);
      } catch(e) {
        console.error('Failed to parse AI cafe IDs', idsMatch[1]);
      }
    }
    
    const message = aiText.replace(/<cafe_ids>.*?<\/cafe_ids>/s, '').trim();
    
    // Get full cafe objects
    const recommendedCafes = recommendedIds.map(id => cafes.find(c => c._id.toString() === id)).filter(Boolean);

    res.json({
      message,
      recommendedCafes
    });
    
  } catch (error) {
    console.error('AI Recommend Error:', error);
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
});

export default router;
