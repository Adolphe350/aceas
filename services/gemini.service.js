const { GoogleGenerativeAI } = require('@google/generative-ai');

async function getRecommendations(scores, projectDescription) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'REPLACE_WITH_GEMINI_KEY' || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return `[AI Recommendations unavailable — GEMINI_API_KEY not configured]\n\nBased on your scores:\n- Privacy: ${scores.privacyScore.toFixed(1)}%\n- Fairness: ${scores.fairnessScore.toFixed(1)}%\n- Security: ${scores.securityScore.toFixed(1)}%\n- Transparency: ${scores.transparencyScore.toFixed(1)}%\n- Accountability: ${scores.accountabilityScore.toFixed(1)}%\n- Overall: ${scores.overall.toFixed(1)}% (${scores.riskLevel})\n\nPlease configure a Gemini API key to receive detailed AI-powered recommendations.`;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an AI ethics compliance expert. Analyze the following AI system assessment results and provide specific, actionable recommendations.

Project Description: ${projectDescription || 'Not provided'}

Assessment Scores:
- Privacy Score: ${scores.privacyScore.toFixed(1)}%
- Fairness Score: ${scores.fairnessScore.toFixed(1)}%
- Security Score: ${scores.securityScore.toFixed(1)}%
- Transparency Score: ${scores.transparencyScore.toFixed(1)}%
- Accountability Score: ${scores.accountabilityScore.toFixed(1)}%
- Overall Compliance Score: ${scores.overall.toFixed(1)}%
- Risk Level: ${scores.riskLevel}

Please provide:
1. A brief summary of the system's compliance status (2-3 sentences)
2. The top 3 areas requiring immediate attention
3. Specific recommendations for each low-scoring domain (below 75%)
4. Steps to improve the overall compliance posture
5. Any regulatory frameworks (GDPR, EU AI Act, etc.) this system should prioritize

Format your response clearly with headings and bullet points. Be specific and actionable.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return `AI recommendations could not be generated at this time (API error: ${err.message}). Please review your scores manually and address any domains scoring below 75%.`;
  }
}

module.exports = { getRecommendations };
