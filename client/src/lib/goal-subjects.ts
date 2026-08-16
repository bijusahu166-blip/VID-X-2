export const goalSubjectMap: Record<string, string[]> = {
  ias: ["ias", "upsc", "current affairs", "general studies", "civil services", "prelims", "mains", "essay"],
  doctor: ["medical", "doctor", "neer", "mbbs", "aiims", "neet", "health", "medicine"],
  engineer: ["coding", "engineering", "programming", "tech", "computer science", "cs", "software", "development"],
  teacher: ["teaching", "education", "classes", "school", "tutor", "learning", "study tips"],
  business: ["business", "startup", "entrepreneur", "finance", "marketing", "economy", "sales"],
  vfx: ["vfx", "animation", "design", "motion graphics", "visual effects", "film making"],
  fitness: ["fitness", "workout", "gym", "health", "nutrition", "exercise", "wellness"],
  reading: ["books", "reading", "learning", "study", "knowledge", "personal growth"],
  law: ["law", "llb", "judiciary", "legal", "advocate", "courts", "civil law"],
  ca: ["ca", "finance", "accounting", "tax", "audit", "business finance"],
  design: ["design", "ui/ux", "graphics", "visual design", "product design", "creative"],
  music: ["music", "artist", "singing", "instrument", "songwriting", "performance"],
  sports: ["sports", "athlete", "fitness", "training", "match", "game"],
  neet: ["neet", "medical", "biology", "chemistry", "physics", "exam prep"],
  defense: ["army", "defense", "navy", "air force", "paramilitary", "rdso", "security"],
  content: ["content", "creator", "social media", "vlogging", "influencer", "editing"],
  aviation: ["aviation", "pilot", "airline", "airport", "flight", "aircraft"],
  police: ["police", "ssc", "constable", "station", "law enforcement", "civil services"],
  pharmacy: ["pharmacy", "drugs", "medicinal", "pharmacist", "clinical", "pharma"],
  acting: ["acting", "drama", "theatre", "film", "cinema", "performance"],
  chef: ["chef", "culinary", "cooking", "food", "recipes", "baking"],
  cyber: ["cyber", "security", "ethical hacking", "information security", "network security"],
  space: ["space", "isro", "astronomy", "rocket", "satellite", "aerospace"],
  language: ["language", "learning", "speaking", "vocabulary", "grammar", "communication"],
};

export function getGoalSubjects(goal: string | null | undefined) {
  if (!goal) return [];
  return goalSubjectMap[goal] ?? [];
}

