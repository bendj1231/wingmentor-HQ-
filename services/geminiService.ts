
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProfessionalBio = async (name: string, company: string, position: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a professional, short (max 2 sentences) bio for a person named ${name} who works as a ${position} at ${company}. Make it sound modern and engaging.`,
    });
    
    return response.text?.trim() || "No bio generated.";
  } catch (error) {
    console.error("Error generating bio:", error);
    return "Professional bio generation failed. Please try again later.";
  }
};
