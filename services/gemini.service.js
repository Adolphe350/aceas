const { GoogleGenerativeAI } = require('@google/generative-ai');

function buildFallbackRecommendations(scores, projectDescription, reason) {
  const lowDomains = [
    ['Privacy', scores.privacyScore, [
      'Minimize collection of personal data and document a lawful basis for processing.',
      'Add or strengthen consent, retention, anonymization, and encryption controls.',
      'Create a privacy notice and run a DPIA for higher-risk use cases.'
    ]],
    ['Fairness', scores.fairnessScore, [
      'Test for bias across relevant demographic groups and keep the results.',
      'Add human review or appeal paths for impactful decisions.',
      'Improve dataset representativeness and track model performance drift.'
    ]],
    ['Security', scores.securityScore, [
      'Run a security risk assessment and threat model for the system.',
      'Enforce role-based access control, secrets management, and audit logging.',
      'Add incident response, vulnerability patching, and adversarial robustness checks.'
    ]],
    ['Transparency', scores.transparencyScore, [
      'Publish user-facing disclosures that the system uses AI.',
      'Prepare model documentation, a model card, and explanation limits.',
      'Document training data sources, intended use, and known constraints.'
    ]],
    ['Accountability', scores.accountabilityScore, [
      'Assign a named owner responsible for model outcomes and approvals.',
      'Create a process for reporting harm, escalation, and remediation.',
      'Require periodic independent review before major releases.'
    ]],
  ].filter(([, score]) => score < 75);

  const priorityList = lowDomains.length
    ? lowDomains.map(([name, score]) => `- ${name} (${score.toFixed(1)}%)`).join('\n')
    : '- No domain is below 75%; focus on continuous monitoring and documentation.';

  const domainSections = lowDomains.length
    ? lowDomains.map(([name, score, tips]) => `${name} (${score.toFixed(1)}%)\n- ${tips.join('\n- ')}`).join('\n\n')
    : 'All domains are currently at or above 75%. Maintain documentation, monitoring, and periodic reviews.';

  return `AI Recommendations\n\nSummary\nThis assessment produced an overall compliance score of ${scores.overall.toFixed(1)}% (${scores.riskLevel}). ${projectDescription ? `Project context: ${projectDescription}. ` : ''}The recommendations below were generated locally because the Gemini service is currently unavailable${reason ? ` (${reason})` : ''}.\n\nTop priority areas\n${priorityList}\n\nDomain-specific actions\n${domainSections}\n\nOverall improvement steps\n- Prioritize remediation for every domain scoring below 75%.\n- Keep evidence for controls, testing, and governance decisions.\n- Re-run the assessment after fixes and compare score changes over time.\n\nRelevant frameworks to prioritize\n- GDPR / local data protection law for privacy and lawful processing\n- EU AI Act risk management, transparency, and human oversight requirements\n- ISO/IEC 27001 or equivalent security governance controls\n- NIST AI RMF for governance, mapping, measurement, and management`;}

async function getRecommendations(scores, projectDescription) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'REPLACE_WITH_GEMINI_KEY' || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return buildFallbackRecommendations(scores, projectDescription, 'GEMINI_API_KEY not configured');
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
    return buildFallbackRecommendations(scores, projectDescription, `Gemini API unavailable: ${err.message}`);
  }
}

module.exports = { getRecommendations };
