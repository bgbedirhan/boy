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

console.log("TOKEN EXISTS:", TOKEN ? "YES" : "NO");
console.log("TOKEN LENGTH:", TOKEN ? TOKEN.length : "MISSING");
console.log("CLIENT_ID EXISTS:", CLIENT_ID ? "YES" : "NO");
console.log("GUILD_ID EXISTS:", GUILD_ID ? "YES" : "NO");

if (!TOKEN) {
  console.error("BOT_TOKEN is missing. Add BOT_TOKEN in Railway Variables.");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("CLIENT_ID is missing. Add CLIENT_ID in Railway Variables.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("GUILD_ID is missing. Add GUILD_ID in Railway Variables.");
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
      .setDescription("Sets up the player report system.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash command registered successfully.");
}

client.once("ready", async () => {
  console.log(`${client.user.tag} is online!`);

  try {
    await registerCommands();
  } catch (err) {
    console.error("Failed to register slash command:", err);
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
          .setDescription("Click the button below to report a player.")
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
          content: "The report system has been set up successfully.",
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
            content: "Moderator role was not found. Please run /setup-report first.",
            ephemeral: true
          });
        }

        const safeUsername = user.username
          .toLowerCase()
          .replace(/[^a-z0-9-]/gi, "")
          .slice(0, 20);

        const existingChannel = guild.channels.cache.find(
          ch => ch.name === `report-${safeUsername}`
        );

        if (existingChannel) {
          return interaction.reply({
            content: `You already have an open report channel: ${existingChannel}`,
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
          .setLabel("Close Report")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(closeButton);

        const embed = new EmbedBuilder()
          .setTitle("Report Created")
          .setDescription(
            `Hello ${user}, please describe your report in this channel.\n\n` +
            `Please include the following information:\n\n` +
            `**Reported player name:**\n` +
            `**Date of incident:**\n` +
            `**Description of the incident:**\n` +
            `**Evidence / screenshots:**`
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
          await logChannel.send(`New report created: ${reportChannel} | Created by: ${user}`);
        }

        await interaction.reply({
          content: `Your report channel has been created: ${reportChannel}`,
          ephemeral: true
        });
      }

      if (interaction.customId === "close_report") {
        const member = interaction.member;
        const hasPermission = member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (!hasPermission) {
          return interaction.reply({
            content: "Only moderators can close this report channel.",
            ephemeral: true
          });
        }

        await interaction.reply("This report channel will be closed in 5 seconds.");

        setTimeout(async () => {
          await interaction.channel.delete().catch(() => {});
        }, 5000);
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred. Please check the bot logs.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
