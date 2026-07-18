import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ content: "You must be logged in to use the AI Tutor." }, { status: 401 });
    }

    // 2. Fetch User Profile & Global Settings
    const [ { data: profile }, { data: settings } ] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('site_settings').select('is_ai_tutor_enabled').eq('id', 1).single()
    ]);

    // 3. MASTER TOGGLE CHECK: Block if disabled (unless they are an admin testing the system)
    if (!settings?.is_ai_tutor_enabled && profile?.role !== 'admin') {
      return NextResponse.json({ 
        content: "✨ The AI Tutor is currently offline for maintenance. Check back soon!",
        flagged: false
      });
    }
    
    const body = await req.json();
    const { questionId, questionText, options, correctAnswer, modelAnswer } = body;

    // 4. THE CACHE CHECK: Look for an existing explanation
    const { data: cachedExplanation } = await supabase
      .from('question_explanations')
      .select('*')
      .eq('question_id', questionId)
      .single();

    // If it exists, return it immediately! (Zero API Cost)
    if (cachedExplanation) {
      return NextResponse.json({
        content: cachedExplanation.explanation_text,
        flagged: cachedExplanation.is_flagged
      });
    }

    // --- 5. If no cache exists, call DeepSeek ---
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const systemPrompt = `You are the LensIQ tutor... (Keep your exact same system prompt here!) 
    MODE: EXPLAIN — Give a deeper explanation.
    You MUST always respond in strictly valid JSON format matching this exact shape:
    { "content": "...", "flagged": false, "flag_reason": null }`;

    const userPrompt = `
    Question: ${questionText}
    Options: ${JSON.stringify(options)}
    Correct Answer: ${correctAnswer}
    Stored Model Answer: ${modelAnswer || "None provided."}
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        response_format: { type: 'json_object' }, 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    const data = await response.json();
    const aiResponseJson = JSON.parse(data.choices[0].message.content);

    // 6. SAVE TO CACHE for the next user
    await supabase.from('question_explanations').insert({
      question_id: questionId,
      explanation_text: aiResponseJson.content,
      is_flagged: aiResponseJson.flagged
    });

    // 7. Handle Flags
    if (aiResponseJson.flagged) {
      // Create the answer_flags table later if it doesn't exist, we will use a try-catch so it doesn't break the response
      try {
        await supabase.from('answer_flags').insert({
          question_id: questionId,
          flag_reason: aiResponseJson.flag_reason || 'Flagged by AI Tutor',
          raised_by_user_id: user.id
        });
      } catch (flagError) {
        console.error("Flag save error:", flagError);
      }
    }
    
    return NextResponse.json(aiResponseJson);

  } catch (error) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { content: "The AI Tutor is currently analyzing other charts. Please try again.", flagged: false }, 
      { status: 500 }
    );
  }
}
