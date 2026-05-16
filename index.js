require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

console.log("TOKEN VAR MI:", TOKEN ? "EVET" : "HAYIR");
console.log("TOKEN UZUNLUK:", TOKEN ? TOKEN.length : "YOK");
console.log("CLIENT_ID VAR MI:", CLIENT_ID ? "EVET" : "HAYIR");
console.log("GUILD_ID VAR MI:", GUILD_ID ? "EVET" : "HAYIR");

if (!TOKEN) {
  console.error("BOT_TOKEN bulunamadı. Railway Variables içine BOT_TOKEN ekle.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("CLIENT_ID bulunamadı. Railway Variables içine CLIENT_ID ekle.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("GUILD_ID bulunamadı. Railway Variables içine GUILD_ID ekle.");
  process.exit(1);
}

const REPORT_CATEGORY_NAME = "Reports";
const REPORT_PANEL_CHANNEL_NAME = "report-a-player";
const REPORT_LOG_CHANNEL_NAME = "report-log";
const MOD_ROLE_NAME = "Moderator";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("setup-report")
      .setDescription("Report player sistemini kurar.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash komutu yüklendi.");
}

client.once("ready", async () => {
  console.log(`${client.user.tag} aktif!`);

  try {
    await registerCommands();
  } catch (err) {
    console.error("Slash komutu yüklenirken hata:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup-report") {
        const guild = interaction.guild;

        let reportChannel = guild.channels.cache.find(
          ch => ch.name === REPORT_PANEL_CHANNEL_NAME && ch.type === ChannelType.GuildText
        );

        if (!reportChannel) {
          reportChannel = await guild.channels.create({
            name: REPORT_PANEL_CHANNEL_NAME,
            type: ChannelType.GuildText
          });
        }

        let logChannel = guild.channels.cache.find(
          ch => ch.name === REPORT_LOG_CHANNEL_NAME && ch.type === ChannelType.GuildText
        );

        if (!logChannel) {
          logChannel = await guild.channels.create({
            name: REPORT_LOG_CHANNEL_NAME,
            type: ChannelType.GuildText
          });
        }

        let category = guild.channels.cache.find(
          ch => ch.name === REPORT_CATEGORY_NAME && ch.type === ChannelType.GuildCategory
        );

        if (!category) {
          category = await guild.channels.create({
            name: REPORT_CATEGORY_NAME,
            type: ChannelType.GuildCategory
          });
        }

        let modRole = guild.roles.cache.find(role => role.name === MOD_ROLE_NAME);

        if (!modRole) {
          modRole = await guild.roles.create({
            name: MOD_ROLE_NAME,
            permissions: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("Player Report")
          .setDescription("Bir oyuncuyu şikayet etmek için aşağıdaki butona bas.")
          .setColor(0xff0000);

        const button = new ButtonBuilder()
          .setCustomId("create_report")
          .setLabel("Report Player")
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(button);

        await reportChannel.send({
          embeds: [embed],
          components: [row]
        });

        await interaction.reply({
          content: "Report sistemi kuruldu.",
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "create_report") {
        const guild = interaction.guild;
        const user = interaction.user;

        const category = guild.channels.cache.find(
          ch => ch.name === REPORT_CATEGORY_NAME && ch.type === ChannelType.GuildCategory
        );

        const modRole = guild.roles.cache.find(role => role.name === MOD_ROLE_NAME);

        if (!modRole) {
          return interaction.reply({
            content: "Moderator rolü bulunamadı. Önce /setup-report komutunu çalıştır.",
            ephemeral: true
          });
        }

        const safeUsername = user.username
          .toLowerCase()
          .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ-]/gi, "")
          .slice(0, 20);

        const existingChannel = guild.channels.cache.find(
          ch => ch.name === `report-${safeUsername}`
        );

        if (existingChannel) {
          return interaction.reply({
            content: `Zaten açık bir report kanalın var: ${existingChannel}`,
            ephemeral: true
          });
        }

        const reportChannel = await guild.channels.create({
          name: `report-${safeUsername}`,
          type: ChannelType.GuildText,
          parent: category ? category.id : null,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles
              ]
            },
            {
              id: modRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
              ]
            }
          ]
        });

        const closeButton = new ButtonBuilder()
          .setCustomId("close_report")
          .setLabel("Report Kapat")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(closeButton);

        const embed = new EmbedBuilder()
          .setTitle("Report Açıldı")
          .setDescription(
            `Merhaba ${user}, şikayetini buraya yaz.\n\nLütfen şunları ekle:\n\n` +
            `**Şikayet edilen oyuncu adı:**\n` +
            `**Olay tarihi:**\n` +
            `**Olay açıklaması:**\n` +
            `**Kanıt / ekran görüntüsü:**`
          )
          .setColor(0xff9900);

        await reportChannel.send({
          content: `${user} ${modRole}`,
          embeds: [embed],
          components: [row]
        });

        const logChannel = guild.channels.cache.find(
          ch => ch.name === REPORT_LOG_CHANNEL_NAME && ch.type === ChannelType.GuildText
        );

        if (logChannel) {
          await logChannel.send(`Yeni report açıldı: ${reportChannel} | Açan: ${user}`);
        }

        await interaction.reply({
          content: `Report kanalın açıldı: ${reportChannel}`,
          ephemeral: true
        });
      }

      if (interaction.customId === "close_report") {
        const member = interaction.member;
        const hasPermission = member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (!hasPermission) {
          return interaction.reply({
            content: "Bu report kanalını sadece moderatörler kapatabilir.",
            ephemeral: true
          });
        }

        await interaction.reply("Bu report kanalı 5 saniye içinde kapatılıyor.");

        setTimeout(async () => {
          await interaction.channel.delete().catch(() => {});
        }, 5000);
      }
    }
  } catch (err) {
    console.error("Interaction hatası:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Bir hata oluştu. Bot loglarını kontrol et.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
