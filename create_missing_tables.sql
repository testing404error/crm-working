-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create communications table
CREATE TABLE IF NOT EXISTS public.communications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
