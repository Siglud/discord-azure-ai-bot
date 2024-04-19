import {
    Client,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    SlashCommandStringOption,
    type CacheType,
    CommandInteraction,
    Message,
} from "discord.js"
import gpt from "./AzureGPT.ts"
import type {
    ChatRequestAssistantMessage,
    ChatRequestMessage,
    ChatRequestUserMessage,
} from "@azure/openai"

const commands = [
    new SlashCommandBuilder()
        .setName("edit")
        .setNSFW(false)
        .setDescription("This will change your system prompt"),
    new SlashCommandBuilder()
        .setName("show")
        .setDescription("Show my System Prompt"),
    new SlashCommandBuilder()
        .setName("chat")
        .setDescription("Start new chat with bot")
        .addStringOption(new SlashCommandStringOption().setName("message").setRequired(true).setDescription("Your prompt").setMinLength(1).setMaxLength(800)),
]

const TOKEN = process.env.DISCORD_TOKEN ?? ""
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? ""
const GUILD_ID = process.env.DISCORD_GUILD_ID?.split(',') ?? []

const USER_SYSTEM_PROMPT: Map<string, string> = new Map()
const USER_HISTORY: Map<string, ChatRequestMessage[]> = new Map()
const DEFAULT_SYSTEM_PROMPT = 'You are an AI assistant that helps people find information.'

const rest = new REST().setToken(TOKEN)

try {
    console.log("Start Refreshing Application (/) Commands")
    const cn = commands.map((off) => off.toJSON())
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cn })

    console.log("Successfully Updated Application (/) Commands")
} catch (e) {
    console.error(e)
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
})

client.once(Events.ClientReady, async () => {
    console.log(`Client ready as ${client.user?.tag} !`)
})

client.on(Events.InteractionCreate, async (interaction) => {
    console.log(`data received!`)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === "changeSystemPrompt") {
            // message body
            const message = interaction.fields.getTextInputValue("systemPrompt")
            // user id
            const userId = interaction.user.id
            USER_SYSTEM_PROMPT.set(userId, message)
            await interaction.reply({ content: "Your System Prompt saved successfully." })
            return
        }
    }

    if (!interaction.isChatInputCommand()) return

    if (GUILD_ID.length > 0 && !GUILD_ID.includes(interaction.guildId ?? '')) {
        await interaction.reply("Unauthorized!")
        return
    }

    const command = interaction.commandName

    if (!command) {
        console.error("Command not found!")
    }

    if (command === "edit") {
        const modal = new ModalBuilder().setTitle("Change System Message").setCustomId("changeSystemPrompt")

        const input = new TextInputBuilder().setCustomId("systemPrompt").setLabel("Change System Message").setStyle(TextInputStyle.Paragraph)

        const rowOne = new ActionRowBuilder().addComponents(input) as any

        modal.addComponents(rowOne)

        await interaction.showModal(modal)
        return
    }

    if (command === "show") {
        await interaction.reply(USER_SYSTEM_PROMPT.get(interaction.user.id) ?? DEFAULT_SYSTEM_PROMPT)
        return
    }

    if (command === "chat") {
        const message = interaction.options.get('message', true).value as string
        const userId = interaction.user.id
        interaction.deferReply()
        // clear old message
        USER_HISTORY.set(userId, [])

        const reply = await get_gpt_response(userId, message)
        await replyMessage(interaction, reply)

        return
    }
    await interaction.reply("Unknown command " + command)
})

function getUserSystemPrompt(user: string): string {
    return USER_SYSTEM_PROMPT.get(user) ?? DEFAULT_SYSTEM_PROMPT
}

client.on(Events.MessageCreate, async (interaction) => {
    // ignore any message from bot
    if (interaction.author.bot) return
    if (!interaction.reference) return
    const reply = await interaction.fetchReference()
    if (!reply) return
    // only reply when someone quote the bot
    const message = interaction.content
    if (reply.author.bot) {
        const userId = interaction.author.id
        const reply = await get_gpt_response(userId, message)
        await replyMessage(interaction, reply)
    }
})

async function replyMessage(interaction: CommandInteraction<CacheType> | Message<boolean>, message: string) {
    if (message.length <= 2000) {
        await interaction.reply(message)
        return
    }
    // split message into multiple message with length 2000 if it's too long
    let n = message.length;
    const MAX_LENGTH = 2000;
    await interaction.reply(message.slice(0, 2000))

    const follow = interaction instanceof CommandInteraction ? interaction.followUp : (msg: string) => interaction.channel.send({ content: msg, reply: { messageReference: interaction } });

    for (let index = 2000; index < n; index += 2000) {
        follow(message.slice(index, Math.min(index + 2000, n)))
    }
}

async function get_gpt_response(userId: string, message: string): Promise<string> {
    const system = getUserSystemPrompt(userId)

    const reply = await gpt(system, message, USER_HISTORY.get(userId))
    if (!reply) {
        return "No response from remote server!"
    }
    if (!USER_HISTORY.has(userId)) {
        USER_HISTORY.set(userId, [])
    }
    USER_HISTORY.get(userId)?.push({ role: "user", content: message } as ChatRequestUserMessage)
    USER_HISTORY.get(userId)?.push({ role: "assistant", content: reply } as ChatRequestAssistantMessage)
    if (USER_HISTORY.get(userId)?.length ?? 0 > 100) {
        const n = USER_HISTORY.get(userId)?.length ?? 100;
        USER_HISTORY.get(userId)?.splice(0, n - 100)
    }
    return reply
}

await client.login(TOKEN)
