import express from "express";
import { pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch.toUpperCase()];
};

const EXCLUDED_EMPLOYEES = [
  "Rahul Sharma",
  "ATUL KRISHNA LAVANIYA",
  "JITENDRA TIWAARI",
  "DIVAYANSHI BHASKAR",
  "RAJESH KUMAR",
  "NITESH RAI",
  "SANSKAR SHARMA",
  "HUKAM SINGH BHATI",
  "KRISHNA MURARI",
  "Priya Patel",
  "EESHAN SUNDER",
  "ASHWIN S",
  "MUTHUSELVI K S",
  "SAI KIRAN",
  "SYAM MANOHAR SUJITHA",
  "Mohammed Asif M",
  "PANKAJ KUMAR",
  "KEYUR KHANAPRA",
  "YASHVI PATEL",
  "HIMANSHU DEORA",
  "PRATIK TANK",
  "SWATI PARDHI",
  "YASIN MOMIN",
  "PAL MODI",
  "PRINSA JASANI",
  "SUMAN RAJBHAR",
  "PRIYANKA PARGI",
  "HELI HARSORA",
  "KIRTARTH AMIN",
  "JIGNESH THAKOR",
  "DEVAM BHEDA",
  "ASTHA DHANANI",
  "NIKITA NEGI",
  "JEET DAVE",
  "JAINIKA PARMAR",
  "PARTH PATEL",
  "DIPAK PARMAR",
  "ABHISHEK SHARMA",
  "ADITYA SHARMA",
  "BHAVIK GANATRA",
  "JAY RAMBHIA",
  "ANOUSHKA GHOSH",
  "MAHEK SHARMA",
  "URVIL THESIYA",
  "TIRTH MEHTA",
  "PRINCE THAKKAR",
  "SANTOSH KUMAR",
  "MIRA GANATRA",
  "VIKASH PENDAL",
  "JAYDEEP GANDHI",
  "EZAVA KRISHNA MOHAN",
  "RITIKA MUDLIYAR",
  "RENISH PANDAV",
  "TWINKAL VADODARIYA",
  "JAYASHREE SHANMUGAM",
  "JAYABHARATHI P",
  "JAYARAJ",
  "SHANMUGAPRIYA V",
  "SANJAY BRAHMBHATT",
  "SARASHTI RATHI",
  "SANJEEV YADAV",
  "NAKSHTRA PAREKH",
  "JITENDRA SINGH",
  "YASH BATHAM",
  "SHIVAM TRIVEDI",
  "YESHA PANCHAL",
  "JAHANVI THAKKAR",
  "BHAVYA SHANGHVI",
  "MEHRIN MEMON",
  "LALIT PATIL",
  "LOKESH",
  "RANJAN BEHERA",
  "BHARAT KUMAR DENDOR",
  "RAJ VGHASIYA",
  "HIMANSHU KUNWAR",
  "DEEP BHATT",
  "HARSH PATEL",
  "RAVIRAJSINH CHAVDA",
  "SAGAR BHATT",
  "NIKUNJ GERIYA",
  "ABHISHEK BHAMBHI",
  "JAYESH CHAVDA",
  "CHIRAG PANCHAL",
  "YASH CHANDEGARA",
  "SWATI KARELIYA",
  "JANVI KANANI",
  "DIPALI BHATIYA",
  "SRUJAL PARMAR",
  "KAVITA BHATI",
  "DEEPAK",
  "VAISHNAVI SINGH",
  "DIVYA",
  "BHOLU KUMAR JHA",
  "DEEPAK KUMAR",
  "NIDHI BATHAM",
  "NAMAN RAJPUT",
  "PAWAN KUMAR",
  "PRIYANKA THAKUR",
  "SHUBHAM MOHAN",
  "DIXIT KUMAR",
  "JISHAN KHAN",
  "AYUSH PANDEY",
  "NEHA KUMARI",
  "KESHAV YADAV",
  "NEETI TYAGI",
  "SNEHA TIWARI",
  "SUPRIYA KUMARI",
  "SAGAR KUMAR JHA",
  "NASIR CHAUHAN",
  "PRAVEEN KUMAR",
  "MOHD TAUFAIL",
  "MD SADIQUE HASNAIN",
  "LUXMI LAMBA",
  "MD SHAHRUKH HUSSAIN",
  "PRIYANKA SINGH",
  "SUMIT KUMAR",
  "ASHISH LOHAT",
  "VIKRAM SINGH BHOLA",
  "PRATEEK RAJ",
  "KAUSHLENDRA PRATAP SINGH SENGAR",
  "RISHU KUMAR",
  "JITENDRA SENGAR",
  "HIMANSHU VASHISHT",
  "SAROJ ROY",
  "AKASH TIWARI",
  "VIVEK RAJ",
  "SHIVANI CHAUHAN",
  "HARDIK JAIN",
  "RIMJHIM CHETIA",
  "MOHD ARIF",
  "SHAGUFI KHANAM",
  "YASH GADRI",
  "ADARSH SHUKLA",
  "ANANYA ASHISH",
  "BHUPENDER TIWARI",
  "CHANDRBHAN YADAV",
  "AYUSHI KUMARI",
  "ANANYA SAGAR",
  "ADITYA BAWA",
  "VIVEK KUMAR",
  "MEENAKSHI TYAGI",
  "PRAGATI ANAND",
  "KAJAL KAINI",
  "MOHIT KUMAR BEHL",
  "SHILPA SINGH",
  "VISHAL PARASHAR",
  "RAKESH SHAW",
  "NISHI CHAUDHARY",
  "KANAK SHARMA",
  "ZAREEN SIDDIQUE",
  "NIRANJAN DWIVEDI",
  "UTKARSH SINGH",
  "AMIT KUMAR SEXENA",
  "Laxmi Mishra",
  "TAHSEEN AKHTAR",
  "HIMANSHU GIRI GOSWAMI",
  "ANSHUL CHAUDHARY",
  "JOYSHI KESARWANI",
  "Suhail khan",
  "ANJALI RATHORE",
  "ABHAY ARORA",
  "AMAN KUMAR",
  "RIYA SHARMA",
  "DEEKSHA DUBEY",
  "NISHA KUMARI",
  "SHIVAM SHARMA",
  "SAMEER ANSARI",
  "SNEHA GUPTA",
  "KRISHAN PAL SINGH",
  "ADITYA MISHRA",
  "PRIYANKA MISHRA",
  "MARIYA MALIK",
  "BABITA",
  "ANJALI THAKUR",
  "JATIN KUMAR",
  "VIKASH KUMAR",
  "SEEMA MORYA",
  "ANUBHAV TIWARI",
  "VIKASH SHRIVASTAV",
  "DILEEP KUMAR TIWARI",
  "ABUZER ALAM",
  "RISHABH PAL",
  "RISHABH CHOUDHARY",
  "ATUL SOLANKI",
  "ANURAG SINGH",
  "MOHIT",
  "MANOJ KUMAR",
  "RITIK SINGH",
  "NIHARIKA BHATT",
  "ANKITA SRIVASTAVA",
  "HARSHIT SENGAR",
  "RICHA SHARMA",
  "KUNAL GANGA",
  "RIBA KUMARI PANDEY",
  "DEEPAK RAJPUT",
  "KAJAL TRIPATHI",
];

const isEmployeeExcluded = (employeeName) => {
  if (!employeeName) return false;
  const nameLower = employeeName.toLowerCase().trim();
  return EXCLUDED_EMPLOYEES.some(
    (excluded) => excluded.toLowerCase().trim() === nameLower
  );
};

router.get("/report/:branch", async (req, res) => {
  try {
    const { branch } = req.params;
    const { month, year } = req.query;
    const branchId = getBranchId(branch);

    if (!branchId) {
      return res.status(400).json({ error: "Invalid branch" });
    }

    const pgConnection = await pgPool.connect();

    const { rows: employees } = await pgConnection.query(
      "SELECT id, name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
      [branchId]
    );

    const activeEmployees = employees.filter(
      (emp) => !isEmployeeExcluded(emp.name)
    );

    const pipelineQuery = `
      SELECT 
        u.name as employee_name, 
        c.name as company_name, 
        c.email_normalized as email, 
        c.phone as contact, 
        c.create_date, 
        c.expected_revenue as expected_revenue  
      FROM public.crm_lead as c
      LEFT JOIN res_users as r on c.user_id = r.id
      LEFT JOIN res_partner as u on r.partner_id = u.id
      WHERE EXTRACT(MONTH FROM c.create_date) = $1 AND EXTRACT(YEAR FROM c.create_date) = $2
    `;

    const monthNum = month ? Number.parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? Number.parseInt(year) : new Date().getFullYear();

    const { rows: pipelineData } = await pgConnection.query(pipelineQuery, [
      monthNum,
      yearNum,
    ]);

    pgConnection.release();

    const employeeNames = activeEmployees.map((e) => e.name.toLowerCase());

    const filteredData = pipelineData.filter((row) => {
      // First check if this employee is in exclusion list
      if (isEmployeeExcluded(row.employee_name)) {
        return false;
      }

      // Then check if employee belongs to this branch
      return (
        row.employee_name &&
        employeeNames.some((name) =>
          row.employee_name.toLowerCase().includes(name)
        )
      );
    });

    const employeeSummaryMap = new Map();

    activeEmployees.forEach((emp) => {
      employeeSummaryMap.set(emp.name.toLowerCase(), {
        name: emp.name,
        clientCount: 0,
        totalRevenue: 0,
      });
    });

    // Update only those who have data for this month
    filteredData.forEach((row) => {
      if (!row.employee_name) return;

      // Find matching employee
      const empNameLower = row.employee_name.toLowerCase();
      for (const [key, summary] of employeeSummaryMap.entries()) {
        if (empNameLower.includes(key) || key.includes(empNameLower)) {
          summary.clientCount += 1;
          summary.totalRevenue += Number(row.expected_revenue) || 0;
          break;
        }
      }
    });

    // Convert to array and sort by revenue descending
    const summary = Array.from(employeeSummaryMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    // Calculate grand totals
    let totalClients = 0;
    let totalRevenue = 0;

    summary.forEach((emp) => {
      totalClients += emp.clientCount;
      totalRevenue += emp.totalRevenue;
    });

    res.json({
      branch,
      month: monthNum,
      year: yearNum,
      data: filteredData,
      summary,
      grandTotals: {
        totalClients,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching pipeline report:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
