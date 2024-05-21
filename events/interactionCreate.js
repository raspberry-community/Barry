const { forms, modals } = require("./ready.js");
const {
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  ActionRowBuilder,
  PermissionsBitField,
  AttachmentBuilder,
} = require("discord.js");

async function handleButtons(interaction) {
  console.log("Handling button interaction:", interaction.customId);

  if (modals && modals.size !== 0) {
    const modal = modals.get(interaction.customId.toLowerCase());
    if (modal) {
      console.log("Showing modal for interaction:", interaction.customId);
      await interaction.showModal(modal);
      return;
    }
  }

  if (interaction.customId.toLowerCase().includes("close")) {
    console.log("Closing ticket for user:", interaction.user.id);
    const channel = await interaction.client.channels.fetch(
      interaction.channelId
    );
    if (channel) {
      try {
        const transcript = await generateTranscript(channel);
        const transcriptChannelId = forms.find(
          (form) => form.embed.title === interaction.message.embeds[0].title
        ).transcriptChannel;
        const transcriptChannel =
          interaction.client.channels.cache.get(transcriptChannelId);
        if (transcriptChannel) {
          await transcriptChannel.send({
            content: `Transcript for ticket ${channel} - <@${interaction.channel.topic}>:`,
            files: [transcript],
          });
          console.log("Transcript sent to channel:", transcriptChannel.id);
          await channel.delete();
          console.log("Channel deleted:", channel.id);
        } else {
          console.log("Transcript channel not found:", transcriptChannelId);
        }
      } catch (error) {
        console.error("Error generating transcript:", error);
      }
    }
  }

  if (interaction.customId.toLowerCase().includes("button")) {
    for (const form of forms) {
      const buttons = form.modal.buttons;
      if (buttons) {
        const button = buttons.find((button) =>
          interaction.customId
            .toLowerCase()
            .includes(button.customId.toLowerCase())
        );
        if (button) {
          const userId = interaction.customId
            .replace(button.customId.toLowerCase(), "")
            .replace("-", "");
          if (interaction.customId.toLowerCase().includes("open")) {
            console.log("Opening ticket for user:", userId);
            const category = interaction.client.channels.cache.get(
              form.ticketCategory
            );
            if (!category) {
              console.log("Category not found:", form.ticketCategory);
              return;
            }
            try {
              const channel = await category.guild.channels.create({
                type: 0,
                topic: userId,
                name: `ticket-${userId}`,
                parent: category,
                permissionOverwrites: [
                  {
                    id: userId,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                  },
                  {
                    id: category.guild.roles.everyone,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                  },
                  {
                    id: form.rolesToPing[0],
                    allow: [PermissionsBitField.Flags.ViewChannel],
                  },
                  {
                    id: interaction.client.user.id,
                    allow: [
                      PermissionsBitField.Flags.ViewChannel,
                      PermissionsBitField.Flags.ManageChannels,
                      PermissionsBitField.Flags.ManageMessages,
                    ],
                  },
                ],
              });
              console.log("Channel created:", channel.id);
              const embed = interaction.message.embeds[0];
              const actionRow = new ActionRowBuilder();
              const closeButton = new ButtonBuilder()
                .setCustomId("close-" + channel.id)
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger);
              actionRow.addComponents(closeButton);
              await channel.send({
                content: `Hello <@${userId}>, your ticket has been opened!`,
                embeds: [embed],
                components: [actionRow],
              });
              console.log("Ticket message sent to channel:", channel.id);
              await interaction.message.delete();
              console.log("Original interaction message deleted");
            } catch (error) {
              console.error(
                "Error creating channel or sending message:",
                error
              );
            }
          } else if (interaction.customId.toLowerCase().includes("close")) {
            const channelId = interaction.customId.replace("close-", "");
            const channel = interaction.client.channels.cache.get(channelId);
            if (channel) {
              try {
                await channel.delete();
                console.log("Channel deleted:", channelId);
                await interaction.message.delete();
                console.log("Original interaction message deleted");
              } catch (error) {
                console.error(
                  "Error deleting channel or interaction message:",
                  error
                );
              }
            } else {
              console.log("Channel not found:", channelId);
            }
          }
        }
      }
    }
  }
}

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const transcript = [];

  messages.reverse().forEach((message) => {
    const attachments = message.attachments.map((attachment) => attachment.url);

    if (message.embeds.length != 0) {
      message.embeds.forEach((embed) => {
        const embedFields = embed.fields.map(
          (field) => `${field.name}: ${field.value}`
        );
        const formattedEmbed = `[${new Date(
          message.createdTimestamp
        ).toLocaleString()}] Embed - Title: ${
          embed.title || "No Title"
        }, Description: ${
          embed.description || "No Description"
        }, Fields: ${embedFields.join(", ")}`;
        transcript.push(formattedEmbed);
      });
    }

    const formattedMessage = `[${new Date(
      message.createdTimestamp
    ).toLocaleString()}] ${message.author.tag}: ${message.content}`;
    transcript.push(formattedMessage);
    if (attachments.length > 0) {
      transcript.push(`Attachments: ${attachments.join(", ")}`);
    }
  });

  const transcriptContent = transcript.join("\n");
  const buffer = Buffer.from(transcriptContent, "utf-8");
  const attachment = new AttachmentBuilder(buffer, {
    name: `transcript-${channel.id}.txt`,
  });

  console.log(`Transcript generated for channel: ${channel.id}`);
  return attachment;
}

async function checkIfUserHasSubmittedTicket(interaction) {
  if (forms && forms.length !== 0) {
    for (const form of forms) {
      if (form.ticketChannel) {
        const channel = interaction.client.channels.cache.get(
          form.ticketChannel
        );
        if (channel) {
          const messages = await channel.messages.fetch();
          const embeds = messages.filter(
            (message) => message.embeds.length > 0
          );

          for (const message of embeds.values()) {
            const embed = message.embeds[0];
            if (embed.footer && embed.footer.text === interaction.user.id) {
              await interaction.reply({
                content:
                  "You have already submitted a ticket. Please wait for a response.",
                ephemeral: true,
              });
              console.log(
                "User has already submitted a ticket:",
                interaction.user.id
              );
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

async function handleModalInput(interaction) {
  console.log("Handling modal input:", interaction.customId);
  if (await checkIfUserHasSubmittedTicket(interaction)) return;

  if (forms && forms.length !== 0) {
    const form = forms.find(
      (form) =>
        form.modal &&
        form.modal.customId.toLowerCase() === interaction.customId.toLowerCase()
    );

    if (!form) {
      await interaction.reply({
        content: "Form configuration not found",
        ephemeral: true,
      });
      console.log("Form configuration not found for:", interaction.customId);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(form.embed.title || "New Submission")
      .setTimestamp();

    form.modal.inputs.forEach((input) => {
      const value =
        "```" + interaction.fields.getTextInputValue(input.customId) + "```";
      embed.addFields({ name: input.label, value });
    });

    embed.setColor(form.embed.color || null);
    embed.setFooter({ text: interaction.user.id });
    embed.setAuthor({
      name: interaction.user.tag,
      iconURL: interaction.user.displayAvatarURL(),
    });

    const channelId = form.ticketChannel;
    const channel = interaction.client.channels.cache.get(channelId);
    let mentionMessage = "";

    for (const role of form.rolesToPing) {
      mentionMessage += `<@&${role}> `;
    }

    const actionRow = new ActionRowBuilder();
    for (const button of form.modal.buttons) {
      const buttonBuilder = new ButtonBuilder()
        .setCustomId(button.customId + "-" + interaction.user.id)
        .setLabel(button.label);
      switch (button.style) {
        case "Primary":
          buttonBuilder.setStyle(ButtonStyle.Primary);
          break;
        case "Secondary":
          buttonBuilder.setStyle(ButtonStyle.Secondary);
          break;
        case "Success":
          buttonBuilder.setStyle(ButtonStyle.Success);
          break;
        case "Danger":
          buttonBuilder.setStyle(ButtonStyle.Danger);
          break;
        default:
          buttonBuilder.setStyle(ButtonStyle.Primary);
          break;
      }
      actionRow.addComponents(buttonBuilder);
    }

    const options = { embeds: [embed], content: mentionMessage };
    if (actionRow.components.length > 0) {
      options.components = [actionRow];
    }

    if (channel) {
      await channel.send(options);
      console.log("Embed and buttons sent to channel:", channel.id);
    } else {
      console.log("Channel not found:", channelId);
    }

    await interaction.reply({
      content:
        "Your application has been submitted! Please be patient while we review your application.",
      ephemeral: true,
    });
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    console.log(
      `${interaction.user.tag} in #${interaction.channel.name} triggered ${interaction.customId}`
    );

    try {
      if (interaction.isButton()) {
        await handleButtons(interaction);
      }

      if (
        interaction.isModalSubmit() &&
        interaction.customId.toLowerCase().includes("modal")
      ) {
        await handleModalInput(interaction);
      }
    } catch (error) {
      console.error("Error handling interaction:", error);
    }
  },
};
