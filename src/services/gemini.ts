import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const summarizeNote = async (content: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize the following study notes into a concise, structured summary with bullet points. Focus on key concepts and definitions.\n\nNotes:\n${content}`,
    config: {
      systemInstruction: "You are a helpful study assistant. Provide clear, concise, and structured summaries.",
    },
  });
  return response.text;
};

export const explainConcepts = async (content: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Explain the difficult concepts in the following study notes in simple language. Use analogies where helpful and provide examples.\n\nNotes:\n${content}`,
    config: {
      systemInstruction: "You are a teacher who explains complex topics simply for students.",
    },
  });
  return response.text;
};

export const generateQuiz = async (content: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a multiple-choice quiz based on the following study notes. Provide 5 questions. Return the response in JSON format.\n\nNotes:\n${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["question", "options", "correctAnswer", "explanation"],
        },
      },
    },
  });
  
  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse quiz JSON", e);
    return [];
  }
};
