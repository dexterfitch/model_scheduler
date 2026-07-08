export const formatSkinTone = (tone) => {
  if (!tone || tone === "Any") return "Any Skintone";
  if (tone.toLowerCase().includes("skintone")) return tone;
  return `${tone} Skintone`;
};

export const extractErrorMessages = (err, fallback) => {
  const messages = err.response?.data?.errors || [err.response?.data?.error] || [fallback];
  return Array.isArray(messages) ? messages.join(" ") : messages;
};

export const calculateMatchScore = (user, target) => {
  let score = 0;
  if (user.skin_tone === target.pref_skin_tone) score++;
  if (user.gender_identity === target.pref_gender) score++;
  return score;
};