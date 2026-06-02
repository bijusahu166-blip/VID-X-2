export interface AREffect {
  id: string;
  name: string;
  emoji: string;
  filter: string;
  overlay?: string;
  animation?: string;
  heroIcon?: boolean;
}

export const AR_EFFECTS: AREffect[] = [
  { id: "none",          name: "No Filter",     emoji: "🎥", filter: "none" },

  // 🔥 Premium AR
  { id: "neon_glow",     name: "Neon Glow",     emoji: "⚡", filter: "saturate(3) brightness(1.1) hue-rotate(90deg) contrast(1.2)",         overlay: "radial-gradient(ellipse at center, rgba(0,255,128,0.1) 0%, transparent 70%)" },
  { id: "cyber_face",    name: "Cyber Face",    emoji: "🔵", filter: "hue-rotate(200deg) saturate(2.8) contrast(1.5) brightness(0.9)",       overlay: "linear-gradient(135deg, rgba(0,200,255,0.12) 0%, rgba(80,0,255,0.1) 100%)" },
  { id: "holo_vision",   name: "Holo Vision",   emoji: "🌐", filter: "hue-rotate(120deg) saturate(2.2) brightness(1.15) contrast(1.2)",      overlay: "linear-gradient(45deg, rgba(255,0,255,0.08) 0%, rgba(0,255,255,0.08) 50%, rgba(255,255,0,0.06) 100%)" },
  { id: "quantum_blur",  name: "Quantum Blur",  emoji: "🌀", filter: "blur(1.2px) brightness(1.2) saturate(1.8) hue-rotate(240deg)",         overlay: "radial-gradient(ellipse at center, rgba(120,0,255,0.15) 0%, transparent 70%)" },
  { id: "pixel_storm",   name: "Pixel Storm",   emoji: "🟣", filter: "contrast(2.2) saturate(3) hue-rotate(30deg) brightness(0.85)",         overlay: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,0,200,0.05) 3px, rgba(255,0,200,0.05) 6px)", animation: "glitch" },
  { id: "galaxy_aura",   name: "Galaxy Aura",   emoji: "🌌", filter: "brightness(0.8) contrast(1.4) saturate(2) hue-rotate(210deg)",         overlay: "radial-gradient(ellipse at center, rgba(60,0,120,0.3) 0%, rgba(0,0,40,0.4) 100%)" },
  { id: "infinity_light",name: "Infinity Light",emoji: "💫", filter: "brightness(1.5) contrast(0.9) saturate(1.5) hue-rotate(300deg)",       overlay: "radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, transparent 60%)" },
  { id: "prism_shift",   name: "Prism Shift",   emoji: "🌈", filter: "hue-rotate(60deg) saturate(2.5) contrast(1.3) brightness(1.05)",       overlay: "linear-gradient(135deg, rgba(255,0,0,0.06), rgba(0,255,0,0.06), rgba(0,0,255,0.06))" },
  { id: "aura_flame",    name: "Aura Flame",    emoji: "🔥", filter: "hue-rotate(350deg) saturate(2.5) contrast(1.3) brightness(1.05)",      overlay: "linear-gradient(to top, rgba(255,80,0,0.2) 0%, rgba(255,200,0,0.08) 60%, transparent 100%)" },
  { id: "dream_wave",    name: "Dream Wave",    emoji: "🌊", filter: "blur(0.6px) hue-rotate(180deg) saturate(2) brightness(1.1)",           overlay: "linear-gradient(to bottom, rgba(0,180,255,0.15) 0%, rgba(100,0,255,0.1) 100%)" },

  // 😎 Face Beauty
  { id: "velvet_skin",   name: "Velvet Skin",   emoji: "🧴", filter: "blur(0.3px) brightness(1.1) saturate(1.3) hue-rotate(10deg)",          overlay: "radial-gradient(ellipse at center, rgba(255,200,180,0.12) 0%, transparent 70%)" },
  { id: "glowup_pro",    name: "GlowUp Pro",    emoji: "✨", filter: "brightness(1.25) saturate(1.6) contrast(0.95) hue-rotate(15deg)",       overlay: "radial-gradient(ellipse at top, rgba(255,230,180,0.2) 0%, transparent 60%)" },
  { id: "crystal_face",  name: "Crystal Face",  emoji: "💎", filter: "brightness(1.3) saturate(0.7) contrast(1.1) hue-rotate(190deg)",        overlay: "radial-gradient(ellipse at center, rgba(180,240,255,0.2) 0%, transparent 70%)" },
  { id: "soft_charm",    name: "Soft Charm",    emoji: "🌸", filter: "blur(0.4px) brightness(1.15) saturate(1.4) hue-rotate(330deg)",        overlay: "radial-gradient(ellipse at center, rgba(255,180,220,0.15) 0%, transparent 70%)" },
  { id: "insta_shine",   name: "Insta Shine",   emoji: "📸", filter: "brightness(1.35) contrast(0.9) saturate(1.5) hue-rotate(20deg)",       overlay: "radial-gradient(ellipse at top, rgba(255,255,220,0.2) 0%, transparent 50%)" },
  { id: "royal_look",    name: "Royal Look",    emoji: "👑", filter: "hue-rotate(260deg) saturate(1.8) brightness(1.1) contrast(1.15)",       overlay: "radial-gradient(ellipse at top, rgba(180,130,255,0.18) 0%, transparent 60%)" },
  { id: "smooth_magic",  name: "Smooth Magic",  emoji: "🪄", filter: "blur(0.35px) brightness(1.12) saturate(1.3) contrast(0.95)",            overlay: "radial-gradient(ellipse at center, rgba(255,220,200,0.12) 0%, transparent 70%)" },
  { id: "perfect_tone",  name: "Perfect Tone",  emoji: "🌟", filter: "brightness(1.1) saturate(1.4) contrast(1.05) hue-rotate(5deg)",         overlay: "radial-gradient(ellipse at top, rgba(255,230,190,0.14) 0%, transparent 60%)" },
  { id: "diamond_skin",  name: "Diamond Skin",  emoji: "💍", filter: "brightness(1.25) saturate(0.8) contrast(1.2) hue-rotate(200deg)",       overlay: "radial-gradient(ellipse at center, rgba(200,240,255,0.18) 0%, transparent 70%)" },
  { id: "angel_glow",    name: "Angel Glow",    emoji: "😇", filter: "brightness(1.4) contrast(0.85) saturate(0.9) blur(0.2px)",             overlay: "radial-gradient(ellipse at top, rgba(255,255,255,0.3) 0%, transparent 50%)" },

  // 🌈 Fun & Cute
  { id: "bunny_ears",    name: "Bunny Ears",    emoji: "🐰", filter: "brightness(1.1) saturate(1.2) hue-rotate(340deg) contrast(1.05)",       overlay: "radial-gradient(ellipse at center, rgba(255,200,220,0.15) 0%, transparent 70%)" },
  { id: "puppy_love",    name: "Puppy Love",    emoji: "🐶", filter: "sepia(0.3) saturate(1.6) brightness(1.05) hue-rotate(20deg)",            overlay: "radial-gradient(ellipse at bottom, rgba(180,120,60,0.15) 0%, transparent 70%)" },
  { id: "cartoon_pop",   name: "Cartoon Pop",   emoji: "🎨", filter: "saturate(3.5) contrast(1.8) brightness(1.1)" },
  { id: "emoji_blast",   name: "Emoji Blast",   emoji: "🎉", filter: "saturate(2.8) brightness(1.2) contrast(1.3) hue-rotate(45deg)",          overlay: "linear-gradient(135deg, rgba(255,0,128,0.1), rgba(0,255,128,0.08), rgba(128,0,255,0.08))" },
  { id: "candy_face",    name: "Candy Face",    emoji: "🍬", filter: "hue-rotate(300deg) saturate(2.5) brightness(1.2) contrast(1.1)",         overlay: "radial-gradient(ellipse at center, rgba(255,100,200,0.18) 0%, transparent 70%)" },
  { id: "baby_doll",     name: "Baby Doll",     emoji: "🍼", filter: "blur(0.3px) brightness(1.2) saturate(1.2) hue-rotate(340deg)",           overlay: "radial-gradient(ellipse at center, rgba(255,220,240,0.2) 0%, transparent 60%)" },
  { id: "funny_mirror",  name: "Funny Mirror",  emoji: "🪞", filter: "contrast(2) saturate(2.5) hue-rotate(90deg) brightness(1.15)" },
  { id: "big_eyes",      name: "Big Eyes FX",   emoji: "👀", filter: "brightness(1.15) contrast(1.2) saturate(1.5) hue-rotate(5deg)",          overlay: "radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 80%)" },
  { id: "smile_boost",   name: "Smile Boost",   emoji: "😁", filter: "brightness(1.25) saturate(1.7) hue-rotate(25deg) contrast(1.05)",        overlay: "radial-gradient(ellipse at center, rgba(255,220,100,0.18) 0%, transparent 70%)" },
  { id: "choco_mood",    name: "Choco Mood",    emoji: "🍫", filter: "sepia(0.7) contrast(1.2) brightness(0.9) saturate(1.1)",                 overlay: "radial-gradient(ellipse at bottom, rgba(80,40,10,0.25) 0%, transparent 70%)" },

  // 🚀 Sci-Fi
  { id: "robo_mask",     name: "Robo Mask",     emoji: "🤖", filter: "grayscale(0.6) contrast(1.6) brightness(0.9) hue-rotate(180deg)",       overlay: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.06) 2px, rgba(0,255,200,0.06) 4px)" },
  { id: "ai_face",       name: "AI Face",       emoji: "🧠", filter: "hue-rotate(170deg) saturate(2.5) contrast(1.5) brightness(0.85)",       overlay: "linear-gradient(to bottom, rgba(0,255,180,0.15) 0%, rgba(0,100,255,0.1) 100%)" },
  { id: "laser_eyes",    name: "Laser Eyes",    emoji: "🔴", filter: "hue-rotate(0deg) saturate(3) contrast(2) brightness(0.8)",              overlay: "radial-gradient(ellipse at center, rgba(255,0,0,0.2) 0%, transparent 70%)" },
  { id: "space_helmet",  name: "Space Helmet",  emoji: "🪐", filter: "brightness(0.75) contrast(1.5) saturate(1.8) hue-rotate(210deg)",       overlay: "radial-gradient(ellipse at top, rgba(0,0,60,0.5) 0%, transparent 60%)" },
  { id: "digital_avatar",name: "Digital Avatar",emoji: "🖥️", filter: "hue-rotate(120deg) saturate(3) contrast(1.8) brightness(0.85)",          overlay: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,255,80,0.04) 3px, rgba(0,255,80,0.04) 6px)" },
  { id: "matrix_mode",   name: "Matrix Mode",   emoji: "💻", filter: "grayscale(1) brightness(1.2) contrast(1.6) sepia(0.2)",                 overlay: "linear-gradient(to bottom, rgba(0,255,0,0.12) 0%, rgba(0,100,0,0.1) 100%)", animation: "glitch" },
  { id: "iron_face",     name: "Iron Face",     emoji: "🦾", filter: "grayscale(0.8) contrast(1.8) brightness(0.9) hue-rotate(200deg)",       overlay: "linear-gradient(135deg, rgba(100,150,200,0.15) 0%, rgba(50,80,120,0.1) 100%)" },
  { id: "cyberpunk_fx",  name: "Cyberpunk FX",  emoji: "⚙️", filter: "hue-rotate(250deg) saturate(3) contrast(1.6) brightness(0.88)",         overlay: "linear-gradient(135deg, rgba(200,0,255,0.14) 0%, rgba(0,200,255,0.1) 100%)", animation: "glitch" },
  { id: "neon_mask",     name: "Neon Mask",     emoji: "🎭", filter: "hue-rotate(310deg) saturate(3.5) contrast(1.4) brightness(1.0)",         overlay: "radial-gradient(ellipse at center, rgba(255,0,200,0.15) 0%, transparent 70%)" },
  { id: "tech_vision",   name: "Tech Vision",   emoji: "🔬", filter: "hue-rotate(190deg) saturate(2) contrast(1.4) brightness(1.05)",          overlay: "repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,200,255,0.05) 4px, rgba(0,200,255,0.05) 8px)" },

  // 🌿 Nature
  { id: "sunset_glow",   name: "Sunset Glow",   emoji: "🌅", filter: "hue-rotate(340deg) saturate(2.2) brightness(1.1) contrast(1.15)",        overlay: "linear-gradient(to top, rgba(255,80,0,0.2) 0%, rgba(255,160,0,0.1) 50%, transparent 100%)" },
  { id: "golden_hour",   name: "Golden Hour",   emoji: "☀️", filter: "sepia(0.35) saturate(2.5) brightness(1.12) hue-rotate(15deg)",            overlay: "radial-gradient(ellipse at top, rgba(255,200,0,0.18) 0%, transparent 60%)" },
  { id: "rain_mood",     name: "Rain Mood",     emoji: "🌧️", filter: "hue-rotate(210deg) saturate(0.7) brightness(0.9) contrast(1.1)",          overlay: "repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(150,200,255,0.04) 6px, rgba(150,200,255,0.04) 7px)" },
  { id: "snow_magic",    name: "Snow Magic",    emoji: "❄️", filter: "brightness(1.3) saturate(0.5) contrast(1.05) hue-rotate(195deg)",         overlay: "radial-gradient(ellipse at top, rgba(220,240,255,0.3) 0%, transparent 60%)" },
  { id: "forest_dream",  name: "Forest Dream",  emoji: "🌲", filter: "hue-rotate(100deg) saturate(2) brightness(0.92) contrast(1.15)",           overlay: "radial-gradient(ellipse at center, rgba(0,120,30,0.15) 0%, transparent 70%)" },
  { id: "ocean_breeze",  name: "Ocean Breeze",  emoji: "🌊", filter: "hue-rotate(185deg) saturate(1.8) brightness(1.05) contrast(1.1)",          overlay: "linear-gradient(to bottom, rgba(0,180,220,0.15) 0%, rgba(0,80,180,0.12) 100%)" },
  { id: "flower_crown",  name: "Flower Crown",  emoji: "🌺", filter: "hue-rotate(330deg) saturate(2.2) brightness(1.1) contrast(1.05)",          overlay: "radial-gradient(ellipse at top, rgba(255,120,180,0.2) 0%, transparent 60%)" },
  { id: "sky_light",     name: "Sky Light",     emoji: "🌤️", filter: "hue-rotate(190deg) saturate(1.5) brightness(1.2) contrast(0.95)",          overlay: "linear-gradient(to bottom, rgba(130,200,255,0.2) 0%, transparent 50%)" },
  { id: "moon_shine",    name: "Moon Shine",    emoji: "🌙", filter: "grayscale(0.4) brightness(1.15) contrast(1.1) hue-rotate(210deg)",         overlay: "radial-gradient(ellipse at top, rgba(200,220,255,0.2) 0%, transparent 60%)" },
  { id: "vintage_vibe",  name: "Vintage Vibe",  emoji: "🎞️", filter: "sepia(0.65) contrast(1.2) brightness(0.92) saturate(0.85)",               overlay: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)" },

  // 💎 Bonus
  { id: "aurax",         name: "AuraX",         emoji: "🔮", filter: "hue-rotate(270deg) saturate(3) brightness(1.05) contrast(1.3)",            overlay: "radial-gradient(ellipse at center, rgba(160,0,255,0.2) 0%, transparent 70%)" },
  { id: "vibeshift",     name: "VibeShift",     emoji: "🎵", filter: "hue-rotate(135deg) saturate(2.8) contrast(1.2) brightness(1.08)",           overlay: "linear-gradient(45deg, rgba(255,0,128,0.1) 0%, rgba(0,200,255,0.1) 100%)" },
  { id: "glownova",      name: "GlowNova",      emoji: "💥", filter: "brightness(1.5) saturate(2.5) contrast(1.1) hue-rotate(30deg)",             overlay: "radial-gradient(ellipse at center, rgba(255,200,0,0.25) 0%, transparent 60%)" },
  { id: "facefusion",    name: "FaceFusion",    emoji: "🔀", filter: "hue-rotate(60deg) saturate(3) contrast(1.4) brightness(1.0)",              overlay: "linear-gradient(180deg, rgba(0,255,200,0.1) 0%, rgba(255,0,200,0.1) 100%)" },
  { id: "dreamify",      name: "Dreamify",      emoji: "💭", filter: "blur(0.7px) brightness(1.2) saturate(1.6) hue-rotate(320deg)",             overlay: "radial-gradient(ellipse at center, rgba(200,150,255,0.2) 0%, transparent 70%)" },
  { id: "luxlens",       name: "LuxLens",       emoji: "🏆", filter: "sepia(0.2) brightness(1.2) saturate(2) contrast(1.15) hue-rotate(20deg)",  overlay: "radial-gradient(ellipse at top, rgba(255,215,0,0.2) 0%, transparent 60%)" },
  { id: "pixelaura",     name: "PixelAura",     emoji: "🎮", filter: "contrast(2.5) saturate(3.5) brightness(0.95)",                             overlay: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.05) 2px, rgba(0,255,255,0.05) 4px)", animation: "glitch" },
  { id: "snapmagic",     name: "SnapMagic",     emoji: "📷", filter: "brightness(1.3) contrast(1.15) saturate(1.8) hue-rotate(10deg)",            overlay: "radial-gradient(ellipse at top, rgba(255,255,200,0.2) 0%, transparent 50%)" },
  { id: "neolook",       name: "NeoLook",       emoji: "🆕", filter: "hue-rotate(155deg) saturate(2.5) contrast(1.35) brightness(1.05)",          overlay: "linear-gradient(135deg, rgba(0,255,180,0.12) 0%, rgba(0,100,255,0.1) 100%)" },
  { id: "hyperface",     name: "HyperFace",     emoji: "🌀", filter: "saturate(4) contrast(2) brightness(1.05) hue-rotate(75deg)",               overlay: "radial-gradient(ellipse at center, rgba(255,0,255,0.15) 0%, transparent 70%)" },

  // 🦸 Hollywood Hero Filters
  { id: "iron_hero",     name: "Iron Hero",     emoji: "🦾", heroIcon: true, filter: "grayscale(0.2) contrast(2) brightness(0.85) saturate(1.5) hue-rotate(195deg)",   overlay: "radial-gradient(ellipse at center, rgba(255,140,0,0.25) 0%, rgba(0,100,255,0.15) 60%, transparent 100%)" },
  { id: "thunder_god",   name: "Thunder God",   emoji: "⚡", heroIcon: true, filter: "brightness(1.3) contrast(1.8) saturate(2.5) hue-rotate(205deg)",                 overlay: "radial-gradient(ellipse at top, rgba(180,220,255,0.35) 0%, rgba(0,80,255,0.18) 50%, transparent 100%)", animation: "glitch" },
  { id: "super_strength",name: "Super Strength",emoji: "💪", heroIcon: true, filter: "brightness(1.15) contrast(1.6) saturate(2.8) hue-rotate(220deg)",                overlay: "linear-gradient(to top, rgba(0,0,180,0.2) 0%, rgba(255,0,0,0.12) 50%, transparent 100%)" },
  { id: "shield_warrior",name: "Shield Warrior",emoji: "🛡️", heroIcon: true, filter: "brightness(1.05) contrast(1.7) saturate(2) hue-rotate(185deg)",                  overlay: "radial-gradient(ellipse at center, rgba(0,180,255,0.22) 0%, rgba(0,60,180,0.15) 60%, transparent 100%)" },
  { id: "spy_mode",      name: "Spy Mode",      emoji: "🕵️", heroIcon: true, filter: "grayscale(0.5) brightness(0.78) contrast(1.9) sepia(0.15)",                      overlay: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)" },
  { id: "sniper_vision", name: "Sniper Vision", emoji: "🎯", heroIcon: true, filter: "grayscale(0.9) brightness(1.3) contrast(2.2) sepia(0.1)",                        overlay: "radial-gradient(circle at center, transparent 30%, rgba(0,255,0,0.08) 60%, rgba(0,80,0,0.2) 100%)", animation: "glitch" },
  { id: "assassin_shadow",name:"Assassin Shadow",emoji:"🗡️", heroIcon: true, filter: "brightness(0.65) contrast(2.2) saturate(0.3) grayscale(0.4)",                    overlay: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)" },
  { id: "gun_action",    name: "Gun Action FX", emoji: "🔫", heroIcon: true, filter: "brightness(1.15) contrast(1.8) saturate(3) hue-rotate(348deg)",                  overlay: "linear-gradient(to top, rgba(255,60,0,0.3) 0%, rgba(255,200,0,0.1) 40%, transparent 100%)", animation: "glitch" },
  { id: "cyberpunk_hero",name: "Cyberpunk Hero",emoji: "🌆", heroIcon: true, filter: "hue-rotate(265deg) saturate(4) contrast(1.9) brightness(0.82)",                  overlay: "linear-gradient(135deg, rgba(255,0,220,0.18) 0%, rgba(0,220,255,0.15) 100%)", animation: "glitch" },
  { id: "ai_mask",       name: "AI Mask",       emoji: "🤖", heroIcon: true, filter: "hue-rotate(145deg) saturate(2.5) contrast(1.7) brightness(1.08)",                overlay: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,150,0.07) 3px, rgba(0,255,150,0.07) 6px)" },
  { id: "hero_laser",    name: "Laser Eyes",    emoji: "👁️", heroIcon: true, filter: "brightness(0.78) contrast(2.3) saturate(3.5) hue-rotate(352deg)",               overlay: "radial-gradient(ellipse at 30% 40%, rgba(255,0,0,0.3) 0%, transparent 30%), radial-gradient(ellipse at 70% 40%, rgba(0,100,255,0.3) 0%, transparent 30%)" },
  { id: "robot_face",    name: "Robot Face",    emoji: "⚙️", heroIcon: true, filter: "grayscale(0.55) contrast(2) brightness(0.88) hue-rotate(192deg)",               overlay: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,200,255,0.06) 4px, rgba(0,200,255,0.06) 8px)" },
  { id: "cinema_4k",     name: "4K Cinematic",  emoji: "🎬", heroIcon: true, filter: "brightness(1.15) contrast(1.2) saturate(1.4) sepia(0.06)",                       overlay: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.35) 100%)" },
  { id: "portrait_blur", name: "Portrait Mode", emoji: "🖼️", heroIcon: true, filter: "blur(0.4px) brightness(1.12) contrast(1.1) saturate(1.5)",                       overlay: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,10,0.4) 100%)" },
  { id: "hollywood_grade",name:"Hollywood Grade",emoji:"🎥", heroIcon: true, filter: "sepia(0.28) contrast(1.5) brightness(0.92) saturate(2) hue-rotate(8deg)",         overlay: "radial-gradient(ellipse at center, transparent 50%, rgba(20,5,0,0.45) 100%)" },
  { id: "dramatic_light",name: "Dramatic Light",emoji: "🌟", heroIcon: true, filter: "brightness(0.78) contrast(1.8) saturate(1.6) hue-rotate(338deg)",                overlay: "linear-gradient(135deg, rgba(255,200,100,0.25) 0%, transparent 50%, rgba(0,0,50,0.4) 100%)" },
  { id: "ultraHero",     name: "UltraHero Mode",emoji: "🦸", heroIcon: true, filter: "brightness(1.2) contrast(2) saturate(3.5) hue-rotate(225deg)",                   overlay: "radial-gradient(ellipse at top, rgba(255,220,0,0.2) 0%, rgba(0,0,255,0.15) 50%, transparent 100%)", animation: "glitch" },
  { id: "metahero",      name: "MetaHero AR",   emoji: "🚀", heroIcon: true, filter: "hue-rotate(175deg) saturate(3.8) contrast(2.1) brightness(0.88)",                overlay: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,255,200,0.04) 5px, rgba(0,255,200,0.04) 10px)", animation: "glitch" },
  { id: "powerface",     name: "PowerFace Pro", emoji: "💫", heroIcon: true, filter: "brightness(1.3) contrast(1.9) saturate(3) hue-rotate(45deg)",                    overlay: "radial-gradient(ellipse at center, rgba(255,200,0,0.2) 0%, rgba(255,0,100,0.12) 50%, transparent 100%)" },
  { id: "cineface",      name: "CineFace FX",   emoji: "🎭", heroIcon: true, filter: "sepia(0.4) contrast(1.6) brightness(0.88) saturate(1.8) hue-rotate(355deg)",      overlay: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)" },
];

export const EFFECT_CATEGORIES = [
  { label: "All",     emoji: "🎥", ids: AR_EFFECTS.map(e => e.id) },
  { label: "Hero",    emoji: "🦸", ids: ["iron_hero","thunder_god","super_strength","shield_warrior","spy_mode","sniper_vision","assassin_shadow","gun_action","cyberpunk_hero","ai_mask","hero_laser","robot_face","cinema_4k","portrait_blur","hollywood_grade","dramatic_light","ultraHero","metahero","powerface","cineface"] },
  { label: "Premium", emoji: "🔥", ids: ["none","neon_glow","cyber_face","holo_vision","quantum_blur","pixel_storm","galaxy_aura","infinity_light","prism_shift","aura_flame","dream_wave"] },
  { label: "Beauty",  emoji: "😎", ids: ["velvet_skin","glowup_pro","crystal_face","soft_charm","insta_shine","royal_look","smooth_magic","perfect_tone","diamond_skin","angel_glow"] },
  { label: "Fun",     emoji: "🌈", ids: ["bunny_ears","puppy_love","cartoon_pop","emoji_blast","candy_face","baby_doll","funny_mirror","big_eyes","smile_boost","choco_mood"] },
  { label: "Sci-Fi",  emoji: "🚀", ids: ["robo_mask","ai_face","laser_eyes","space_helmet","digital_avatar","matrix_mode","iron_face","cyberpunk_fx","neon_mask","tech_vision"] },
  { label: "Nature",  emoji: "🌿", ids: ["sunset_glow","golden_hour","rain_mood","snow_magic","forest_dream","ocean_breeze","flower_crown","sky_light","moon_shine","vintage_vibe"] },
  { label: "Bonus",   emoji: "💎", ids: ["aurax","vibeshift","glownova","facefusion","dreamify","luxlens","pixelaura","snapmagic","neolook","hyperface"] },
];
