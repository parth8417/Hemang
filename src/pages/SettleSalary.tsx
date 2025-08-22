import { useMemo, useState } from "react";
import { CheckCircle, CreditCard, DollarSign, ShoppingCart, Calendar, AlertTriangle, Users, TrendingUp, FileText, Eye, X, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useEmployees, useSalaryEntries, useCreditEntries, usePaymentRecords } from "@/hooks/useSupabaseData";
import { PaymentSummary, CreditEntry } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDisplayDate } from "@/utils/dateUtils";

const SettleSalary = () => {
  const { employees } = useEmployees();
  const { salaryEntries, removeSalaryEntry } = useSalaryEntries();
  const { creditEntries, updateCreditEntries } = useCreditEntries();
  const { paymentRecords, addPaymentRecord } = usePaymentRecords();
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, string>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<PaymentSummary | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSettling, setIsSettling] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const paymentSummary: PaymentSummary[] = useMemo(() => {
    return employees.map(employee => {
      // Calculate total salary from all entries for this employee
      const employeeSalaryEntries = salaryEntries.filter(entry => entry.employeeId === employee.id);
      const totalSalary = employeeSalaryEntries.reduce((total, entry) => total + entry.amount, 0);

      // Get last payment date
      const lastPaymentRecord = paymentRecords
        .filter(record => record.employeeId === employee.id)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];

      const lastPaymentDate = lastPaymentRecord ? new Date(lastPaymentRecord.paymentDate) : new Date(0);

      // Get ALL credit entries for this employee (total available credit)
      const allCreditEntries = creditEntries
        .filter(entry => entry.employeeId === employee.id);
      
      const totalAvailableCredit = allCreditEntries
        .reduce((total, entry) => total + entry.amount, 0);
      
      // Also calculate credit since last payment for reference
      const creditEntriesSinceLastPayment = creditEntries
        .filter(entry => 
          entry.employeeId === employee.id && 
          new Date(entry.date) > lastPaymentDate
        );
      
      const totalCreditSinceLastPayment = creditEntriesSinceLastPayment
        .reduce((total, entry) => total + entry.amount, 0);
      
      console.log(`Credit calculation for ${employee.name}:`, {
        employeeId: employee.id,
        lastPaymentDate: lastPaymentDate.toISOString(),
        totalCreditEntries: allCreditEntries.length,
        totalAvailableCredit,
        creditSinceLastPayment: totalCreditSinceLastPayment,
        allCreditAmounts: allCreditEntries.map(e => ({ date: e.date, amount: e.amount }))
      });

      const manualCredit = parseFloat(manualAdjustments[employee.id] || "0") || 0;
      const netPayable = totalSalary - manualCredit;

      // Additional calculations for enhanced features
      const salaryEntryCount = employeeSalaryEntries.length;
      const avgSalaryPerEntry = salaryEntryCount > 0 ? totalSalary / salaryEntryCount : 0;
      const hasRecentActivity = employeeSalaryEntries.some(entry => {
        const entryDate = new Date(entry.date);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return entryDate >= weekAgo;
      });

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        lastSalary: totalSalary, // Using total salary instead of last salary
        totalCreditSinceLastPayment: totalAvailableCredit, // Show total available credit
        netPayable,
        salaryEntryCount,
        avgSalaryPerEntry,
        hasRecentActivity,
        lastPaymentDate: lastPaymentRecord?.paymentDate || null,
      };
    });
  }, [employees, salaryEntries, creditEntries, paymentRecords, manualAdjustments]);

  const statistics = useMemo(() => {
    const totalEmployees = employees.length;
    const employeesWithSalary = paymentSummary.filter(s => s.lastSalary > 0).length;
    const employeesWithCredit = paymentSummary.filter(s => s.totalCreditSinceLastPayment > 0).length;
    const totalPayableAmount = paymentSummary.reduce((sum, summary) => sum + Math.max(0, summary.netPayable), 0);
    const averageNetPayable = totalEmployees > 0 ? totalPayableAmount / totalEmployees : 0;
    const employeesWithRecentActivity = paymentSummary.filter(s => s.hasRecentActivity).length;
    
    return {
      totalEmployees,
      employeesWithSalary,
      employeesWithCredit,
      averageNetPayable,
      employeesWithRecentActivity,
      totalPayableAmount,
    };
  }, [employees.length, paymentSummary]);

  const handlePreviewSettlement = (summary: PaymentSummary) => {
    setSelectedEmployee(summary);
    setIsPreviewOpen(true);
  };

  const validateSettlement = (employeeId: string, manualCredit: number, availableCredit: number) => {
    if (manualCredit < 0) {
      return "Manual credit cannot be negative";
    }
    if (manualCredit > availableCredit) {
      return "Manual credit adjustment cannot exceed total available credit";
    }
    return null;
  };

  const handleSettleSalary = async (employeeId: string, employeeName: string) => {
    const summary = paymentSummary.find(s => s.employeeId === employeeId);
    if (!summary) return;

    const manualCredit = parseFloat(manualAdjustments[employeeId] || "0") || 0;
    
    // Validation
    const validationError = validateSettlement(employeeId, manualCredit, summary.totalCreditSinceLastPayment);
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (summary.lastSalary <= 0) {
      toast({
        title: "Error",
        description: "Cannot settle salary - no salary entries found for this employee",
        variant: "destructive",
      });
      return;
    }

    setIsSettling(prev => ({ ...prev, [employeeId]: true }));
    
    console.log("Settlement Debug:", {
      employeeId,
      employeeName,
      totalCredit: summary.totalCreditSinceLastPayment,
      manualCredit,
      creditEntriesBeforeSettlement: creditEntries.filter(e => e.employeeId === employeeId).length
    });

    try {
      // Create payment record
      await addPaymentRecord({
        employeeId,
        salaryAmount: summary.lastSalary,
        creditDeducted: manualCredit,
        netPaid: summary.netPayable,
        paymentDate: new Date().toISOString().split('T')[0],
      });

      // Remove only the adjusted amount of credit entries (oldest first)  
      let remainingCreditToRemove = manualCredit;
      const updatedCreditEntries: CreditEntry[] = [];
      
      // Get last payment date for this employee
      const lastPaymentRecord = paymentRecords
        .filter(record => record.employeeId === employeeId)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
      const lastPaymentDate = lastPaymentRecord ? new Date(lastPaymentRecord.paymentDate) : new Date(0);
      
      // Separate employee credit entries from others
      const otherEmployeesEntries = creditEntries.filter(entry => entry.employeeId !== employeeId);
      const thisEmployeeEntries = creditEntries
        .filter(entry => entry.employeeId === employeeId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest first
      
      console.log("Processing credit entries for settlement:", {
        totalCreditEntries: creditEntries.length,
        employeeCreditEntries: thisEmployeeEntries.length,
        lastPaymentDate: lastPaymentDate.toISOString(),
        remainingCreditToRemove,
        manualCredit
      });
      
      // Add all other employees' entries unchanged
      updatedCreditEntries.push(...otherEmployeesEntries);
      
      // Process this employee's entries - remove from ALL credit entries, not just new ones
      for (const entry of thisEmployeeEntries) {
        console.log("Processing entry:", {
          entryId: entry.id,
          entryDate: entry.date,
          entryAmount: entry.amount,
          remainingToRemove: remainingCreditToRemove
        });
        
        if (remainingCreditToRemove > 0) {
          if (entry.amount <= remainingCreditToRemove) {
            remainingCreditToRemove -= entry.amount;
            console.log("Removing entire entry:", entry.id);
            // Skip this entry (remove it completely)
          } else {
            // Partial removal - keep the remaining amount
            const updatedEntry = { ...entry, amount: entry.amount - remainingCreditToRemove };
            console.log("Partially removing from entry:", {
              originalAmount: entry.amount,
              newAmount: updatedEntry.amount,
              removed: remainingCreditToRemove
            });
            remainingCreditToRemove = 0;
            updatedCreditEntries.push(updatedEntry);
          }
        } else {
          updatedCreditEntries.push(entry);
        }
      }
      
      console.log("Settlement completed:", {
        originalCreditEntries: creditEntries.filter(e => e.employeeId === employeeId).length,
        updatedCreditEntries: updatedCreditEntries.filter(e => e.employeeId === employeeId).length,
        creditRemoved: manualCredit - remainingCreditToRemove
      });

      // Remove ALL salary entries for this employee since we're settling the total
      const employeeSalaryEntries = salaryEntries.filter(entry => entry.employeeId === employeeId);
      
      for (const salaryEntry of employeeSalaryEntries) {
        await removeSalaryEntry(salaryEntry.id);
      }

      await updateCreditEntries(updatedCreditEntries);
      setManualAdjustments(prev => ({ ...prev, [employeeId]: "" }));

      toast({
        title: "Salary Settled Successfully",
        description: `Payment of ${formatCurrency(summary.netPayable)} completed for ${employeeName}`,
      });
    } catch (error) {
      console.error("Settlement error:", error);
      toast({
        title: "Settlement Failed",
        description: "An error occurred while settling the salary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSettling(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  const totalPayable = paymentSummary.reduce((sum, summary) => sum + Math.max(0, summary.netPayable), 0);
  const employeesWithPayment = paymentSummary.filter(summary => summary.netPayable > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settle Salary</h1>
          <p className="text-muted-foreground">Process employee salary settlements with intelligent credit management</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Payable</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(statistics.totalPayableAmount)}</p>
          {employeesWithPayment.length > 0 && (
            <p className="text-xs text-muted-foreground">{employeesWithPayment.length} employees ready</p>
          )}
        </div>
      </div>

      {employees.length === 0 && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            Please add employees first before processing salary settlements.
            <Button variant="link" className="p-0 h-auto ml-2" onClick={() => window.location.href = "/"}>
              Go to Employee Management →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {employees.length > 0 && (
        <div className="space-y-6">
          {/* Enhanced Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Salaries</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(paymentSummary.reduce((sum, s) => sum + s.lastSalary, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">{statistics.employeesWithSalary} employees</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Available Credit</p>
                    <p className="text-2xl font-bold text-destructive">
                      {formatCurrency(paymentSummary.reduce((sum, s) => sum + s.totalCreditSinceLastPayment, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">{statistics.employeesWithCredit} with credit</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Banknote className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Net Payable</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(statistics.totalPayableAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">After credits</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Average Payable</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(statistics.averageNetPayable)}
                    </p>
                    <p className="text-xs text-muted-foreground">Per employee</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Payment Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Employee Settlement Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentSummary.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No employees found</p>
                  <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/"}>
                    Add Employees
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Salary Details</TableHead>
                        <TableHead>Credit Info</TableHead>
                        <TableHead>Manual Credit</TableHead>
                        <TableHead>Net Payable</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentSummary.map((summary) => (
                        <TableRow key={summary.employeeId} className={`${summary.hasRecentActivity ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{summary.employeeName}</p>
                              <div className="flex items-center space-x-2">
                                {summary.hasRecentActivity && (
                                  <Badge variant="outline" className="text-xs">Recent Activity</Badge>
                                )}
                                {summary.lastPaymentDate && (
                                  <span className="text-xs text-muted-foreground">
                                    Last paid: {formatDisplayDate(summary.lastPaymentDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <span className="text-primary font-bold block">
                                {formatCurrency(summary.lastSalary)}
                              </span>
                              <div className="text-xs text-muted-foreground">
                                {summary.salaryEntryCount} entries
                                {summary.salaryEntryCount > 0 && (
                                  <span className="ml-1">
                                    (avg: {formatCurrency(summary.avgSalaryPerEntry)})
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <span className="text-muted-foreground font-medium block">
                                {formatCurrency(summary.totalCreditSinceLastPayment)}
                              </span>
                              {manualAdjustments[summary.employeeId] && (
                                <div className="text-xs text-primary">
                                  Adjusting: -{formatCurrency(parseFloat(manualAdjustments[summary.employeeId]) || 0)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Input
                                type="number"
                                placeholder="0"
                                value={manualAdjustments[summary.employeeId] || ""}
                                onChange={(e) => setManualAdjustments(prev => ({
                                  ...prev,
                                  [summary.employeeId]: e.target.value
                                }))}
                                max={summary.totalCreditSinceLastPayment}
                                min="0"
                                className="w-24"
                                step="0.01"
                              />
                              <div className="text-xs text-muted-foreground">
                                Max: {formatCurrency(summary.totalCreditSinceLastPayment)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <span className={`text-lg font-bold block ${
                                summary.netPayable > 0 ? 'text-green-600 dark:text-green-400' : 
                                summary.netPayable < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                              }`}>
                                {formatCurrency(summary.netPayable)}
                              </span>
                              {summary.netPayable < 0 && (
                                <div className="text-xs text-destructive">
                                  Overpaid by {formatCurrency(Math.abs(summary.netPayable))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {summary.lastSalary > 0 ? (
                                <Badge variant={summary.netPayable > 0 ? "default" : summary.netPayable < 0 ? "destructive" : "secondary"}>
                                  {summary.netPayable > 0 ? "Ready to Settle" : summary.netPayable < 0 ? "Overpaid" : "Balanced"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">No Salary</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {summary.lastSalary > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreviewSettlement(summary)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {summary.lastSalary > 0 ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleSettleSalary(summary.employeeId, summary.employeeName)}
                                  disabled={isSettling[summary.employeeId]}
                                  className="flex items-center space-x-2"
                                >
                                  {isSettling[summary.employeeId] ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      <span>Settling...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4" />
                                      <span>Settle</span>
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" disabled>
                                  No Salary
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settlement Preview Dialog */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Settlement Preview</span>
                </DialogTitle>
              </DialogHeader>
              {selectedEmployee && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3">Employee Details</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{selectedEmployee.employeeName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Salary Entries:</span>
                          <span>{selectedEmployee.salaryEntryCount} entries</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Average per Entry:</span>
                          <span>{formatCurrency(selectedEmployee.avgSalaryPerEntry || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreround">Last Payment:</span>
                          <span>{selectedEmployee.lastPaymentDate ? formatDisplayDate(selectedEmployee.lastPaymentDate) : 'Never'}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">Settlement Calculation</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Salary:</span>
                          <span className="font-medium text-primary">{formatCurrency(selectedEmployee.lastSalary)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Available Credit:</span>
                          <span className="font-medium text-destructive">{formatCurrency(selectedEmployee.totalCreditSinceLastPayment)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Manual Credit:</span>
                          <span className="font-medium">
                            {formatCurrency(parseFloat(manualAdjustments[selectedEmployee.employeeId] || "0") || 0)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg">
                          <span className="font-semibold">Net Payable:</span>
                          <span className={`font-bold ${selectedEmployee.netPayable > 0 ? 'text-green-600' : selectedEmployee.netPayable < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {formatCurrency(selectedEmployee.netPayable)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Employee's Salary Entry Details */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Complete Lifetime Records
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Liters</TableHead>
                            <TableHead>Animal Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salaryEntries
                            .filter(entry => entry.employeeId === selectedEmployee.employeeId)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell>{formatDisplayDate(entry.date)}</TableCell>
                                <TableCell>{formatCurrency(entry.amount)}</TableCell>
                                <TableCell>{entry.liters}L</TableCell>
                                <TableCell>
                                  <Badge variant={entry.animalType === 'cow' ? 'default' : 'secondary'} className="text-xs">
                                    {entry.animalType === 'cow' ? '🐄' : '🐃'} {entry.animalType}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          }
                          {salaryEntries.filter(entry => entry.employeeId === selectedEmployee.employeeId).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No salary entries found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <Separator />
                  
                  {/* Payment History */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Payment History
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg max-h-[150px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Salary Amount</TableHead>
                            <TableHead>Credit Deducted</TableHead>
                            <TableHead>Net Paid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentRecords
                            .filter(record => record.employeeId === selectedEmployee.employeeId)
                            .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                            .map((record) => (
                              <TableRow key={record.id}>
                                <TableCell>{formatDisplayDate(record.paymentDate)}</TableCell>
                                <TableCell>{formatCurrency(record.salaryAmount)}</TableCell>
                                <TableCell>{formatCurrency(record.creditDeducted)}</TableCell>
                                <TableCell className="font-medium">{formatCurrency(record.netPaid)}</TableCell>
                              </TableRow>
                            ))
                          }
                          {paymentRecords.filter(record => record.employeeId === selectedEmployee.employeeId).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No previous payments found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold">Settlement Impact</h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <p className="text-sm">
                        <strong>Actions that will be performed:</strong>
                      </p>
                      <ul className="text-sm space-y-1 ml-4">
                        <li>• Remove all {selectedEmployee.salaryEntryCount} salary entries for this employee</li>
                        <li>• Deduct {formatCurrency(parseFloat(manualAdjustments[selectedEmployee.employeeId] || "0") || 0)} from credit entries</li>
                        <li>• Create payment record for {formatCurrency(selectedEmployee.netPayable)}</li>
                        <li>• Update payment history</li>
                      </ul>
                      {selectedEmployee.netPayable < 0 && (
                        <Alert className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            This employee has a negative balance (overpaid). Consider adjusting the credit amount.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                {selectedEmployee && selectedEmployee.lastSalary > 0 && (
                  <Button 
                    onClick={() => {
                      setIsPreviewOpen(false);
                      handleSettleSalary(selectedEmployee.employeeId, selectedEmployee.employeeName);
                    }}
                    disabled={isSettling[selectedEmployee.employeeId]}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Settlement
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default SettleSalary;
