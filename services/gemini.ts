
import { GoogleGenAI, Type } from "@google/genai";
import { DiagnosticResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function diagnoseRepair(
  base64Image: string | null, 
  description: string, 
  language: string
): Promise<DiagnosticResult> {
  const parts: any[] = [
    {
      text: `Act as a world-class repair expert. Analyze the provided ${base64Image ? 'image and ' : ''}description. 
      User description: "${description || 'No description provided'}"
      Provide instructions in ${language}. 
      Identify:
      1. The specific problem.
      2. A clear diagnosis.
      3. Detailed step-by-step repair instructions with safety warnings.
      4. A list of specific tools needed.
      Use Google Search to find high-quality, reliable repair guides.
      Return the response in a structured JSON format.`,
    }
  ];

  if (base64Image) {
    parts.unshift({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ parts }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          problem: { type: Type.STRING },
          diagnosis: { type: Type.STRING },
          steps: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          toolsNeeded: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                uri: { type: Type.STRING }
              }
            }
          }
        },
        required: ["problem", "diagnosis", "steps", "toolsNeeded"]
      }
    }
  });

  const jsonStr = response.text.trim();
  const parsed = JSON.parse(jsonStr);

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const searchSources = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      title: chunk.web.title || "Reference",
      uri: chunk.web.uri
    }));

  return {
    ...parsed,
    sources: searchSources.length > 0 ? searchSources : (parsed.sources || []),
    timestamp: Date.now()
  };
}

export async function startRepairChat() {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: 'You are an expert 24/7 repair assistant. You provide helpful, safe, and accurate advice for fixing cars, appliances, electronics, and home structures. Keep answers concise but thorough.',
    },
  });
}
