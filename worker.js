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

async function postNextMeme() {
  console.log("🤖 Worker waking up...");

  // 1. Get the next pending meme
  const { data: meme, error } = await supabase
    .from("meme_queue")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .single();

  if (error || !meme) {
    return console.log("💤 No pending memes found in queue.");
  }

  console.log(`🎯 Found meme: ${meme.title}`);

  try {
    // 2. Download Image via "Laundering" Proxy
    // We wrap the Reddit URL inside wsrv.nl to bypass the IP Block
    // &output=jpg ensures we always get a format Twitter accepts
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(meme.image_url)}&output=jpg`;

    console.log(`🌍 Downloading via proxy: ${proxyUrl}`);

    const imageResponse = await axios.get(proxyUrl, {
      responseType: "arraybuffer",
    });

    const imageBuffer = Buffer.from(imageResponse.data);

    // 3. Upload to Twitter
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/jpeg",
    });

    // 4. Create Tweet
    const uniqueText = `${meme.title} \u200B\n\n#memes #fun`;

    await twitterClient.v2.tweet({
      text: uniqueText,
      media: { media_ids: [mediaId] },
    });

    // 5. Mark as Published
    await supabase
      .from("meme_queue")
      .update({ status: "published" })
      .eq("id", meme.id);

    console.log(`🚀 Successfully posted tweet ID: ${meme.id}`);
  } catch (err) {
    console.error("❌ Failed to post:", err.message);

    // Optional: If it fails, mark it as 'error' so we don't get stuck on it forever
    // await supabase.from('meme_queue').update({ status: 'error' }).eq('id', meme.id);
  }
}

postNextMeme();
