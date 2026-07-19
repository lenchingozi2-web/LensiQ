import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate the User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in to use Teaching Mode." }, { status: 401 });
    }

        // =========================================================================
    // STEP 0: THE ADMIN BOUNCER - Check if the Admin Globally Paused AI
    // =========================================================================
    // We check the correct 'site_settings' table
    const { data: adminSettings } = await supabase
      .from('site_settings') 
      .select('is_ai_tutor_enabled')
      .eq('id', 1)
      .single();

    // If the admin explicitly turned it off, block the request here
    if (adminSettings && adminSettings.is_ai_tutor_enabled === false) {
      return NextResponse.json({ 
        error: "ai_paused",
        message: "The AI Tutor is currently paused for maintenance. Please check back shortly." 
      }, { status: 503 }); // 503 means Service Unavailable
    }
    // =========================================================================


    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, ai_teachings_used')
      .eq('id', user.id)
      .single();

    // 2. Extract the Request Data
    const body = await req.json();
    const { courseName, messages } = body;
    
    const isFirstMessage = messages.length === 1;

    // 3. Check Subscription Limits
    if (isFirstMessage && profile?.plan === 'free' && (profile?.ai_teachings_used || 0) >= 6) {
      return NextResponse.json({ 
        error: "limit_reached",
        message: "You have reached your 6 free AI Teaching sessions for this month. Upgrade to Premium for unlimited access."
      }, { status: 403 });
    }

    // 4. Update Usage Limits BEFORE starting the stream
    if (isFirstMessage && profile?.plan === 'free') {
      await supabase
        .from('profiles')
        .update({ ai_teachings_used: (profile.ai_teachings_used || 0) + 1 })
        .eq('id', user.id);
    }

    // 5. Construct the Elite Medical Chat Prompt
    const systemPrompt = `You are LensiqAI, an elite, conversational medical tutor. 
Your current branch focus is: ${courseName}.

DYNAMIC SCALING & TONE RULES:
- Speak like an approachable, brilliant senior colleague. 
- ADAPT YOUR LENGTH TO THE PROMPT:
  1. For BROAD topics (e.g., "Teach me Autonomic Pharmacology"): Provide deep, detailed explanations using the strict frameworks below.
  2. For NARROW/SPECIFIC questions (e.g., "What is a receptor?"): Be direct and concise. DO NOT force the large framework.
- Use analogies sparingly.

STRUCTURE FRAMEWORKS (Apply ONLY to Broad Topics):
- PATHOLOGY: Introduction, Classification, Aetiology / Risk factors, Pathogenesis / Complications, Diagnosis, Prognosis, Treatment. 
- PHARMACOLOGY: Classification, Pharmacodynamics, Pharmacokinetics, Mechanism of action, Receptor, Indication, Contraindication, Drug interaction.

FORMATTING & INTERACTIVE KNOWLEDGE CHECK:
- Use clear Markdown headings (##, ###) and bullet points. Bold key clinical terms.
- For BROAD topics, end with a brief "High-Yield Summary".
- IMMEDIATELY after the summary, provide EXACTLY ONE past question (MCQ or theory). Label it "📝 Knowledge Check".
- STOP THERE. Ask the student to type their answer so you can grade it.
- If grading an answer, tell them if they are right or wrong, provide the correct rationale, and ask if they are ready to move on.`;

    // 6. Call DeepSeek API with Streaming Enabled
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner', 
        stream: true, 
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      })
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    // 7. Pipe the stream directly to the frontend
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("AI Teaching Error:", error);
    return NextResponse.json({ error: "The AI Tutor encountered an error. Please try again." }, { status: 500 });
  }
}
