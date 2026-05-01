
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    console.log('--- Checking subscription_plans ---');
    const { data: plans, error: plansError } = await supabase.from('subscription_plans').select('*').limit(1);
    if (plansError) console.error('subscription_plans error:', plansError.message);
    else console.log('subscription_plans exists, count:', plans.length);

    console.log('--- Checking studio_settings ---');
    const { data: settings, error: settingsError } = await supabase.from('studio_settings').select('*').limit(1);
    if (settingsError) console.error('studio_settings error:', settingsError.message);
    else console.log('studio_settings exists, count:', settings.length);

    console.log('--- Checking calendar_events ---');
    const { data: events, error: eventsError } = await supabase.from('calendar_events').select('*').limit(1);
    if (eventsError) console.error('calendar_events error:', eventsError.message);
    else console.log('calendar_events exists, count:', events.length);
}

check();
