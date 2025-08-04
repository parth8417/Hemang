import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Employee, SalaryEntry, CreditEntry, PaymentRecord } from '@/types';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    try {
      console.log('Fetching employees from Supabase...');
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Supabase response:', { data, error });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      const formattedEmployees = data?.map(emp => ({
        id: emp.id,
        name: emp.name,
        mobile: emp.mobile,
        createdAt: emp.created_at
      })) || [];
      
      console.log('Formatted employees:', formattedEmployees);
      setEmployees(formattedEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEmployee = async (employee: Omit<Employee, 'id' | 'createdAt'>) => {
    try {
      console.log('Adding employee to Supabase:', employee);
      console.log('Supabase client available:', !!supabase);
      
      const { data, error } = await supabase
        .from('employees')
        .insert([{
          name: employee.name,
          mobile: employee.mobile
        }])
        .select()
        .single();
      
      console.log('Insert response:', { data, error });
      
      if (error) {
        console.error('Insert error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      if (!data) {
        console.error('No data returned from insert');
        throw new Error('No data returned from insert');
      }
      
      const newEmployee = {
        id: data.id,
        name: data.name,
        mobile: data.mobile,
        createdAt: data.created_at
      };
      
      console.log('New employee created:', newEmployee);
      setEmployees(prev => [newEmployee, ...prev]);
      
      // Also refresh the list to make sure we get the latest data
      await fetchEmployees();
      
      return newEmployee;
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchEmployees();

    // Set up real-time subscription
    const subscription = supabase
      .channel('employees_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          console.log('Employees table changed:', payload);
          fetchEmployees(); // Refetch data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { employees, loading, addEmployee, refetch: fetchEmployees };
}

export function useSalaryEntries() {
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSalaryEntries = async () => {
    try {
      console.log('Fetching salary entries from Supabase...');
      const { data, error } = await supabase
        .from('salary_entries')
        .select('*')
        .order('date', { ascending: false });
      
      console.log('Raw salary entries from database:', data);
      
      if (error) throw error;
      
      const formattedEntries = data?.map(entry => ({
        id: entry.id,
        employeeId: entry.employee_id,
        date: entry.date,
        amount: Number(entry.amount),
        liters: Number(entry.liters),
        animalType: entry.animal_type as 'cow' | 'buffalo',
        createdAt: entry.created_at
      })) || [];
      
      console.log('Formatted salary entries:', formattedEntries);
      setSalaryEntries(formattedEntries);
    } catch (error) {
      console.error('Error fetching salary entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSalaryEntry = async (entry: Omit<SalaryEntry, 'id' | 'createdAt'>) => {
    try {
      console.log('Adding salary entry to Supabase:', entry);
      const { data, error } = await supabase
        .from('salary_entries')
        .insert([{
          employee_id: entry.employeeId,
          date: entry.date,
          amount: entry.amount,
          liters: entry.liters,
          animal_type: entry.animalType
        }])
        .select()
        .single();
      
      console.log('Insert response:', { data, error });
      
      if (error) {
        console.error('Insert error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      const newEntry = {
        id: data.id,
        employeeId: data.employee_id,
        date: data.date,
        amount: Number(data.amount),
        liters: Number(data.liters),
        animalType: data.animal_type as 'cow' | 'buffalo',
        createdAt: data.created_at
      };
      
      console.log('New salary entry created:', newEntry);
      setSalaryEntries(prev => [newEntry, ...prev]);
      return newEntry;
    } catch (error) {
      console.error('Error adding salary entry:', error);
      throw error;
    }
  };

  const removeSalaryEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('salary_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setSalaryEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (error) {
      console.error('Error removing salary entry:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchSalaryEntries();

    // Set up real-time subscription
    const subscription = supabase
      .channel('salary_entries_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'salary_entries' },
        (payload) => {
          console.log('Salary entries table changed:', payload);
          fetchSalaryEntries(); // Refetch data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { salaryEntries, loading, addSalaryEntry, removeSalaryEntry, refetch: fetchSalaryEntries };
}

export function useCreditEntries() {
  const [creditEntries, setCreditEntries] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCreditEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_entries')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      const formattedEntries = data?.map(entry => ({
        id: entry.id,
        employeeId: entry.employee_id,
        date: entry.date,
        itemName: entry.item_name,
        amount: Number(entry.amount),
        createdAt: entry.created_at
      })) || [];
      
      setCreditEntries(formattedEntries);
    } catch (error) {
      console.error('Error fetching credit entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCreditEntry = async (entry: Omit<CreditEntry, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('credit_entries')
        .insert([{
          employee_id: entry.employeeId,
          date: entry.date,
          item_name: entry.itemName,
          amount: entry.amount
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      const newEntry = {
        id: data.id,
        employeeId: data.employee_id,
        date: data.date,
        itemName: data.item_name,
        amount: Number(data.amount),
        createdAt: data.created_at
      };
      
      setCreditEntries(prev => [newEntry, ...prev]);
      return newEntry;
    } catch (error) {
      console.error('Error adding credit entry:', error);
      throw error;
    }
  };

  const updateCreditEntry = async (id: string, entry: Omit<CreditEntry, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('credit_entries')
        .update({
          employee_id: entry.employeeId,
          date: entry.date,
          item_name: entry.itemName,
          amount: entry.amount
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      const updatedEntry = {
        id: data.id,
        employeeId: data.employee_id,
        date: data.date,
        itemName: data.item_name,
        amount: Number(data.amount),
        createdAt: data.created_at
      };
      
      setCreditEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
      return updatedEntry;
    } catch (error) {
      console.error('Error updating credit entry:', error);
      throw error;
    }
  };

  const removeCreditEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('credit_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setCreditEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (error) {
      console.error('Error removing credit entry:', error);
      throw error;
    }
  };

  const updateCreditEntries = async (entries: CreditEntry[]) => {
    try {
      // First, clear all existing credit entries
      const { error: deleteError } = await supabase
        .from('credit_entries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all entries
      
      if (deleteError) throw deleteError;
      
      // Insert new entries if any exist
      if (entries.length > 0) {
        const { error: insertError } = await supabase
          .from('credit_entries')
          .insert(entries.map(entry => ({
            employee_id: entry.employeeId,
            date: entry.date,
            item_name: entry.itemName,
            amount: entry.amount
          })));
        
        if (insertError) throw insertError;
      }
      
      // Update local state
      setCreditEntries(entries);
      
      // Refetch to ensure consistency
      await fetchCreditEntries();
    } catch (error) {
      console.error('Error updating credit entries:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchCreditEntries();

    // Set up real-time subscription
    const subscription = supabase
      .channel('credit_entries_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'credit_entries' },
        (payload) => {
          console.log('Credit entries table changed:', payload);
          fetchCreditEntries(); // Refetch data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { creditEntries, loading, addCreditEntry, updateCreditEntry, removeCreditEntry, updateCreditEntries, refetch: fetchCreditEntries };
}

export function usePaymentRecords() {
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      
      const formattedRecords = data?.map(record => ({
        id: record.id,
        employeeId: record.employee_id,
        salaryAmount: Number(record.salary_amount),
        creditDeducted: Number(record.credit_deducted),
        netPaid: Number(record.net_paid),
        paymentDate: record.payment_date,
        createdAt: record.created_at
      })) || [];
      
      setPaymentRecords(formattedRecords);
    } catch (error) {
      console.error('Error fetching payment records:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPaymentRecord = async (record: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('payment_records')
        .insert([{
          employee_id: record.employeeId,
          salary_amount: record.salaryAmount,
          credit_deducted: record.creditDeducted,
          net_paid: record.netPaid,
          payment_date: record.paymentDate
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      const newRecord = {
        id: data.id,
        employeeId: data.employee_id,
        salaryAmount: Number(data.salary_amount),
        creditDeducted: Number(data.credit_deducted),
        netPaid: Number(data.net_paid),
        paymentDate: data.payment_date,
        createdAt: data.created_at
      };
      
      setPaymentRecords(prev => [newRecord, ...prev]);
      return newRecord;
    } catch (error) {
      console.error('Error adding payment record:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchPaymentRecords();

    // Set up real-time subscription
    const subscription = supabase
      .channel('payment_records_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'payment_records' },
        (payload) => {
          console.log('Payment records table changed:', payload);
          fetchPaymentRecords(); // Refetch data when changes occur
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { paymentRecords, loading, addPaymentRecord, refetch: fetchPaymentRecords };
}