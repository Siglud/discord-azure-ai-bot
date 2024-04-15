import { Client, Events, GatewayIntentBits, Message, REST, Routes } from "discord.js"

const commands = [
    {
        name: "ping",
        description: "Replies with Pong",
    }
]

const TOKEN = process.env.DISCORD_TOKEN ?? ""
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? ""

const rest = new REST({ version: "10" }).setToken(TOKEN)

try {
    console.log('Start Refreshing Application (/) Commands')

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: { commands } })

    console.log('Successfully Updated Application (/) Commands')
} catch (e) {
    console.error(e)
}

const client = new Client({intents: [GatewayIntentBits.Guilds]})

client.once(Events.ClientReady, async () => {
    console.log(`Client ready as ${client.user?.tag} !`)
})

client.on("message", async (message: Message) => {})

await client.login(TOKEN)
