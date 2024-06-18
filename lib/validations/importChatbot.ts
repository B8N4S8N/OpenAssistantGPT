import * as z from "zod"

export const importChatbotSchema = z.object({
    name: z.string().min(3).max(50),
    openAIKey: z.string().min(1),
    welcomeMessage: z.string().min(1),
    chatbotErrorMessage: z.string().min(1),
    openAIAssistantId: z.string().min(1),
    rightToLeftLanguage: z.boolean(),
})

