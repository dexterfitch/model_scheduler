export const formatSkinTone = (tone) => {
  if (!tone || tone === "Any") return "Any Skintone";
  // If it already says "Skintone", don't add it again
  if (tone.toLowerCase().includes("skintone")) return tone;
  return `${tone} Skintone`;
};