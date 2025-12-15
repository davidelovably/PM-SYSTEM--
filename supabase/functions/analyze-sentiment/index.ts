// Deno edge runtime - Sentiment Analysis for Comments
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { commentId, content } = await req.json();

    if (!commentId || !content) {
      throw new Error('commentId and content are required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing sentiment for comment:', commentId);

    // Call Lovable AI for sentiment analysis
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a sentiment analysis expert. Analyze the sentiment of the given text and respond with ONLY one word: Positive, Neutral, or Negative.'
          },
          {
            role: 'user',
            content: `Analyze the sentiment of this comment: "${content}"`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const sentimentText = data.choices[0].message.content.trim();
    
    // Validate sentiment
    let sentiment = 'Neutral';
    if (['Positive', 'Neutral', 'Negative'].includes(sentimentText)) {
      sentiment = sentimentText;
    }

    console.log('Sentiment detected:', sentiment);

    // Update comment with sentiment using the authenticated client
    const { error: updateError } = await supabaseClient
      .from('comments')
      .update({ sentiment_label: sentiment })
      .eq('id', commentId);

    if (updateError) {
      console.error('Failed to update comment:', updateError);
      throw new Error('Failed to update comment with sentiment');
    }

    console.log('Comment updated with sentiment successfully');

    return new Response(
      JSON.stringify({ sentiment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-sentiment function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
