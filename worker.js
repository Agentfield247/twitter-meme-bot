require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// --- NEW: THE ENGAGEMENT HOOKS ---
const HOOKS = [
  "Tag a friend who is exactly like this 👇",
  "Why does this hit so hard? 😂",
  "GM, Let's connect",
  "If this isn't me, I don't know what is.",
  "Who else feels attacked by this?",
  "Send this to your work bestie.",
  "Valid or nah?",
  "I'm in this picture and I don't like it.",
  "Type 'YES' if you relate.",
  "Daily reminder: You are doing great (but this is funny).",
];

const HASHTAGS = [
  "#memes",
  "#humor",
  "#relatable",
  "#funny",
  "#lol",
  "#dailyhumor",
  "#trending",
  "#memelo1d",
];

async function postNextMeme() {
  console.log("🤖 Worker waking up...");

  const { data: meme, error } = await supabase
    .from("meme_queue")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .single();

  if (error || !meme) {
    return console.log("💤 No pending memes found.");
  }

  console.log(`🎯 Processing: ${meme.title}`);

  try {
    // Download via Proxy (The "Laundry")
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(meme.image_url)}&output=jpg`;
    const imageResponse = await axios.get(proxyUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Upload Media
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/jpeg",
    });

    // --- NEW: CONSTRUCT THE SUPER CAPTION ---

    // 1. Pick a random Hook
    const randomHook = HOOKS[Math.floor(Math.random() * HOOKS.length)];

    // 2. Pick 3 random Hashtags (Don't spam the same ones)
    const shuffledTags = HASHTAGS.sort(() => 0.5 - Math.random());
    const selectedTags = shuffledTags.slice(0, 3).join(" ");

    // 3. Build the Tweet Text
    // Structure: "Meme Title" + "Invisible Char" + "Engagement Hook" + "Hashtags"
    const finalTweet = `${meme.title}\n\n${randomHook}\n\n${selectedTags}`;

    await twitterClient.v2.tweet({
      text: finalTweet,
      media: { media_ids: [mediaId] },
    });

    await supabase
      .from("meme_queue")
      .update({ status: "published" })
      .eq("id", meme.id);
    console.log(`🚀 SUCCESS! Posted with Hook: "${randomHook}"`);
  } catch (err) {
    console.error("❌ Error posting meme:", err.message);
    console.log("🗑️ Trashing bad meme...");
    await supabase
      .from("meme_queue")
      .update({ status: "error" })
      .eq("id", meme.id);
  }
}

postNextMeme();
