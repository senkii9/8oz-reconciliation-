const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add state
code = code.replace(
  "const [activeRole, setActiveRole] = useState<'owner' | 'supervisor' | 'cashier' | null>(null);",
  "const [activeRole, setActiveRole] = useState<'owner' | 'supervisor' | 'cashier' | null>(null);\n  const [activeEmployeeName, setActiveEmployeeName] = useState<string | null>(null);"
);

// Add to sessionStorage and setActiveEmployeeName
const oldPinSubmit = `
    if (hasEmployees) {
      const employee = settings.employees.find(emp => emp.pin === pinInput);
      if (employee) {
        setActiveRole(employee.role);
        sessionStorage.setItem('foodics_active_role', employee.role);
        setActiveTab('closing');
        setPinInput('');
        setPinError(false);
      } else {
        setPinError(true);
      }
`;

const newPinSubmit = `
    if (hasEmployees) {
      const employee = settings.employees.find(emp => emp.pin === pinInput);
      if (employee) {
        setActiveRole(employee.role);
        setActiveEmployeeName(employee.name);
        sessionStorage.setItem('foodics_active_role', employee.role);
        sessionStorage.setItem('foodics_active_employee_name', employee.name);
        setActiveTab('closing');
        setPinInput('');
        setPinError(false);
      } else {
        setPinError(true);
      }
`;

code = code.replace(oldPinSubmit, newPinSubmit);

// Also restore from sessionStorage
code = code.replace(
  "const storedRole = sessionStorage.getItem('foodics_active_role');",
  "const storedRole = sessionStorage.getItem('foodics_active_role');\n    const storedName = sessionStorage.getItem('foodics_active_employee_name');"
);
code = code.replace(
  "if (storedRole && (storedRole === 'owner' || storedRole === 'supervisor' || storedRole === 'cashier')) {\n      setActiveRole(storedRole as any);\n    }",
  "if (storedRole && (storedRole === 'owner' || storedRole === 'supervisor' || storedRole === 'cashier')) {\n      setActiveRole(storedRole as any);\n      if (storedName) setActiveEmployeeName(storedName);\n    }"
);

// Clear on logout
code = code.replace(
  "sessionStorage.removeItem('foodics_active_role');",
  "sessionStorage.removeItem('foodics_active_role');\n    sessionStorage.removeItem('foodics_active_employee_name');\n    setActiveEmployeeName(null);"
);

fs.writeFileSync('src/App.tsx', code);
