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

const REPORT_CATEGORY_NAME = "Reports";
const REPORT_PANEL_CHANNEL_NAME = "report-a-player";
const REPORT_LOG_CHANNEL_NAME = "report-log";

const BUG_CATEGORY_NAME = "Bug Reports";
const BUG_PANEL_CHANNEL_NAME = "bug-reports";
const BUG_LOG_CHANNEL_NAME = "bug-log";

const MOD_ROLE_NAME = "Moderator";

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing BOT_TOKEN, CLIENT_ID or GUILD_ID in Railway Variables.");
  process.exit(1);
}

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
      .setDescription("Sets up the report and bug report systems.")
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

async function getOrCreateTextChannel(guild, name) {
  let channel = guild.channels.cache.find(
    ch => ch.name === name && ch.type === ChannelType.GuildText
  );

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText
    });
  }

  return channel;
}

async function getOrCreateCategory(guild, name) {
  let category = guild.channels.cache.find(
    ch => ch.name === name && ch.type === ChannelType.GuildCategory
  );

  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory
    });
  }

  return category;
}

async function getOrCreateModeratorRole(guild) {
  let role = guild.roles.cache.find(role => role.name === MOD_ROLE_NAME);

  if (!role) {
    role = await guild.roles.create({
      name: MOD_ROLE_NAME,
      permissions: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  return role;
}

function safeName(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 20);
}

async function createPanel(channel, title, description, buttonId, buttonLabel, color, style) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);

  const button = new ButtonBuilder()
    .setCustomId(buttonId)
    .setLabel(buttonLabel)
    .setStyle(style);

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

async function createPrivateTicket({
  interaction,
  categoryName,
  logChannelName,
  channelPrefix,
  title,
  description,
  color,
  closeLabel
}) {
  const guild = interaction.guild;
  const user = interaction.user;

  const category = guild.channels.cache.find(
    ch => ch.name === categoryName && ch.type === ChannelType.GuildCategory
  );

  const modRole = guild.roles.cache.find(role => role.name === MOD_ROLE_NAME);

  if (!modRole) {
    return interaction.reply({
      content: "Moderator role was not found. Please run /setup-report first.",
      ephemeral: true
    });
  }

  const username = safeName(user.username);
  const channelName = `${channelPrefix}-${username}`;

  const existingChannel = guild.channels.cache.find(ch => ch.name === channelName);

  if (existingChannel) {
    return interaction.reply({
      content: `You already have an open channel: ${existingChannel}`,
      ephemeral: true
    });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
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
    .setCustomId("close_ticket")
    .setLabel(closeLabel)
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(closeButton);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description(user))
    .setColor(color);

  await ticketChannel.send({
    content: `${user} ${modRole}`,
    embeds: [embed],
    components: [row]
  });

  const logChannel = guild.channels.cache.find(
    ch => ch.name === logChannelName && ch.type === ChannelType.GuildText
  );

  if (logChannel) {
    await logChannel.send(`New ticket created: ${ticketChannel} | Created by: ${user}`);
  }

  await interaction.reply({
    content: `Your private channel has been created: ${ticketChannel}`,
    ephemeral: true
  });
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup-report") {
        const guild = interaction.guild;

        const reportChannel = await getOrCreateTextChannel(guild, REPORT_PANEL_CHANNEL_NAME);
        await getOrCreateTextChannel(guild, REPORT_LOG_CHANNEL_NAME);
        await getOrCreateCategory(guild, REPORT_CATEGORY_NAME);

        const bugChannel = await getOrCreateTextChannel(guild, BUG_PANEL_CHANNEL_NAME);
        await getOrCreateTextChannel(guild, BUG_LOG_CHANNEL_NAME);
        await getOrCreateCategory(guild, BUG_CATEGORY_NAME);

        await getOrCreateModeratorRole(guild);

        await createPanel(
          reportChannel,
          "Player Report",
          "Click the button below to report a player.",
          "create_player_report",
          "Report Player",
          0xff0000,
          ButtonStyle.Danger
        );

        await createPanel(
          bugChannel,
          "Bug Report",
          "Click the button below to report a bug.",
          "create_bug_report",
          "Report Bug",
          0x00b0f4,
          ButtonStyle.Primary
        );

        await interaction.reply({
          content: "Report and bug report systems have been set up successfully.",
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "create_player_report") {
        await createPrivateTicket({
          interaction,
          categoryName: REPORT_CATEGORY_NAME,
          logChannelName: REPORT_LOG_CHANNEL_NAME,
          channelPrefix: "report",
          title: "Player Report Created",
          color: 0xff9900,
          closeLabel: "Close Report",
          description: (user) =>
            `Hello ${user}, please describe your report in this channel.\n\n` +
            `Please include the following information:\n\n` +
            `**Reported player name:**\n` +
            `**Date of incident:**\n` +
            `**Description of the incident:**\n` +
            `**Evidence / screenshots:**`
        });
      }

      if (interaction.customId === "create_bug_report") {
        await createPrivateTicket({
          interaction,
          categoryName: BUG_CATEGORY_NAME,
          logChannelName: BUG_LOG_CHANNEL_NAME,
          channelPrefix: "bug",
          title: "Bug Report Created",
          color: 0x00b0f4,
          closeLabel: "Close Bug Report",
          description: (user) =>
            `Hello ${user}, please describe the bug in this channel.\n\n` +
            `Please include the following information:\n\n` +
            `**Bug description:**\n` +
            `**How to reproduce:**\n` +
            `**Expected result:**\n` +
            `**Actual result:**\n` +
            `**Screenshots / videos:**`
        });
      }

      if (interaction.customId === "close_ticket") {
        const member = interaction.member;
        const hasPermission = member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (!hasPermission) {
          return interaction.reply({
            content: "Only moderators can close this channel.",
            ephemeral: true
          });
        }

        await interaction.reply("This channel will be closed in 5 seconds.");

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
