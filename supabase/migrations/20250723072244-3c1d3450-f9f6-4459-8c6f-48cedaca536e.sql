-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create salary_entries table
CREATE TABLE public.salary_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  liters DECIMAL(8,2) NOT NULL,
  animal_type TEXT NOT NULL CHECK (animal_type IN ('cow', 'buffalo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_entries table
CREATE TABLE public.credit_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_records table
CREATE TABLE public.payment_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_amount DECIMAL(10,2) NOT NULL,
  credit_deducted DECIMAL(10,2) NOT NULL,
  net_paid DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- Create policies for employees
CREATE POLICY "Allow all operations on employees" 
ON public.employees 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create policies for salary_entries
CREATE POLICY "Allow all operations on salary_entries" 
ON public.salary_entries 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create policies for credit_entries
CREATE POLICY "Allow all operations on credit_entries" 
ON public.credit_entries 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create policies for payment_records
CREATE POLICY "Allow all operations on payment_records" 
ON public.payment_records 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_salary_entries_employee_id ON public.salary_entries(employee_id);
CREATE INDEX idx_salary_entries_date ON public.salary_entries(date);
CREATE INDEX idx_credit_entries_employee_id ON public.credit_entries(employee_id);
CREATE INDEX idx_credit_entries_date ON public.credit_entries(date);
CREATE INDEX idx_payment_records_employee_id ON public.payment_records(employee_id);
CREATE INDEX idx_payment_records_date ON public.payment_records(payment_date);