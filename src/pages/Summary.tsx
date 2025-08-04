import { useState, useMemo, useEffect } from "react";
import { Search, FileText, Users, DollarSign, ShoppingCart, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees, useSalaryEntries, useCreditEntries, usePaymentRecords } from "@/hooks/useSupabaseData";
import { Employee, SalaryEntry, CreditEntry, PaymentRecord } from "@/types";
import { formatCurrency, formatDisplayDate } from "@/utils/dateUtils";

const Summary = () => {
  const { employees, loading: employeesLoading, refetch: refetchEmployees } = useEmployees();
  const { salaryEntries, loading: salaryLoading, refetch: refetchSalary } = useSalaryEntries();
  const { creditEntries, loading: creditLoading, refetch: refetchCredit } = useCreditEntries();
  const { paymentRecords, loading: paymentLoading, refetch: refetchPayments } = usePaymentRecords();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isLoading = employeesLoading || salaryLoading || creditLoading || paymentLoading;

  // Filter data based on search and date range
  const filteredData = useMemo(() => {
    const filterByDate = (dateStr: string) => {
      if (!startDate && !endDate) return true;
      const date = new Date(dateStr);
      const start = startDate ? new Date(startDate) : new Date('1900-01-01');
      const end = endDate ? new Date(endDate) : new Date('2100-01-01');
      return date >= start && date <= end;
    };

    const filterByEmployee = (employeeId: string) => {
      if (!selectedEmployeeId || selectedEmployeeId === "all") return true;
      return employeeId === selectedEmployeeId;
    };

    return {
      employees: selectedEmployeeId && selectedEmployeeId !== "all"
        ? employees.filter(emp => emp.id === selectedEmployeeId) 
        : employees,
      salaryEntries: salaryEntries
        .filter(entry => filterByDate(entry.date) && filterByEmployee(entry.employeeId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      creditEntries: creditEntries
        .filter(entry => filterByDate(entry.date) && filterByEmployee(entry.employeeId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      paymentRecords: paymentRecords
        .filter(record => filterByDate(record.paymentDate) && filterByEmployee(record.employeeId))
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
    };
  }, [employees, salaryEntries, creditEntries, paymentRecords, selectedEmployeeId, startDate, endDate]);

  // Debug logging for salary entries
  useEffect(() => {
    console.log('Salary entries updated:', {
      count: salaryEntries.length,
      entries: salaryEntries.slice(0, 3).map(entry => ({
        id: entry.id,
        employeeId: entry.employeeId,
        amount: entry.amount,
        liters: entry.liters,
        date: entry.date,
        animalType: entry.animalType
      }))
    });
  }, [salaryEntries]);

  // Calculate summary statistics with better error handling
  const stats = useMemo(() => {
    try {
      const safeSalaryEntries = filteredData.salaryEntries || [];
      const safeCreditEntries = filteredData.creditEntries || [];
      const safePaymentRecords = filteredData.paymentRecords || [];
      
      console.log('Calculating stats with salary entries:', safeSalaryEntries);
      
      const totalSalary = safeSalaryEntries.reduce((sum, entry) => {
        const amount = Number(entry?.amount) || 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      const totalCredit = safeCreditEntries.reduce((sum, entry) => {
        const amount = Number(entry?.amount) || 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      const totalPayments = safePaymentRecords.reduce((sum, record) => {
        const netPaid = Number(record?.netPaid) || 0;
        return sum + (isNaN(netPaid) ? 0 : netPaid);
      }, 0);

      return {
        totalEmployees: (filteredData.employees || []).length,
        totalSalary: Number(totalSalary.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        totalPayments: Number(totalPayments.toFixed(2)),
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        totalEmployees: 0,
        totalSalary: 0,
        totalCredit: 0,
        totalPayments: 0,
      };
    }
  }, [filteredData]);

  const getEmployeeName = useMemo(() => {
    return (employeeId: string) => {
      if (!employeeId || !employees || employees.length === 0) return "Unknown Employee";
      const employee = employees.find(emp => emp?.id === employeeId);
      return employee ? `${employee.name || 'N/A'} (${employee.mobile || 'N/A'})` : "Unknown Employee";
    };
  }, [employees]);

  const getEmployeeById = useMemo(() => {
    return (employeeId: string) => {
      if (!employeeId || !employees || employees.length === 0) return null;
      return employees.find(emp => emp?.id === employeeId) || null;
    };
  }, [employees]);

  // Helper function for safe calculations
  const safeCalculate = (items: any[], field: string, defaultValue: number = 0): number => {
    if (!Array.isArray(items)) return defaultValue;
    const result = items.reduce((sum, item) => {
      const value = Number(item?.[field]) || 0;
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    
    // Debug logging for liters
    if (field === 'liters' && items.length > 0) {
      console.log('Calculating liters:', {
        items: items.map(item => ({ id: item?.id, liters: item?.liters, field: item?.[field] })),
        result,
        field
      });
    }
    
    return result;
  };

  const clearFilters = () => {
    setSelectedEmployeeId("all");
    setStartDate("");
    setEndDate("");
  };

  const refreshAllData = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('Refreshing all data...');
      await Promise.all([
        refetchEmployees(),
        refetchSalary(),
        refetchCredit(),
        refetchPayments()
      ]);
      console.log('All data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh effect - refresh data every 30 seconds when visible
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const handleVisibilityChange = () => {
      if (!document.hidden && !isLoading) {
        refreshAllData();
      }
    };
    
    // Refresh when page becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Auto-refresh every 30 seconds when tab is active
    if (!document.hidden) {
      intervalId = setInterval(() => {
        if (!isLoading && !isRefreshing) {
          refreshAllData();
        }
      }, 30000); // 30 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading, isRefreshing]);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading summary data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Business Summary</h1>
              <div className="flex items-center space-x-2">
                <p className="text-muted-foreground">Complete overview of your dairy farm operations</p>
                {isRefreshing && (
                  <div className="flex items-center space-x-1 text-sm animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-blue-500">Syncing...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                onClick={refreshAllData}
                disabled={isRefreshing}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button 
                variant="outline"
                onClick={() => console.log('Current state:', { 
                  employees: employees.length, 
                  salaryEntries: salaryEntries.length,
                  salaryEntriesData: salaryEntries.slice(0, 2),
                  creditEntries: creditEntries.length, 
                  paymentRecords: paymentRecords.length 
                })}
              >
                Debug Data
              </Button>
            </div>
          </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Filter by Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee or view all" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} - {employee.mobile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                <p className="text-xl sm:text-2xl font-bold">{stats.totalEmployees}</p>
              </div>
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Salary</p>
                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.totalSalary)}</p>
              </div>
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Credit</p>
                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.totalCredit)}</p>
              </div>
              <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Payments</p>
                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.totalPayments)}</p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Data Tables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Complete Lifetime Records & Employee Details</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {selectedEmployeeId && selectedEmployeeId !== "all"
              ? `📊 Detailed lifetime records for: ${getEmployeeName(selectedEmployeeId)}` 
              : "📈 Complete database records for all employees (sorted chronologically - latest first)"}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">📋 Overview</TabsTrigger>
              <TabsTrigger value="salary" className="text-xs sm:text-sm">💰 Salary</TabsTrigger>
              <TabsTrigger value="credit" className="text-xs sm:text-sm">🛒 Credit</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs sm:text-sm">💳 Payments</TabsTrigger>
              <TabsTrigger value="employees" className="text-xs sm:text-sm">👥 Employees</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="space-y-4">
                {selectedEmployeeId && selectedEmployeeId !== "all" ? (
                  // Single employee detailed overview
                  (() => {
                    const employee = getEmployeeById(selectedEmployeeId);
                    if (!employee) {
                      return (
                        <div className="text-center p-8">
                          <p className="text-muted-foreground">Employee not found</p>
                          <Button onClick={clearFilters} className="mt-4">
                            Clear Filters
                          </Button>
                        </div>
                      );
                    }
                    
                    const empSalaries = filteredData.salaryEntries || [];
                    const empCredits = filteredData.creditEntries || [];
                    const empPayments = filteredData.paymentRecords || [];
                    
                    const totalEarned = safeCalculate(empSalaries, 'amount', 0);
                    const totalCredits = safeCalculate(empCredits, 'amount', 0);
                    const totalPaid = safeCalculate(empPayments, 'netPaid', 0);
                    const totalMilk = safeCalculate(empSalaries, 'liters', 0);
                    const avgRate = totalMilk > 0 ? Number((totalEarned / totalMilk).toFixed(2)) : 0;
                    const salaryAmountPaid = safeCalculate(empPayments, 'salaryAmount', 0);
                    const currentBalance = Number((totalEarned - totalCredits - salaryAmountPaid).toFixed(2));
                    
                    const lastSalaryEntry = empSalaries?.[0] || null;
                    const lastCreditEntry = empCredits?.[0] || null;
                    const lastPayment = empPayments?.[0] || null;
                    
                    return (
                      <div className="space-y-6">
                        {/* Employee Header Card */}
                        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <h2 className="text-2xl font-bold text-blue-900">👨‍🌾 {employee.name}</h2>
                                <p className="text-blue-700">📱 Mobile: {employee.mobile}</p>
                                <p className="text-blue-600 text-sm">📅 Joined: {formatDisplayDate(employee.createdAt)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-blue-600">Employee ID</p>
                                <p className="text-xs text-blue-500 font-mono">{employee.id.slice(-8)}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Summary Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-green-700">{formatCurrency(totalEarned)}</div>
                              <div className="text-green-600 text-sm">💰 Total Salary Earned</div>
                              <div className="text-green-500 text-xs">{empSalaries.length} entries</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-orange-50 border-orange-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-orange-700">{formatCurrency(totalCredits)}</div>
                              <div className="text-orange-600 text-sm">🛒 Total Credits Taken</div>
                              <div className="text-orange-500 text-xs">{empCredits.length} purchases</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalPaid)}</div>
                              <div className="text-blue-600 text-sm">💳 Total Paid Out</div>
                              <div className="text-blue-500 text-xs">{empPayments.length} payments</div>
                            </CardContent>
                          </Card>
                          <Card className={`${currentBalance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <CardContent className="p-4 text-center">
                              <div className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(Math.abs(currentBalance))}
                              </div>
                              <div className={`text-sm ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                💼 {currentBalance >= 0 ? 'Amount Due' : 'Overpaid'}
                              </div>
                              <div className={`text-xs ${currentBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                Current balance
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Milk Production Stats */}
                        <Card className="bg-purple-50 border-purple-200">
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-purple-900 mb-2">🥛 Milk Production Summary</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-700">{totalMilk.toFixed(1)} L</div>
                                <div className="text-purple-600 text-sm">Total Collected</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-700">{formatCurrency(avgRate)}</div>
                                <div className="text-purple-600 text-sm">Avg Rate/Liter</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-700">
                                  {empSalaries.filter(s => s.animalType === 'cow').length}
                                </div>
                                <div className="text-purple-600 text-sm">🐄 Cow Entries</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-700">
                                  {empSalaries.filter(s => s.animalType === 'buffalo').length}
                                </div>
                                <div className="text-purple-600 text-sm">🐃 Buffalo Entries</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Recent Activity */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">📊 Recent Activity Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <h4 className="font-medium text-green-800">💰 Last Salary Entry</h4>
                                {lastSalaryEntry ? (
                                  <div className="mt-2 text-sm">
                                    <p className="text-green-700">📅 {formatDisplayDate(lastSalaryEntry.date)}</p>
                                    <p className="text-green-600">💵 {formatCurrency(lastSalaryEntry.amount)}</p>
                                    <p className="text-green-600">🥛 {lastSalaryEntry.liters} L ({lastSalaryEntry.animalType})</p>
                                  </div>
                                ) : (
                                  <p className="text-green-600 text-sm mt-2">No salary entries</p>
                                )}
                              </div>
                              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <h4 className="font-medium text-orange-800">🛒 Last Credit Purchase</h4>
                                {lastCreditEntry ? (
                                  <div className="mt-2 text-sm">
                                    <p className="text-orange-700">📅 {formatDisplayDate(lastCreditEntry.date)}</p>
                                    <p className="text-orange-600">💵 {formatCurrency(lastCreditEntry.amount)}</p>
                                    <p className="text-orange-600">📦 {lastCreditEntry.itemName}</p>
                                  </div>
                                ) : (
                                  <p className="text-orange-600 text-sm mt-2">No credit purchases</p>
                                )}
                              </div>
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="font-medium text-blue-800">💳 Last Payment</h4>
                                {lastPayment ? (
                                  <div className="mt-2 text-sm">
                                    <p className="text-blue-700">📅 {formatDisplayDate(lastPayment.paymentDate)}</p>
                                    <p className="text-blue-600">💵 {formatCurrency(lastPayment.netPaid)} paid</p>
                                    <p className="text-blue-600">💰 {formatCurrency(lastPayment.salaryAmount)} salary</p>
                                    <p className="text-blue-600">🛒 {formatCurrency(lastPayment.creditDeducted)} credit</p>
                                  </div>
                                ) : (
                                  <p className="text-blue-600 text-sm mt-2">No payments made</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()
                ) : (
                  // All employees overview
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                      <h2 className="text-xl font-bold text-indigo-900 mb-2">🏢 Complete Business Overview</h2>
                      <p className="text-indigo-700">Select a specific employee above to see detailed lifetime records</p>
                    </div>
                    
                    {/* Quick employee cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(employees || []).map((employee) => {
                        if (!employee?.id) return null;
                        
                        const empSalaries = (salaryEntries || []).filter(s => s?.employeeId === employee.id);
                        const empCredits = (creditEntries || []).filter(c => c?.employeeId === employee.id);
                        const totalEarned = safeCalculate(empSalaries, 'amount', 0);
                        const totalCredits = safeCalculate(empCredits, 'amount', 0);
                        const totalMilk = safeCalculate(empSalaries, 'liters', 0);
                        
                        return (
                          <Card key={employee.id} className="hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => setSelectedEmployeeId(employee.id)}>
                            <CardContent className="p-4">
                              <div className="text-center">
                                <h3 className="font-bold text-lg">{employee.name || 'N/A'}</h3>
                                <p className="text-sm text-muted-foreground mb-3">📱 {employee.mobile || 'N/A'}</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="bg-green-50 p-2 rounded">
                                    <div className="font-medium text-green-700">{formatCurrency(totalEarned)}</div>
                                    <div className="text-green-600">Earned</div>
                                  </div>
                                  <div className="bg-orange-50 p-2 rounded">
                                    <div className="font-medium text-orange-700">{formatCurrency(totalCredits)}</div>
                                    <div className="text-orange-600">Credits</div>
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  🥛 {totalMilk.toFixed(1)} L milk • {empSalaries.length} entries
                                </div>
                                <Button variant="outline" size="sm" className="mt-2 w-full">
                                  View Details →
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="salary" className="mt-4">
              <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-green-800">💰 Salary Records Summary</h3>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {filteredData.salaryEntries.length} Total Entries
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-white p-2 rounded border border-green-200">
                    <div className="font-medium text-green-700">💵 Total Amount</div>
                    <div className="text-green-600">{formatCurrency(safeCalculate(filteredData.salaryEntries, 'amount', 0))}</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-green-200">
                    <div className="font-medium text-green-700">🥛 Total Liters</div>
                    <div className="text-green-600">{safeCalculate(filteredData.salaryEntries, 'liters', 0).toFixed(1)} L</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-green-200">
                    <div className="font-medium text-green-700">🐄 Cow Entries</div>
                    <div className="text-green-600">{(filteredData.salaryEntries || []).filter(e => e?.animalType === 'cow').length}</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-green-200">
                    <div className="font-medium text-green-700">🐃 Buffalo Entries</div>
                    <div className="text-green-600">{(filteredData.salaryEntries || []).filter(e => e?.animalType === 'buffalo').length}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold min-w-[150px]">👨‍🌾 Employee Details</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">📅 Entry Date</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">💰 Amount Earned</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">🥛 Milk Quantity</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">🐄 Animal Type</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">📊 Rate per Liter</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">⏰ Entry Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.salaryEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                          <div className="flex flex-col items-center space-y-2">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-lg">No salary records found</p>
                            <p className="text-sm">Try adjusting your filter criteria above</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.salaryEntries.map((entry, index) => (
                        <TableRow key={entry.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{getEmployeeName(entry.employeeId).split(' (')[0]}</span>
                              <span className="text-xs text-muted-foreground">📱 {getEmployeeName(entry.employeeId).split(' (')[1]?.replace(')', '') || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{formatDisplayDate(entry.date)}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">{formatCurrency(entry.amount)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{entry.liters.toFixed(1)} L</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={entry.animalType === 'cow' ? 'default' : 'secondary'} className="font-medium">
                              {entry.animalType === 'cow' ? '🐄 Cow' : '🐃 Buffalo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-blue-600">
                              {entry.liters > 0 ? formatCurrency(entry.amount / entry.liters) : formatCurrency(0)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDisplayDate(entry.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="credit" className="mt-4">
              <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-orange-800">🛒 Credit Purchase Records</h3>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    {filteredData.creditEntries.length} Total Purchases
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-white p-2 rounded border border-orange-200">
                    <div className="font-medium text-orange-700">💵 Total Credit Amount</div>
                    <div className="text-orange-600">{formatCurrency(safeCalculate(filteredData.creditEntries, 'amount', 0))}</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-orange-200">
                    <div className="font-medium text-orange-700">📦 Unique Items</div>
                    <div className="text-orange-600">{new Set((filteredData.creditEntries || []).map(e => e?.itemName).filter(Boolean)).size} Items</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-orange-200">
                    <div className="font-medium text-orange-700">📊 Avg Purchase</div>
                    <div className="text-orange-600">
                      {(filteredData.creditEntries || []).length > 0 
                        ? formatCurrency(safeCalculate(filteredData.creditEntries, 'amount', 0) / filteredData.creditEntries.length)
                        : formatCurrency(0)
                      }
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold min-w-[150px]">👨‍🌾 Employee Details</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">📅 Purchase Date</TableHead>
                      <TableHead className="font-semibold min-w-[140px]">📦 Item Purchased</TableHead>
                      <TableHead className="font-semibold min-w-[100px]">💰 Amount</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">⏰ Entry Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.creditEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                          <div className="flex flex-col items-center space-y-2">
                            <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-lg">No credit purchases found</p>
                            <p className="text-sm">Try adjusting your filter criteria above</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.creditEntries.map((entry, index) => (
                        <TableRow key={entry.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{getEmployeeName(entry.employeeId).split(' (')[0]}</span>
                              <span className="text-xs text-muted-foreground">📱 {getEmployeeName(entry.employeeId).split(' (')[1]?.replace(')', '') || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{formatDisplayDate(entry.date)}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="font-medium">
                                📦 {entry.itemName}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-orange-600">{formatCurrency(entry.amount)}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDisplayDate(entry.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-blue-800">💳 Payment History Records</h3>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {filteredData.paymentRecords.length} Total Payments
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <div className="font-medium text-blue-700">💵 Total Net Paid</div>
                    <div className="text-blue-600">{formatCurrency(safeCalculate(filteredData.paymentRecords, 'netPaid', 0))}</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <div className="font-medium text-blue-700">💰 Total Salary Amount</div>
                    <div className="text-blue-600">{formatCurrency(safeCalculate(filteredData.paymentRecords, 'salaryAmount', 0))}</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <div className="font-medium text-blue-700">🛒 Total Credit Deducted</div>
                    <div className="text-blue-600">{formatCurrency(safeCalculate(filteredData.paymentRecords, 'creditDeducted', 0))}</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-200">
                    <div className="font-medium text-blue-700">📊 Avg Payment</div>
                    <div className="text-blue-600">
                      {(filteredData.paymentRecords || []).length > 0 
                        ? formatCurrency(safeCalculate(filteredData.paymentRecords, 'netPaid', 0) / filteredData.paymentRecords.length)
                        : formatCurrency(0)
                      }
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold min-w-[150px]">👨‍🌾 Employee Details</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">📅 Payment Date</TableHead>
                      <TableHead className="font-semibold min-w-[130px]">💰 Salary Amount</TableHead>
                      <TableHead className="font-semibold min-w-[130px]">🛒 Credit Deducted</TableHead>
                      <TableHead className="font-semibold min-w-[140px]">💵 Net Amount Paid</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">⏰ Payment Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.paymentRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          <div className="flex flex-col items-center space-y-2">
                            <DollarSign className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-lg">No payment records found</p>
                            <p className="text-sm">Try adjusting your filter criteria above</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.paymentRecords.map((record, index) => (
                        <TableRow key={record.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{getEmployeeName(record.employeeId).split(' (')[0]}</span>
                              <span className="text-xs text-muted-foreground">📱 {getEmployeeName(record.employeeId).split(' (')[1]?.replace(')', '') || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{formatDisplayDate(record.paymentDate)}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(record.paymentDate).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-green-600">{formatCurrency(record.salaryAmount)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-orange-600">-{formatCurrency(record.creditDeducted)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-blue-600 text-lg">{formatCurrency(record.netPaid)}</span>
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                💵 Paid
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDisplayDate(record.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="employees" className="mt-4">
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-purple-800">👥 Employee Database & Performance</h3>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {filteredData.employees.length} Total Employees
                  </Badge>
                </div>
                <p className="text-sm text-purple-700">Complete employee profiles with lifetime performance metrics and financial summaries</p>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold min-w-[180px]">👨‍🌾 Employee Profile</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">📅 Joining Date</TableHead>
                      <TableHead className="font-semibold min-w-[140px]">💰 Total Salary Earned</TableHead>
                      <TableHead className="font-semibold min-w-[140px]">🛒 Total Credits Taken</TableHead>
                      <TableHead className="font-semibold min-w-[150px]">💵 Total Payments Received</TableHead>
                      <TableHead className="font-semibold min-w-[130px]">🥛 Milk Performance</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">💼 Current Balance</TableHead>
                      <TableHead className="font-semibold min-w-[120px]">📊 Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                          <div className="flex flex-col items-center space-y-2">
                            <Users className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-lg">No employees found</p>
                            <p className="text-sm">Try adjusting your filter criteria above</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (filteredData.employees || []).map((employee, index) => {
                        if (!employee?.id) return null;
                        
                        const employeeSalaries = (salaryEntries || []).filter(s => s?.employeeId === employee.id);
                        const employeeCredits = (creditEntries || []).filter(c => c?.employeeId === employee.id);
                        const employeePayments = (paymentRecords || []).filter(p => p?.employeeId === employee.id);
                        const totalSalary = safeCalculate(employeeSalaries, 'amount', 0);
                        const totalCredits = safeCalculate(employeeCredits, 'amount', 0);
                        const totalPaid = safeCalculate(employeePayments, 'netPaid', 0);
                        const totalMilk = safeCalculate(employeeSalaries, 'liters', 0);
                        const avgRate = totalMilk > 0 ? Number((totalSalary / totalMilk).toFixed(2)) : 0;
                        
                        // Calculate current balance (salary earned - credits taken - salary amount from payments)
                        const salaryAmountPaid = safeCalculate(employeePayments, 'salaryAmount', 0);
                        const currentBalance = Number((totalSalary - totalCredits - salaryAmountPaid).toFixed(2));
                        
                        const lastPayment = (employeePayments || []).sort((a, b) => 
                          new Date(b?.paymentDate || 0).getTime() - new Date(a?.paymentDate || 0).getTime()
                        )[0] || null;
                        
                        const lastSalary = (employeeSalaries || []).sort((a, b) => 
                          new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
                        )[0] || null;
                        
                        const lastCredit = (employeeCredits || []).sort((a, b) => 
                          new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
                        )[0] || null;
                        
                        // Determine last activity
                        const activities = [
                          { type: 'salary', date: lastSalary?.date, icon: '💰' },
                          { type: 'credit', date: lastCredit?.date, icon: '🛒' },
                          { type: 'payment', date: lastPayment?.paymentDate, icon: '💵' }
                        ].filter(a => a.date).sort((a, b) => 
                          new Date(b.date!).getTime() - new Date(a.date!).getTime()
                        );
                        
                        const lastActivity = activities[0];
                        
                        return (
                          <TableRow key={employee.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-lg text-foreground">{employee.name}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setSelectedEmployeeId(employee.id)}
                                    className="h-6 px-2 text-xs"
                                  >
                                    View Details →
                                  </Button>
                                </div>
                                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                  <span>📱 {employee.mobile}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {employee.id.slice(-8)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{formatDisplayDate(employee.createdAt)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.floor((new Date().getTime() - new Date(employee.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days ago
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-green-600 text-lg">{formatCurrency(totalSalary)}</span>
                                <span className="text-xs text-muted-foreground">{employeeSalaries.length} entries</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-orange-600 text-lg">{formatCurrency(totalCredits)}</span>
                                <span className="text-xs text-muted-foreground">{employeeCredits.length} purchases</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-blue-600 text-lg">{formatCurrency(totalPaid)}</span>
                                <span className="text-xs text-muted-foreground">{employeePayments.length} payments</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-1">
                                  <span className="font-medium">🥛 {totalMilk.toFixed(1)} L</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Avg: {formatCurrency(avgRate)}/L
                                </div>
                                <div className="flex space-x-1 text-xs">
                                  <Badge variant="outline" className="px-1 py-0 text-xs">
                                    🐄 {employeeSalaries.filter(s => s.animalType === 'cow').length}
                                  </Badge>
                                  <Badge variant="outline" className="px-1 py-0 text-xs">
                                    🐃 {employeeSalaries.filter(s => s.animalType === 'buffalo').length}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={`font-bold text-lg ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {currentBalance >= 0 ? '+' : ''}{formatCurrency(currentBalance)}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${currentBalance >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                                >
                                  {currentBalance >= 0 ? '💼 Amount Due' : '⚠️ Overpaid'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {lastActivity ? (
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center space-x-1">
                                    <span>{lastActivity.icon}</span>
                                    <span className="text-xs capitalize">{lastActivity.type}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDisplayDate(lastActivity.date!)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {Math.floor((new Date().getTime() - new Date(lastActivity.date!).getTime()) / (1000 * 60 * 60 * 24))} days ago
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No activity</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
};

export default Summary;