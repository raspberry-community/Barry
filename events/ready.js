const fs = require("node:fs");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

function setActivity(readyClient) {
  readyClient.user.setActivity("https://github.com/raspberry-pie-community", {
    type: "WATCHING",
  });
}

const modals = new Map();
const forms = [];

async function loadFormEmbeds(readyClient) {
  const formPath = path.join(__dirname, "../forms");
  const formFiles = fs
    .readdirSync(formPath)
    .filter((file) => file.endsWith(".json"));
  await purgeOldEmbeds(readyClient, formFiles);
  for (const file of formFiles) {
    const form = require(path.join(formPath, file));
    forms.push(form);
    if (form.modal) await generateModals(form);
    await generateFormEmbeds(readyClient, form);
  }
}

async function generateModals(form) {
  if (!form.modal)
    return console.log(`Form ${form.name} does not have a modal.`);
  const callerId = form.modal.callerId;
  const modal = new ModalBuilder();
  modal.setCustomId(form.modal.customId);
  modal.setTitle(form.modal.title);
  const actionRows = [];
  for (const input of form.modal.inputs) {
    const actionRow = new ActionRowBuilder();
    switch (input.type) {
      case "LongText":
        actionRow.addComponents(
          new TextInputBuilder()
            .setCustomId(input.customId)
            .setPlaceholder(input.placeholder)
            .setLabel(input.label)
            .setStyle(TextInputStyle.Paragraph)
        );
        break;
      case "ShortText":
        actionRow.addComponents(
          new TextInputBuilder()
            .setCustomId(input.customId)
            .setPlaceholder(input.placeholder)
            .setLabel(input.label)
            .setStyle(TextInputStyle.Short)
        );
        break;
      default:
        console.log(`Unknown input type: ${input.type}`);
        break;
    }
    actionRows.push(actionRow);
  }
  modal.addComponents(actionRows);
  modals.set(callerId, modal);
}

async function generateFormEmbeds(readyClient, form) {
  if (!form.embed)
    return console.log(`Form ${form.name} does not have an embed.`);

  const embed = new EmbedBuilder()
    .setColor(form.embed.color || null)
    .setTitle(form.embed.title || "")
    .setDescription(form.embed.description || "")
    .setFooter(form.embed.footer || null)
    .setImage(form.embed.image || null)
    .setThumbnail(form.embed.thumbnail || null);

  if (form.embed.fields) {
    for (const field of form.embed.fields) {
      embed.addFields({
        name: field.name,
        value: field.value,
        inline: field.inline,
      });
    }
  }

  const actionRow = new ActionRowBuilder();
  if (form.embed.buttons) {
    for (const button of form.embed.buttons) {
      const buttonBuilder = new ButtonBuilder()
        .setCustomId(button.customId)
        .setLabel(button.label)
        .setStyle(
          ButtonStyle[button.style.toUpperCase()] || ButtonStyle.Primary
        );

      if (button.url) buttonBuilder.setURL(button.url);
      actionRow.addComponents(buttonBuilder);
    }
  }

  const postChannel = await readyClient.channels.fetch(form.postChannel);
  console.log(
    `Posting embed for form ${form.embed.title} in channel ${postChannel.id}`
  );

  const options = { embeds: [embed] };
  if (actionRow.components.length > 0) {
    options.components = [actionRow];
  }

  await postChannel.send(options);
}

async function purgeOldEmbeds(readyClient, formFiles) {
  for (const file of formFiles) {
    const form = require(path.join(__dirname, "../forms", file));
    const postChannel = await readyClient.channels.fetch(form.postChannel);
    const messages = await postChannel.messages.fetch({ limit: 100 });
    for (const message of messages.values()) {
      if (message.author.id === readyClient.user.id) {
        await message.delete();
      }
    }
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  modals,
  forms,
  async execute(readyClient) {
    console.log("Generating embeds");
    await loadFormEmbeds(readyClient);
    console.log(`Logged in as ${readyClient.user.tag}`);
    setActivity(readyClient);
  },
};
