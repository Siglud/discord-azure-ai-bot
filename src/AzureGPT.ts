/**
 * @author Siglud <siglud@gmail.com>
 */
import {
    AzureKeyCredential,
    type ChatRequestMessage,
    type ChatRequestSystemMessage, type ChatRequestUserMessage,
    OpenAIClient,
} from "@azure/openai"

const AI_MODEL = process.env.AI_MODEL || ""
const AI_KEY = process.env.AI_KEY || ""
const AI_ENDPOINT = process.env.AI_ENDPOINT || ""
const API_VERSION = process.env.API_VERSION || "2024-02-15-preview"
const AI_MAX_TOKEN = process.env.AI_MAX_TOKEN || "1000"
const MAX_HISTORY = 10;

export async function gpt(system: string, userContent: string, prevMessages?: ChatRequestMessage[]) {
    if (!AI_MODEL || !AI_KEY || !AI_ENDPOINT) {
        return undefined
    }
    const client = new OpenAIClient(AI_ENDPOINT, new AzureKeyCredential(AI_KEY), { apiVersion: API_VERSION })
    let message: ChatRequestMessage[] = []
    message.push({ role: "system", content: system } as ChatRequestSystemMessage);
    if (prevMessages) {
        prevMessages.slice(-MAX_HISTORY)
        message = message.concat(prevMessages)
    }
    message.push({ role: "user", content: userContent } as ChatRequestUserMessage)

    console.log(message)

    const result = await client.getChatCompletions(AI_MODEL, message, {
        temperature: 0.7,
        maxTokens: parseInt(AI_MAX_TOKEN),
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
    })

    console.log(result)
    return result.choices[0].message?.content;
}

export default gpt