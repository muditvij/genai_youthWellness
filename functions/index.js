const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.chatProxy = functions.https.onRequest(async (req, res) => {
  // Set CORS headers for cross-origin requests
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { text, moodScore, name, chatHistory } = req.body;
    
    // Get the API key from Firebase config
    const apiKey = functions.config().gemini.api_key;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    // Your existing generateReply logic
    const moodDescription = "Neutral"; // You'll need to implement mood mapping
    const systemPrompt = `You are YouthMind, a playful and supportive pocket buddy for young adults in India. Your vibe is chatty, funny, and full of warmth — like a best friend who's always ready to listen. You're not a doctor, just a crazy-good listener who mixes empathy with jokes, hype, and desi vibes.

The user's name is ${name || "Friend"}, and today they're feeling ${moodDescription}.
Your replies should:

Be short and lively if the user shares something casual.

Expand into a descriptive but still engaging response (max 250–300 words) if the user's input genuinely needs it.

Use emojis, humor, and curiosity to keep the convo flowing. Break long replies into short, readable chunks.

If the user hints at self-harm, depression, or overwhelming distress:

Pause the humor.

Switch to a mature, calm, and empathetic tone.

Offer comfort, remind them they're not alone, and gently suggest reaching out to a trusted friend, family member, or professional.

Keep the language supportive and never judgmental. If user talk to you in hinglish then talk to user in hinglish.`;

    const payload = {
      contents: [...chatHistory, { role: 'user', parts: [{ text }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`API Error: ${errorBody.error.message}`);
    }
    
    const result = await response.json();
    const candidate = result.candidates?.[0];
    const botText = candidate?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
    
    const crisisWords = ["suicide", "kill myself", "end it all", "self-harm", "cutting myself", "hopeless", "worthless", "no reason to live", "want to die", "better off dead", "end my life"];
    const isCrisis = crisisWords.some(w => text.toLowerCase().includes(w));
    
    const responseData = { 
      text: isCrisis ? `Thank you for sharing that with me, ${name}. I'm hearing a lot of pain in your words, and I want you to know I'm here and listening. Your safety is the most important thing right now. If you're in immediate danger, please reach out to emergency services (like 112 in India) or a trusted adult. You're not alone in this. Sometimes just taking a moment to breathe can help. Can we try taking one slow, deep breath together? Inhale... and exhale.<b> check below you can talk to our counncellors, if feeling not good.` : botText,
      crisis: isCrisis
    };
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in chat proxy:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});