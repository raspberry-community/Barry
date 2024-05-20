const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, Events } = require('discord.js');

function setActivity(readyClient) {
    readyClient.user.setActivity('https://github.com/raspberry-pie-community', { type: 'WATCHING' });
}

async function loadFormEmbeds(readyClient) {
    const formPath = path.join(__dirname, '../forms');
    const formFiles = fs.readdirSync(formPath).filter(file => file.endsWith('.json'));
    await purgeOldEmbeds(readyClient, formFiles);
    for (const file of formFiles) {
        const form = require(path.join(formPath, file));
        generateFormEmbeds(readyClient, form);
    }
}

async function generateFormEmbeds(readyClient, form) {
    if(!form.embed) return console.log(`Form ${form.name} does not have an embed.`);
    const embed = new EmbedBuilder();
    if(form.embed.color) embed.setColor(form.embed.color);
    if(form.embed.title) embed.setTitle(form.embed.title)
    if(form.embed.description) embed.setDescription(form.embed.description)
    if(form.embed.footer) embed.setFooter(form.embed.footer)
    if(form.embed.image) embed.setImage(form.embed.image);
    if(form.embed.thumbnail) embed.setThumbnail(form.embed.thumbnail);
    if(form.embed.fields) {
        for(const field of form.embed.fields) {
            embed.addField(field.name, field.value, field.inline);
        }
    }

    const postChannel = await readyClient.channels.fetch(form.postChannel).then(channel => channel);
    console.log(`Posting embed for form ${form.name} in channel ${postChannel}`);
    postChannel.send({ embeds: [embed] });
}

async function purgeOldEmbeds(readyClient, formFiles) {
    //Purge embeds sent by the bot
    for (const file of formFiles) {
        const form = require(path.join(__dirname, '../forms', file));
        const postChannel = await readyClient.channels.fetch(form.postChannel).then(channel => channel);
        const messages = await postChannel.messages.fetch({ limit: 100 });
        for (const message of messages) {
            if(message[1].author.id === readyClient.user.id) {
                message[1].delete();
            }
        }
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(readyClient) {
        console.log('Generating embeds');
        loadFormEmbeds(readyClient);
        console.log(`Logged in as ${readyClient.user.tag}`);
        setActivity(readyClient);
    }
}