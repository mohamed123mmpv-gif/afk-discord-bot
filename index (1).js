const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const fs = require("fs");
const express = require("express");

// ====== Discord Client ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;
const prefix = "!";

let data = require("./afk.json");
let connection = null;

// ====== Keep Alive ======
const app = express();
app.get("/", (req, res) => res.send("AFK BOT ONLINE"));
app.listen(3000, () => console.log("🌐 Keep Alive running"));

// ====== Ready ======
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Auto Join بعد restart
  if (data.guildId && data.channelId) {
    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(data.channelId);
    if (!channel) return;

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    console.log("🔁 Auto Joined AFK room");
  }
});

// ====== Commands ======
client.on("messageCreate", async message => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  if (message.content === "!panel") {
    const voices = message.guild.channels.cache
      .filter(c => c.type === 2)
      .map(c => ({
        label: c.name,
        value: c.id
      }));

    if (!voices.length)
      return message.reply("❌ ما في رومات صوتية");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("afk_select")
      .setPlaceholder("اختر روم AFK")
      .addOptions(voices);

    const row = new ActionRowBuilder().addComponents(menu);

    message.reply({
      content: "🎧 اختر الروم اللي بدك البوت يدخل عليه:",
      components: [row]
    });
  }
});

// ====== Interactions ======
client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === "afk_select") {
    const channel = interaction.guild.channels.cache.get(interaction.values[0]);
    if (!channel) return interaction.deferUpdate();

    if (connection) connection.destroy();

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    data.guildId = interaction.guild.id;
    data.channelId = channel.id;
    fs.writeFileSync("./afk.json", JSON.stringify(data, null, 2));

    await interaction.deferUpdate();
  }
});

// ====== Auto Reconnect ======
setInterval(() => {
  if (connection && connection.state.status === VoiceConnectionStatus.Disconnected) {
    connection.rejoin();
  }
}, 10000);

client.login(TOKEN);
