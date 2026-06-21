function calculateScores(answers) {
  const privacy = [answers.q1, answers.q2, answers.q3, answers.q4];
  const fairness = [answers.q5, answers.q6, answers.q7, answers.q8];
  const security = [answers.q9, answers.q10, answers.q11, answers.q12];
  const transparency = [answers.q13, answers.q14, answers.q15, answers.q16];
  const accountability = [answers.q17, answers.q18, answers.q19, answers.q20];

  const score = (arr) => (arr.filter(Boolean).length / 4) * 100;

  const privacyScore = score(privacy);
  const fairnessScore = score(fairness);
  const securityScore = score(security);
  const transparencyScore = score(transparency);
  const accountabilityScore = score(accountability);

  const overall = (
    privacyScore * 0.25 +
    fairnessScore * 0.25 +
    securityScore * 0.20 +
    transparencyScore * 0.15 +
    accountabilityScore * 0.15
  );

  let riskLevel;
  if (overall >= 80) riskLevel = 'Low Risk';
  else if (overall >= 60) riskLevel = 'Medium Risk';
  else if (overall >= 40) riskLevel = 'High Risk';
  else riskLevel = 'Critical Risk';

  return {
    privacyScore,
    fairnessScore,
    securityScore,
    transparencyScore,
    accountabilityScore,
    overall,
    riskLevel
  };
}

module.exports = { calculateScores };
