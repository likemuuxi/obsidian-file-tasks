import { requestUrl, RequestUrlParam } from 'obsidian';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIStreamCallbacks {
    onToken: (token: string) => void;
    onDone: (fullText: string) => void;
    onError: (error: string) => void;
}

export class AIService {
    private apiKey: string;
    private baseUrl: string;
    private model: string;

    constructor(apiKey: string, baseUrl: string, model: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.model = model;
    }

    async chat(messages: ChatMessage[]): Promise<string> {
        const url = `${this.baseUrl}/chat/completions`;
        const params: RequestUrlParam = {
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: 0.3,
            }),
        };

        const response = await requestUrl(params);

        if (response.status >= 400) {
            throw new Error(`AI API error (${response.status}): ${typeof response.text === 'string' ? response.text : JSON.stringify(response.json)}`);
        }

        const data = response.json;
        return data.choices?.[0]?.message?.content ?? '';
    }

    static isConfigured(settings: { aiEnabled: boolean; aiApiKey: string; aiBaseUrl: string; aiModel: string }): boolean {
        return settings.aiEnabled && !!settings.aiApiKey && !!settings.aiBaseUrl && !!settings.aiModel;
    }
}
