import { useState, useMemo } from "react";
import { Plus, DollarSign, Calendar, Filter, Users, TrendingUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployees, useSalaryEntries } from "@/hooks/useSupabaseData";
import { SalaryEntry } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDisplayDate, formatCurrency } from "@/utils/dateUtils";

const Salary10Day = () => {
  const { employees } = useEmployees();
  const { salaryEntries, addSalaryEntry, loading } = useSalaryEntries();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("by-period");
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [showDetails, setShowDetails] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    employeeId: "",
    amount: "",
    liters: "",
    animalType: "cow" as 'cow' | 'buffalo',
    dateRange: "1-10" as '1-10' | '10-20' | '20-30',
  });
  const { toast } = useToast();

  // Date range helpers
  const getDateRangeEntries = (range: string) => {
    const now = new Date();
    const today = now.getDate();
    let startDate, endDate;

    switch (range) {
      case "1-10":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 10);
        break;
      case "10-20":
        startDate = new Date(now.getFullYear(), now.getMonth(), 11);
        endDate = new Date(now.getFullYear(), now.getMonth(), 20);
        break;
      case "20-30":
        startDate = new Date(now.getFullYear(), now.getMonth(), 21);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
        break;
      default:
        return salaryEntries;
    }

    return salaryEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startDate && entryDate <= endDate;
    });
  };

  const toggleDetails = (employeeId: string) => {
    setShowDetails(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started with data:', formData);
    
    if (!formData.employeeId || !formData.amount || !formData.liters) {
      console.log('Validation failed - missing fields:', {
        employeeId: !!formData.employeeId,
        amount: !!formData.amount,
        liters: !!formData.liters
      });
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    const liters = parseFloat(formData.liters);
    
    console.log('Parsed values:', { amount, liters, isAmountNaN: isNaN(amount), isLitersNaN: isNaN(liters) });
    
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(liters) || liters <= 0) {
      console.log('Liters validation failed:', { liters, isNaN: isNaN(liters), isLessOrEqualZero: liters <= 0 });
      toast({
        title: "Error",
        description: "Please enter valid liters",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Form data before submission:', {
        employeeId: formData.employeeId,
        date: formatDate(new Date()),
        amount: amount,
        liters: liters,
        animalType: formData.animalType,
      });

      await addSalaryEntry({
        employeeId: formData.employeeId,
        date: formatDate(new Date()),
        amount: amount,
        liters: liters,
        animalType: formData.animalType,
      });

      toast({
        title: "Success",
        description: "Salary entry added successfully",
      });

      setFormData({
        employeeId: "",
        amount: "",
        liters: "",
        animalType: "cow",
        dateRange: "1-10",
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error adding salary entry:', error);
      toast({
        title: "Error",
        description: "Failed to add salary entry",
        variant: "destructive",
      });
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : "Unknown Employee";
  };

  const getEmployeeLastSalary = (employeeId: string) => {
    const employeeEntries = salaryEntries.filter(entry => entry.employeeId === employeeId);
    return employeeEntries.reduce((total, entry) => total + entry.amount, 0);
  };

  // Updated salary summary with date range filtering
  const employeeSalarySummary = useMemo(() => {
    const filteredEntries = selectedDateRange === "all" 
      ? salaryEntries 
      : getDateRangeEntries(selectedDateRange);

    return employees.map(employee => {
      const employeeEntries = filteredEntries.filter(entry => entry.employeeId === employee.id);
      const totalSalary = employeeEntries.reduce((total, entry) => total + entry.amount, 0);
      const totalLiters = employeeEntries.reduce((total, entry) => total + entry.liters, 0);
      
      return {
        ...employee,
        totalSalary,
        totalLiters,
        entryCount: employeeEntries.length,
        recentEntries: employeeEntries
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5),
        avgDailyAmount: employeeEntries.length > 0 ? totalSalary / employeeEntries.length : 0,
      };
    });
  }, [employees, salaryEntries, selectedDateRange]);

  const filteredEmployeeSummary = selectedEmployee === "all" 
    ? employeeSalarySummary 
    : employeeSalarySummary.filter(emp => emp.id === selectedEmployee);

  const totalStats = useMemo(() => {
    const entries = selectedDateRange === "all" ? salaryEntries : getDateRangeEntries(selectedDateRange);
    return {
      totalAmount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      totalLiters: entries.reduce((sum, entry) => sum + entry.liters, 0),
      totalEntries: entries.length,
      avgPerEntry: entries.length > 0 ? entries.reduce((sum, entry) => sum + entry.amount, 0) / entries.length : 0,
    };
  }, [salaryEntries, selectedDateRange]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Salary Management</h1>
          <p className="text-muted-foreground">Comprehensive salary tracking with date range analysis</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2" size="lg">
              <Plus className="h-4 w-4" />
              <span>New Salary Entry</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Salary Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee</Label>
                  <Select value={formData.employeeId} onValueChange={(value) => setFormData({ ...formData, employeeId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dateRange">Date Period</Label>
                  <Select value={formData.dateRange} onValueChange={(value: '1-10' | '10-20' | '20-30') => setFormData({ ...formData, dateRange: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 Days of Month</SelectItem>
                      <SelectItem value="10-20">10-20 Days of Month</SelectItem>
                      <SelectItem value="20-30">20-30 Days of Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="Enter amount"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="liters">Liters</Label>
                    <Input
                      id="liters"
                      type="number"
                      value={formData.liters}
                      onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                      placeholder="Enter liters"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="animalType">Animal Type</Label>
                  <Select value={formData.animalType} onValueChange={(value: 'cow' | 'buffalo') => setFormData({ ...formData, animalType: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select animal type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cow">🐄 Cow</SelectItem>
                      <SelectItem value="buffalo">🐃 Buffalo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex space-x-2 pt-4">
                <Button type="submit" className="flex-1">
                  Add Entry
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(totalStats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Liters</p>
                <p className="text-2xl font-bold">{totalStats.totalLiters.toFixed(1)}L</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Calendar className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{totalStats.totalEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg per Entry</p>
                <p className="text-2xl font-bold">{formatCurrency(totalStats.avgPerEntry)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {employees.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Employees Found</h3>
            <p className="text-muted-foreground mb-4">Please add employees first before recording salary entries</p>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Go to Employee Management
            </Button>
          </CardContent>
        </Card>
      )}

      {employees.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="by-period">By Period</TabsTrigger>
            <TabsTrigger value="entries">All Entries</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Filter by Employee</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="All employees" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Filter by Period</Label>
                    <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="All periods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        <SelectItem value="1-10">1-10 Days</SelectItem>
                        <SelectItem value="10-20">10-20 Days</SelectItem>
                        <SelectItem value="20-30">20-30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Employee Summary</span>
                  <Badge variant="secondary">{filteredEmployeeSummary.length} employees</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredEmployeeSummary.map((employee) => (
                    <div key={employee.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="font-bold text-primary">{employee.name.charAt(0)}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold">{employee.name}</h3>
                            <p className="text-sm text-muted-foreground">{employee.entryCount} entries</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{formatCurrency(employee.totalSalary)}</p>
                          <p className="text-sm text-muted-foreground">{employee.totalLiters.toFixed(1)}L total</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDetails(employee.id)}
                        >
                          {showDetails.includes(employee.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      {showDetails.includes(employee.id) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">Average per Entry</p>
                              <p className="font-bold">{formatCurrency(employee.avgDailyAmount)}</p>
                            </div>
                            <div className="text-center p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">Total Liters</p>
                              <p className="font-bold">{employee.totalLiters.toFixed(1)}L</p>
                            </div>
                          </div>
                          
                          {employee.recentEntries.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Recent Entries</h4>
                              <div className="space-y-2">
                                {employee.recentEntries.map((entry) => (
                                  <div key={entry.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <div className="flex items-center space-x-3">
                                      <Badge variant="outline" className="text-xs">
                                        {formatDisplayDate(entry.date)}
                                      </Badge>
                                      <span className="text-sm">{entry.liters}L</span>
                                      <Badge variant={entry.animalType === 'cow' ? 'default' : 'secondary'} className="text-xs">
                                        {entry.animalType === 'cow' ? '🐄' : '🐃'} {entry.animalType}
                                      </Badge>
                                    </div>
                                    <span className="font-medium">{formatCurrency(entry.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-period" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['1-10', '10-20', '20-30'].map((period) => {
                const periodEntries = getDateRangeEntries(period);
                const periodTotal = periodEntries.reduce((sum, entry) => sum + entry.amount, 0);
                const periodLiters = periodEntries.reduce((sum, entry) => sum + entry.liters, 0);
                
                return (
                  <Card key={period} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between">
                        <span>Days {period}</span>
                        <Badge variant="secondary">{periodEntries.length} entries</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Amount:</span>
                          <span className="font-bold text-primary">{formatCurrency(periodTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Liters:</span>
                          <span className="font-bold">{periodLiters.toFixed(1)}L</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg per Entry:</span>
                          <span className="font-medium">
                            {periodEntries.length > 0 ? formatCurrency(periodTotal / periodEntries.length) : '₹0'}
                          </span>
                        </div>
                      </div>
                      
                      {periodEntries.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">Recent in this period:</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {periodEntries.slice(0, 3).map((entry) => {
                              const employee = employees.find(emp => emp.id === entry.employeeId);
                              return (
                                <div key={entry.id} className="text-sm flex justify-between">
                                  <span>{employee?.name}</span>
                                  <span className="font-medium">{formatCurrency(entry.amount)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="entries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>All Salary Entries</span>
                  <Badge variant="secondary">{salaryEntries.length} total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salaryEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Entries Yet</h3>
                    <p className="text-muted-foreground">Start by adding your first salary entry</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Liters</TableHead>
                          <TableHead>Animal</TableHead>
                          <TableHead>Rate/L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryEntries
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 50)
                          .map((entry) => {
                            const employee = employees.find(emp => emp.id === entry.employeeId);
                            const entryDate = new Date(entry.date);
                            const day = entryDate.getDate();
                            let period = "1-10";
                            if (day > 10 && day <= 20) period = "10-20";
                            else if (day > 20) period = "20-30";
                            
                            return (
                              <TableRow key={entry.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">
                                  {formatDisplayDate(entry.date)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-bold text-primary">
                                        {employee?.name?.charAt(0) || '?'}
                                      </span>
                                    </div>
                                    <span>{employee?.name || 'Unknown'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {period}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-bold text-primary">
                                  {formatCurrency(entry.amount)}
                                </TableCell>
                                <TableCell>{entry.liters}L</TableCell>
                                <TableCell>
                                  <Badge variant={entry.animalType === 'cow' ? 'default' : 'secondary'} className="text-xs">
                                    {entry.animalType === 'cow' ? '🐄' : '🐃'} {entry.animalType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatCurrency(entry.amount / entry.liters)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Salary10Day;