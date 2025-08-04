import { format, subDays, isAfter, parseISO } from 'date-fns';

export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
};

export const formatDisplayDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'dd/MM/yyyy');
};

export const getLast10Days = (): Date => {
  return subDays(new Date(), 10);
};

export const isWithinLast10Days = (date: string): boolean => {
  const dateObj = parseISO(date);
  const tenDaysAgo = getLast10Days();
  return isAfter(dateObj, tenDaysAgo);
};

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};