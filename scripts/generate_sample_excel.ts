import * as XLSX from 'xlsx';
import * as path from 'path';

function generateSampleData() {
  const departments = ['Production', 'Assembly', 'Quality Control', 'Warehouse', 'Maintenance', 'Accounts', 'Engineering'];
  const shifts = ['First', 'General', 'Second', 'Night'];
  const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Rohan', 'Ananya', 'Vikas', 'Pooja', 'Karan', 'Neha', 'Deepak', 'Kavita', 'Sanjay', 'Ritu', 'Manish'];
  const lastNames = ['Patel', 'Shah', 'Sharma', 'Verma', 'Mehta', 'Joshi', 'Gupta', 'Singh', 'Deshmukh', 'Yadav', 'Trivedi', 'Kulkarni'];

  const rows = [];

  for (let i = 1; i <= 250; i++) {
    const code = `EMP${i.toString().padStart(3, '0')}`;
    const fName = firstNames[(i * 7) % firstNames.length];
    const lName = lastNames[(i * 11) % lastNames.length];
    const fullName = `${fName} ${lName}`;
    const email = `emp${i.toString().padStart(3, '0')}@example.com`;
    const department = departments[i % departments.length];
    const shift = shifts[i % shifts.length];

    rows.push({
      'Employee Code': code,
      'Employee Name': fullName,
      Email: email,
      Department: department,
      Shift: shift,
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');

  const outPath = path.resolve(__dirname, '../demo_employees_250.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`✅ Successfully generated ${rows.length} sample employee records to: ${outPath}`);
}

generateSampleData();
