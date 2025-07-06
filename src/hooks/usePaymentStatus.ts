import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentTransaction } from '@/types/payment';

interface UsePaymentStatusOptions {
  userId?: string;
  reference?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface PaymentStatusState {
  transactions: PaymentTransaction[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const usePaymentStatus = (options: UsePaymentStatusOptions = {}) => {
  const {
    userId,
    reference,
    autoRefresh = false,
    refreshInterval = 30000 // 30 seconds
  } = options;

  const [state, setState] = useState<PaymentStatusState>({
    transactions: [],
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by user ID if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Filter by reference if provided
      if (reference) {
        query = query.eq('paystack_reference', reference);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        transactions: (data || []) as PaymentTransaction[],
        isLoading: false,
        lastUpdated: new Date()
      }));

    } catch (error: any) {
      console.error('usePaymentStatus: Failed to fetch transactions', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to fetch payment status',
        isLoading: false
      }));
    }
  }, [userId, reference]);

  // Get specific transaction by reference
  const getTransactionByReference = useCallback((ref: string): PaymentTransaction | null => {
    return state.transactions.find(t => t.paystack_reference === ref) || null;
  }, [state.transactions]);

  // Get transactions by status
  const getTransactionsByStatus = useCallback((status: PaymentTransaction['status']): PaymentTransaction[] => {
    return state.transactions.filter(t => t.status === status);
  }, [state.transactions]);

  // Check if a specific payment is successful
  const isPaymentSuccessful = useCallback((ref: string): boolean => {
    const transaction = getTransactionByReference(ref);
    return transaction?.status === 'success';
  }, [getTransactionByReference]);

  // Check if a specific payment is pending
  const isPaymentPending = useCallback((ref: string): boolean => {
    const transaction = getTransactionByReference(ref);
    return transaction?.status === 'initiated';
  }, [getTransactionByReference]);

  // Get total amount paid by user
  const getTotalPaidAmount = useCallback((): number => {
    return state.transactions
      .filter(t => t.status === 'success')
      .reduce((total, t) => total + t.amount, 0);
  }, [state.transactions]);

  // Get recent transactions (last 30 days)
  const getRecentTransactions = useCallback((): PaymentTransaction[] => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return state.transactions.filter(t => 
      new Date(t.created_at) >= thirtyDaysAgo
    );
  }, [state.transactions]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchTransactions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchTransactions]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Listen for real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('payment-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('usePaymentStatus: Real-time update received', payload);
          
          // Refresh transactions on any change
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTransactions]);

  return {
    // State
    transactions: state.transactions,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,

    // Actions
    refetch: fetchTransactions,

    // Utilities
    getTransactionByReference,
    getTransactionsByStatus,
    isPaymentSuccessful,
    isPaymentPending,
    getTotalPaidAmount,
    getRecentTransactions,

    // Statistics
    stats: {
      total: state.transactions.length,
      successful: getTransactionsByStatus('success').length,
      pending: getTransactionsByStatus('initiated').length,
      failed: getTransactionsByStatus('failed').length,
      totalAmount: getTotalPaidAmount()
    }
  };
};