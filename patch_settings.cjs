const fs = require('fs');

let code = fs.readFileSync('src/components/SettingsTab.tsx', 'utf8');

// Add Employee logic
const newEmployeeState = `
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', role: 'cashier' as const, pin: '' });
`;
code = code.replace(/const \[inputs, setInputs\] = useState\(\{/, newEmployeeState + '\n  const [inputs, setInputs] = useState({');

const addEmployeeFn = `
  const handleAddEmployee = () => {
    if (!newEmployee.name.trim() || !newEmployee.email.trim() || !newEmployee.pin.trim()) {
      triggerToast(language === 'ar' ? 'الرجاء تعبئة جميع الحقول' : 'Please fill all fields', 'error');
      return;
    }
    const emp = { ...newEmployee, id: Date.now().toString() };
    const employees = [...(settings.employees || []), emp];
    onSaveSettings({ ...settings, employees });
    setNewEmployee({ name: '', email: '', role: 'cashier', pin: '' });
    triggerToast(language === 'ar' ? 'تمت إضافة الموظف بنجاح' : 'Employee added successfully', 'success');
  };

  const handleRemoveEmployee = (id) => {
    const employees = (settings.employees || []).filter(e => e.id !== id);
    onSaveSettings({ ...settings, employees });
  };
`;
code = code.replace(/const handleSaveAllManually = \(\) => \{/, addEmployeeFn + '\n  const handleSaveAllManually = () => {');

// Replace the Access Security (PIN) block
const pinBlockRegex = /\{\/\* Security & Access Block \*\/\}.*?\{\/\* 1\. Branches list \(فروع\) \*\/\}/s;
const newEmployeeBlock = `
        {/* Security & Access Block */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-3xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              {language === 'ar' ? 'الموظفين والصلاحيات' : 'Employees & Permissions'}
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder={language === 'ar' ? "الاسم" : "Name"}
              value={newEmployee.name}
              onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl p-2 outline-hidden transition"
            />
            <input
              type="email"
              placeholder={language === 'ar' ? "البريد الإلكتروني" : "Email"}
              value={newEmployee.email}
              onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl p-2 outline-hidden transition"
            />
            <select
              value={newEmployee.role}
              onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value as any })}
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl p-2 outline-hidden transition"
            >
              <option value="owner">{language === 'ar' ? 'مدير' : 'Manager'}</option>
              <option value="supervisor">{language === 'ar' ? 'مشرف' : 'Supervisor'}</option>
              <option value="cashier">{language === 'ar' ? 'كاشير' : 'Cashier'}</option>
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'ar' ? "الرمز (PIN)" : "PIN"}
                value={newEmployee.pin}
                onChange={e => setNewEmployee({ ...newEmployee, pin: e.target.value })}
                className="flex-1 w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl p-2 outline-hidden transition"
              />
              <button
                onClick={handleAddEmployee}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-2 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(settings.employees || []).length > 0 && (
            <div className="mt-4 space-y-2">
              {(settings.employees || []).map((emp) => (
                <div key={emp.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">{emp.name}</span>
                      <span className="text-[10px] text-slate-500">{emp.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={\`text-[10px] font-bold px-2 py-1 rounded-md \${
                      emp.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                      emp.role === 'supervisor' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-purple-100 text-purple-700'
                    }\`}>
                      {emp.role === 'owner' ? (language === 'ar' ? 'مدير' : 'Manager') : 
                       emp.role === 'supervisor' ? (language === 'ar' ? 'مشرف' : 'Supervisor') : 
                       (language === 'ar' ? 'كاشير' : 'Cashier')}
                    </span>
                    <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-1 rounded text-slate-600">
                      {emp.pin}
                    </span>
                    <button
                      onClick={() => handleRemoveEmployee(emp.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1. Branches list (فروع) */}`;
code = code.replace(pinBlockRegex, newEmployeeBlock);

fs.writeFileSync('src/components/SettingsTab.tsx', code);
