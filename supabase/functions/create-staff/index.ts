import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  email?: string;
  role?: string;
  full_name?: string;
  contact_number?: string | null;
  hire_date?: string | null;
  job_title?: string | null;
  employment_status?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  emergency_contact?: string | null;
  base_rate_cents?: number | null;
  rate_period?: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null || typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: 'Server configuration error' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401);
    }

    let body: Body;
    try {
      const text = await req.text();
      body = text ? (JSON.parse(text) as Body) : {};
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !caller) {
      return json({ error: 'Invalid session' }, 401);
    }

    const { data: adminProfile } = await userClient.from('profiles').select('role').eq('id', caller.id).single();
    if (adminProfile?.role !== 'admin') {
      return json({ error: 'Admin only' }, 403);
    }

    const email = body.email?.trim().toLowerCase();
    const role = body.role;
    const full_name = body.full_name?.trim();

    if (!email || !role || !full_name) {
      return json({ error: 'email, role, and full_name are required' }, 400);
    }

    const allowedRoles = ['admin', 'dispatcher', 'driver'];
    if (!allowedRoles.includes(role)) {
      return json({ error: 'Invalid role' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tempPassword = `${crypto.randomUUID()}Aa1!`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role,
        full_name,
        contact_number: body.contact_number ?? undefined,
      },
    });

    if (createErr || !created.user) {
      return json(
        { error: createErr?.message ?? 'Failed to create login for this email' },
        400,
      );
    }

    const uid = created.user.id;

    const hire_date = emptyToNull(body.hire_date ?? undefined);
    const license_expiry = emptyToNull(body.license_expiry ?? undefined);

    const { data: updatedRow, error: updErr } = await admin
      .from('profiles')
      .update({
        role,
        full_name,
        email,
        contact_number: body.contact_number ?? null,
        hire_date,
        job_title: emptyToNull(body.job_title ?? undefined),
        employment_status: body.employment_status ?? 'Active',
        license_number: emptyToNull(body.license_number ?? undefined),
        license_expiry,
        emergency_contact: emptyToNull(body.emergency_contact ?? undefined),
        base_rate_cents: body.base_rate_cents ?? 0,
        rate_period: body.rate_period ?? 'monthly',
      })
      .eq('id', uid)
      .select('id')
      .maybeSingle();

    if (updErr) {
      await admin.auth.admin.deleteUser(uid);
      return json({ error: updErr.message }, 500);
    }

    if (!updatedRow) {
      await admin.auth.admin.deleteUser(uid);
      return json({ error: 'Profile was not created for this user. Check the handle_new_user trigger on auth.users.' }, 500);
    }

    return json({ id: uid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
