import { useState, useMemo } from "react";
import { Plus, ShoppingCart, Calendar, Search, Filter, Edit, Trash2, DollarSign, TrendingUp, History, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEmployees, useCreditEntries } from "@/hooks/useSupabaseData";
import { CreditEntry } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDisplayDate, isWithinLast10Days, formatCurrency } from "@/utils/dateUtils";

const CreditPurchase = () => {
  const { employees } = useEmployees();
  const { creditEntries, addCreditEntry, updateCreditEntry, removeCreditEntry } = useCreditEntries();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CreditEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<string>("all");
  const [formData, setFormData] = useState({
    employeeId: "",
    date: formatDate(new Date()),
    itemName: "",
    amount: "",
    notes: "",
  });
  const { toast } = useToast();

  const commonItems = [
    "Ghee", "Oil (Tel)", "Rice", "Wheat", "Sugar", "Milk Powder", 
    "Vegetables", "Fruits", "Tea", "Spices", "Flour", "Soap", 
    "Detergent", "Medicine", "Other"
  ];

  const dateRangeOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "10days", label: "Last 10 Days" },
  ];

  const resetForm = () => {
    setFormData({
      employeeId: "",
      date: formatDate(new Date()),
      itemName: "",
      amount: "",
      notes: "",
    });
    setIsEditMode(false);
    setEditingEntry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employeeId || !formData.date || !formData.itemName || !formData.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Check if date is not in the future
    if (new Date(formData.date) > new Date()) {
      toast({
        title: "Error",
        description: "Date cannot be in the future",
        variant: "destructive",
      });
      return;
    }

    try {
      const entryData = {
        employeeId: formData.employeeId,
        date: formData.date,
        itemName: formData.itemName === "Other" ? formData.notes : formData.itemName,
        amount,
      };

      if (isEditMode && editingEntry) {
        await updateCreditEntry(editingEntry.id, entryData);
        toast({
          title: "Success",
          description: "Credit entry updated successfully",
        });
      } else {
        await addCreditEntry(entryData);
        toast({
          title: "Success",
          description: "Credit purchase entry added successfully",
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: isEditMode ? "Failed to update credit entry" : "Failed to add credit entry",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (entry: CreditEntry) => {
    setEditingEntry(entry);
    setIsEditMode(true);
    setFormData({
      employeeId: entry.employeeId,
      date: entry.date,
      itemName: entry.itemName,
      amount: entry.amount.toString(),
      notes: entry.itemName,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entryId: string, employeeName: string, itemName: string, amount: number) => {
    if (window.confirm(`Are you sure you want to delete ${itemName} (₹${amount}) for ${employeeName}?`)) {
      try {
        await removeCreditEntry(entryId);
        toast({
          title: "Success",
          description: "Credit entry deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete credit entry",
          variant: "destructive",
        });
      }
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : "Unknown Employee";
  };

  const getEmployeeTotalCredit = (employeeId: string) => {
    return creditEntries
      .filter(entry => entry.employeeId === employeeId)
      .reduce((total, entry) => total + entry.amount, 0);
  };

  const getEmployeeRecentCredit = (employeeId: string) => {
    return creditEntries
      .filter(entry => entry.employeeId === employeeId && isWithinLast10Days(entry.date))
      .reduce((total, entry) => total + entry.amount, 0);
  };

  const filterCreditEntries = (entries: CreditEntry[]) => {
    return entries.filter(entry => {
      const employeeName = getEmployeeName(entry.employeeId).toLowerCase();
      const matchesSearch = searchTerm === "" || 
        employeeName.includes(searchTerm.toLowerCase()) ||
        entry.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEmployee = selectedEmployee === "all" || entry.employeeId === selectedEmployee;
      const matchesItem = selectedItem === "all" || entry.itemName === selectedItem;
      
      const entryDate = new Date(entry.date);
      const today = new Date();
      const matchesDateRange = (() => {
        switch (selectedDateRange) {
          case "today":
            return entryDate.toDateString() === today.toDateString();
          case "week":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return entryDate >= weekAgo;
          case "month":
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return entryDate >= monthAgo;
          case "10days":
            return isWithinLast10Days(entry.date);
          default:
            return true;
        }
      })();
      
      return matchesSearch && matchesEmployee && matchesItem && matchesDateRange;
    });
  };

  const filteredCreditEntries = filterCreditEntries(creditEntries);
  const totalFilteredAmount = filteredCreditEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const employeeCreditSummary = useMemo(() => {
    return employees.map(employee => ({
      ...employee,
      totalCredit: getEmployeeTotalCredit(employee.id),
      recentCredit: getEmployeeRecentCredit(employee.id),
      recentEntries: creditEntries
        .filter(entry => entry.employeeId === employee.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
    }));
  }, [employees, creditEntries]);

  const topItems = useMemo(() => {
    const itemTotals = creditEntries.reduce((acc, entry) => {
      acc[entry.itemName] = (acc[entry.itemName] || 0) + entry.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(itemTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  }, [creditEntries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Credit Purchase Entry</h1>
          <p className="text-muted-foreground">Manage employee credit purchases and track spending</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2" size="lg">
              <Plus className="h-5 w-5" />
              <span>Add Credit Entry</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {isEditMode ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                <span>{isEditMode ? "Edit Credit Entry" : "Add Credit Purchase Entry"}</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select 
                  value={formData.employeeId} 
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{employee.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {formatCurrency(getEmployeeTotalCredit(employee.id))}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    max={formatDate(new Date())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="itemName">Item Name *</Label>
                <Select 
                  value={formData.itemName} 
                  onValueChange={(value) => setFormData({ ...formData, itemName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select or enter item" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonItems.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.itemName === "Other" && (
                <div className="space-y-2">
                  <Label htmlFor="notes">Custom Item Name *</Label>
                  <Input
                    id="notes"
                    placeholder="Enter custom item name"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              )}
              
              <Separator />
              
              <div className="flex space-x-2">
                <Button type="submit" className="flex-1">
                  {isEditMode ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Update Entry
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Entry
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {employees.length === 0 && (
        <Alert>
          <ShoppingCart className="h-4 w-4" />
          <AlertDescription>
            Please add employees first before recording credit entries.
            <Button variant="link" className="p-0 h-auto ml-2" onClick={() => window.location.href = "/"}>
              Go to Employee Management →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {employees.length > 0 && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Credit</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(creditEntries.reduce((sum, entry) => sum + entry.amount, 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        creditEntries
                          .filter(entry => {
                            const entryDate = new Date(entry.date);
                            const now = new Date();
                            return entryDate.getMonth() === now.getMonth() && 
                                   entryDate.getFullYear() === now.getFullYear();
                          })
                          .reduce((sum, entry) => sum + entry.amount, 0)
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <History className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entries</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {creditEntries.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Filter className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Filtered</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(totalFilteredAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="h-5 w-5" />
                <span>Search & Filter</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <Input
                    placeholder="Search by employee or item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue />
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
                
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Item</Label>
                  <Select value={selectedItem} onValueChange={setSelectedItem}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      {commonItems.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {(searchTerm || selectedEmployee !== "all" || selectedDateRange !== "all" || selectedItem !== "all") && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredCreditEntries.length} of {creditEntries.length} entries
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedEmployee("all");
                      setSelectedDateRange("all");
                      setSelectedItem("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Employee Credit Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5" />
                <span>Employee Credit Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Total Credit</TableHead>
                    <TableHead>Recent (10 Days)</TableHead>
                    <TableHead>Latest Purchases</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeCreditSummary.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>
                        <span className="text-lg font-bold text-destructive">
                          {formatCurrency(employee.totalCredit)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.recentCredit > 0 ? "destructive" : "secondary"}>
                          {formatCurrency(employee.recentCredit)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {employee.recentEntries.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No purchases yet</span>
                          ) : (
                            employee.recentEntries.map((entry) => (
                              <div key={entry.id} className="text-sm flex items-center justify-between">
                                <div>
                                  <span className="text-muted-foreground">{formatDisplayDate(entry.date)}</span>
                                  <span className="ml-2 font-medium">{entry.itemName}</span>
                                </div>
                                <span className="text-destructive font-bold">{formatCurrency(entry.amount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Items */}
          {topItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Top Items by Total Amount</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topItems.map(([item, amount], index) => (
                    <div key={item} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{item}</span>
                      </div>
                      <span className="text-lg font-bold text-primary">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Credit Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Credit Entries</span>
                  {filteredCreditEntries.length !== creditEntries.length && (
                    <Badge variant="secondary">{filteredCreditEntries.length} filtered</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {formatCurrency(totalFilteredAmount)}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCreditEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {creditEntries.length === 0 ? "No credit entries yet" : "No entries match your filters"}
                  </p>
                  {creditEntries.length === 0 && (
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setIsDialogOpen(true)}
                    >
                      Add First Entry
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCreditEntries
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{formatDisplayDate(entry.date)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {isWithinLast10Days(entry.date) ? "Recent" : "Older"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {getEmployeeName(entry.employeeId)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.itemName}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-lg font-bold text-destructive">
                                {formatCurrency(entry.amount)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(entry)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(
                                    entry.id, 
                                    getEmployeeName(entry.employeeId), 
                                    entry.itemName, 
                                    entry.amount
                                  )}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
        </div>
      )}
    </div>
  );
};

export default CreditPurchase;