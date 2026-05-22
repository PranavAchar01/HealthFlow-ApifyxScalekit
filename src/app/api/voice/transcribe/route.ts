import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const elFormData = new FormData();
  elFormData.append("file", audioFile);
  elFormData.append("model_id", "scribe_v1");
  elFormData.append("language_code", "eng");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: elFormData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `ElevenLabs API error: ${response.status}`, details: errorText },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    text: data.text ?? "",
    language_code: data.language_code ?? "eng",
    language_probability: data.language_probability ?? 1,
  });
}
