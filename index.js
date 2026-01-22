// ==========================
//  AFK BOT 24/7 (AUTO JOIN)
// ==========================

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const express = require("express");
const fs = require("fs");

// ===== Client =====
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

let connection = null;
let afkData = {};

// ===== Load Saved AFK =====
if (fs.existsSync("./afk.json")) {
  afkData = JSON.parse(fs.readFileSync("./afk.json", "utf8"));
}

// ===== Save AFK =====
function saveAFK(guildId, channelId) {
  afkData[guildId] = channelId;
  fs.writeFileSync("./afk.json", JSON.stringify(afkData, null, 2));
}

// ===== Keep Alive =====
const app = express();
app.get("/", (_, res) => res.send("AFK BOT is alive!"));
app.listen(3000, () => console.log("🌐 Keep Alive running"));

// ===== Ready =====
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // ===== Auto Join After Restart =====
  for (const guildId in afkData) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(afkData[guildId]);
    if (!guild || !channel) continue;

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      console.log(`🔁 Auto AFK joined: ${channel.name}`);
    } catch {
      console.log("❌ Auto join failed");
    }
  }
});

// ===== Commands =====
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  if (message.content === "!panel") {
    const voiceChannels = message.guild.channels.cache
      .filter(c => c.type === ChannelType.GuildVoice)
      .map(c => ({ label: c.name, value: c.id }));

    if (!voiceChannels.length)
      return message.reply("❌ لا يوجد رومات صوتية");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("afk_select")
      .setPlaceholder("اختر روم AFK")
      .addOptions(voiceChannels);

    const button = new ButtonBuilder()
      .setCustomId("afk_rejoin")
      .setLabel("🔄 إعادة الاتصال")
      .setStyle(ButtonStyle.Primary);

    message.channel.send({
      content: "🎧 لوحة التحكم AFK:",
      components: [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(button)
      ]
    });
  }
});

// ===== Interactions =====
client.on(Events.InteractionCreate, async (interaction) => {
  // ===== Select Voice =====
  if (interaction.isStringSelectMenu() && interaction.customId === "afk_select") {
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.guild.channels.cache.get(interaction.values[0]);
    if (!channel)
      return interaction.editReply("❌ الروم غير موجود");

    if (connection) connection.destroy();

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    saveAFK(interaction.guild.id, channel.id);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      interaction.editReply(`✅ دخل AFK في **${channel.name}**`);
    } catch {
      interaction.editReply("❌ فشل الاتصال");
    }
  }

  // ===== Rejoin =====
  if (interaction.isButton() && interaction.customId === "afk_rejoin") {
    await interaction.deferReply({ flags: 64 });

    const channelId = afkData[interaction.guild.id];
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel)
      return interaction.editReply("❌ لا يوجد روم محفوظ");

    if (connection) connection.destroy();

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    interaction.editReply(`🔄 أعاد الاتصال بـ **${channel.name}**`);
  }
});

// ===== Auto Reconnect =====
setInterval(() => {
  if (
    connection &&
    connection.state.status === VoiceConnectionStatus.Disconnected
  ) {
    const guildId = Object.keys(afkData)[0];
    const channelId = afkData[guildId];
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !channelId) return;

    connection.destroy();
    connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: true,
      selfDeaf: true
    });

    console.log("🔄 AFK reconnected");
  }
}, 15000);

client.login(TOKEN);
