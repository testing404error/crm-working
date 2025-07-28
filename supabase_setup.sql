-- Create the pending_access_requests table
CREATE TABLE IF NOT EXISTS pending_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON pending_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_receiver ON pending_access_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON pending_access_requests(status);

-- Enable Row Level Security
ALTER TABLE pending_access_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "Users can view their own requests" ON pending_access_requests
    FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert their own requests" ON pending_access_requests
    FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Receivers can update request status" ON pending_access_requests
    FOR UPDATE USING (receiver_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Requesters can delete their own requests" ON pending_access_requests
    FOR DELETE USING (requester_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_access_requests_updated_at
    BEFORE UPDATE ON pending_access_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
