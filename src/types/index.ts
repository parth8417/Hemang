export interface Employee {
  id: string;
  name: string;
  mobile: string;
  createdAt: string;
}

export interface SalaryEntry {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  liters: number;
  animalType: 'cow' | 'buffalo';
  createdAt: string;
}

export interface CreditEntry {
  id: string;
  employeeId: string;
  date: string;
  itemName: string;
  amount: number;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  employeeId: string;
  salaryAmount: number;
  creditDeducted: number;
  netPaid: number;
  paymentDate: string;
  createdAt: string;
}

export interface PaymentSummary {
  employeeId: string;
  employeeName: string;
  lastSalary: number;
  totalCreditSinceLastPayment: number;
  netPayable: number;
  salaryEntryCount?: number;
  avgSalaryPerEntry?: number;
  hasRecentActivity?: boolean;
  lastPaymentDate?: string | null;
}