require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
const googleTrends = require("google-trends-api"); // NEW TOOL

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

const HOOKS = [
  "Tag a friend who is exactly like this 👇",
  "Why does this hit so hard? 😂",
  "DM, if you want to automate your memes so you do not lose engagement while away",
  "Trending",
  "#x",
  "What are your thoughts",
  "Valid or nah?",
  "Type 'YES' if you relate.",
];

// Fallback tags if Google fails
const HASHTAGS = [
  "#memes",
  "#humor",
  "#relatable",
  "#funny",
  "#lol",
  "#dailyhumor",
  "#trending",
  "#wierd",
];

// --- NEW FUNCTION: GET REAL TRENDS ---
async function getTrendingTag() {
  try {
    console.log("📈 Fetching Google Trends...");
    // We look for trends in the US (Global standard for memes)
    // You can change 'US' to 'NG' if you want Nigerian trends
    const results = await googleTrends.realTimeTrends({
      geo: "US",
      category: "all",
    });

    const json = JSON.parse(results);
    const story = json.storySummaries.trendingStories[0]; // Get the #1 top story

    if (story && story.entityNames && story.entityNames.length > 0) {
      // Clean the trend (e.g., "Elon Musk" -> "#ElonMusk")
      const rawTrend = story.entityNames[0];
      const cleanTrend = "#" + rawTrend.replace(/\s+/g, "");
      console.log(`🔥 Hot Trend Found: ${cleanTrend}`);
      return cleanTrend;
    }
  } catch (err) {
    console.error("⚠️ Could not fetch trends, using defaults.");
  }
  return null; // Return nothing if it fails
}

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
    // 1. Get the Image
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(meme.image_url)}&output=jpg`;
    const imageResponse = await axios.get(proxyUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // 2. Upload Media
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/jpeg",
    });

    // 3. Get a Live Trend
    const trendingTag = await getTrendingTag();

    // 4. Build Caption
    const randomHook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
    const shuffledTags = HASHTAGS.sort(() => 0.5 - Math.random());
    let selectedTags = shuffledTags.slice(0, 2).join(" "); // Pick 2 standard tags

    // Add the Trending Tag to the front (if we found one)
    if (trendingTag) {
      selectedTags = `${trendingTag} ${selectedTags}`;
    }

    const finalTweet = `${meme.title}\n\n${randomHook}\n\n${selectedTags}`;

    // 5. Post
    await twitterClient.v2.tweet({
      text: finalTweet,
      media: { media_ids: [mediaId] },
    });

    await supabase
      .from("meme_queue")
      .update({ status: "published" })
      .eq("id", meme.id);
    console.log(`🚀 SUCCESS! Posted with Trend: "${trendingTag || "None"}"`);
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
