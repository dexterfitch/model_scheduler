export const formatSkinTone = (tone) => {
  if (!tone || tone === "Any") return "Any Skintone";
  if (tone.toLowerCase().includes("skintone")) return tone;
  return `${tone} Skintone`;
};