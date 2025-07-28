import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'https://kkznqgglzitdzqlbgxly.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrem5xZ2dseml0ZHpxbGJneGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5OTQ5MzgsImV4cCI6MjA1MTU3MDkzOH0._o2cCuwS0yQIYwQlPNbYKhYQ_aKvl3vhQCGKovbVBXk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableSchema() {
    try {
        // Query to get column information for pending_access_requests table
        const { data, error } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, is_nullable')
            .eq('table_name', 'pending_access_requests')
            .eq('table_schema', 'public');

        if (error) {
            console.error('Error fetching schema:', error);
            return;
        }

        console.log('Columns in pending_access_requests table:');
        console.log('=====================================');
        data.forEach(column => {
            console.log(`${column.column_name} (${column.data_type}) - Nullable: ${column.is_nullable}`);
        });

        // Also try to get a sample row to see the actual structure
        console.log('\nSample data from pending_access_requests:');
        console.log('========================================');
        const { data: sampleData, error: sampleError } = await supabase
            .from('pending_access_requests')
            .select('*')
            .limit(1);

        if (sampleError) {
            console.error('Error fetching sample data:', sampleError);
        } else {
            console.log(JSON.stringify(sampleData, null, 2));
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkTableSchema();
