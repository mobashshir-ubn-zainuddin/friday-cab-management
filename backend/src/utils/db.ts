import { supabase } from '../config/supabaseClient';

// Database helper functions using Supabase PostgreSQL
export const db = {
  // Execute raw SQL queries
  async query(sql: string, params?: any[]) {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: sql,
      params: params || []
    });

    if (error) throw error;
    return data;
  },

  // Table operations
  async from(table: string) {
    return supabase.from(table);
  },

  // Check unpaid bookings for a user
  async getUnpaidBookings(userId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'FAILED']);

    if (error) throw error;
    return data || [];
  },

  // Count unpaid bookings for a user
  async countUnpaidBookings(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['PENDING', 'FAILED']);

    if (error) throw error;
    return count || 0;
  },

  // Block user due to unpaid bookings
  async blockUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ is_blocked: true, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Verify IITKGP email
  isValidIITKGPEmail(email: string): boolean {
    const lowerEmail = email.toLowerCase();
    return lowerEmail.endsWith('@kgpian.iitkgp.ac.in');
  },

  // Extract roll number from IITKGP email
  extractRollNumber(email: string): string | null {
    const lowerEmail = email.toLowerCase();
    const match = lowerEmail.match(/^([^@]+)@kgpian\.iitkgp\.ac\.in$/);
    return match ? match[1] : null;
  }
};

export default db;
