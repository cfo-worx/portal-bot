// Script to generate sample XLSX file for lead import testing
// Run with: node generate_sample_xlsx.js

import * as XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleData = [
  {
    'Email': 'john.smith@acmecorp.com',
    'Company Name': 'Acme Corporation',
    'First Name': 'John',
    'Last Name': 'Smith',
    'Full Name': 'John Smith',
    'Title': 'CEO',
    'Phone': '555-0101',
    'Industry': 'Manufacturing',
    'Revenue': 5000000,
    'Employee Count': 150,
    'City': 'San Francisco',
    'State': 'CA',
    'Country': 'USA',
    'Website': 'https://www.acmecorp.com',
    'LinkedIn URL': 'https://linkedin.com/in/johnsmith',
    'Accounting System': 'QuickBooks Online',
    'Notes': 'Interested in fractional CFO services',
    'Tags': 'Enterprise',
    'Source': 'Website'
  },
  {
    'Email': 'sarah.jones@techstart.io',
    'Company Name': 'TechStart Inc',
    'First Name': 'Sarah',
    'Last Name': 'Jones',
    'Full Name': 'Sarah Jones',
    'Title': 'CFO',
    'Phone': '555-0102',
    'Industry': 'Technology',
    'Revenue': 2500000,
    'Employee Count': 75,
    'City': 'Seattle',
    'State': 'WA',
    'Country': 'USA',
    'Website': 'https://www.techstart.io',
    'LinkedIn URL': 'https://linkedin.com/in/sarahjones',
    'Accounting System': 'Xero',
    'Notes': 'Looking for accounting support',
    'Tags': 'Startup',
    'Source': 'Cold Email'
  },
  {
    'Email': 'mike.brown@retailco.com',
    'Company Name': 'RetailCo LLC',
    'First Name': 'Mike',
    'Last Name': 'Brown',
    'Full Name': 'Mike Brown',
    'Title': 'Owner',
    'Phone': '555-0103',
    'Industry': 'Retail',
    'Revenue': 1200000,
    'Employee Count': 45,
    'City': 'Chicago',
    'State': 'IL',
    'Country': 'USA',
    'Website': 'https://www.retailco.com',
    'LinkedIn URL': 'https://linkedin.com/in/mikebrown',
    'Accounting System': 'QuickBooks Desktop',
    'Notes': 'Needs help with financial reporting',
    'Tags': 'Small Business',
    'Source': 'Referral'
  },
  {
    'Email': 'lisa.wang@manufacturingpro.com',
    'Company Name': 'Manufacturing Pro',
    'First Name': 'Lisa',
    'Last Name': 'Wang',
    'Full Name': 'Lisa Wang',
    'Title': 'VP Finance',
    'Phone': '555-0104',
    'Industry': 'Manufacturing',
    'Revenue': 8000000,
    'Employee Count': 200,
    'City': 'Detroit',
    'State': 'MI',
    'Country': 'USA',
    'Website': 'https://www.manufacturingpro.com',
    'LinkedIn URL': 'https://linkedin.com/in/lisawang',
    'Accounting System': 'NetSuite',
    'Notes': 'Enterprise client - complex needs',
    'Tags': 'Enterprise',
    'Source': 'LinkedIn DMs'
  },
  {
    'Email': 'david.chen@servicesgroup.com',
    'Company Name': 'Services Group',
    'First Name': 'David',
    'Last Name': 'Chen',
    'Full Name': 'David Chen',
    'Title': 'Controller',
    'Phone': '555-0105',
    'Industry': 'Professional Services',
    'Revenue': 3500000,
    'Employee Count': 90,
    'City': 'Boston',
    'State': 'MA',
    'Country': 'USA',
    'Website': 'https://www.servicesgroup.com',
    'LinkedIn URL': 'https://linkedin.com/in/davidchen',
    'Accounting System': 'QuickBooks Online',
    'Notes': 'Interested in bookkeeping services',
    'Tags': 'Mid-Market',
    'Source': 'Cold Calling'
  },
  {
    'Email': 'emily.davis@healthcareplus.com',
    'Company Name': 'Healthcare Plus',
    'First Name': 'Emily',
    'Last Name': 'Davis',
    'Full Name': 'Emily Davis',
    'Title': 'CFO',
    'Phone': '555-0106',
    'Industry': 'Healthcare',
    'Revenue': 15000000,
    'Employee Count': 300,
    'City': 'New York',
    'State': 'NY',
    'Country': 'USA',
    'Website': 'https://www.healthcareplus.com',
    'LinkedIn URL': 'https://linkedin.com/in/emilydavis',
    'Accounting System': 'Sage Intacct',
    'Notes': 'Large healthcare organization',
    'Tags': 'Enterprise',
    'Source': 'Website'
  },
  {
    'Email': 'robert.taylor@logisticscorp.com',
    'Company Name': 'Logistics Corp',
    'First Name': 'Robert',
    'Last Name': 'Taylor',
    'Full Name': 'Robert Taylor',
    'Title': 'Finance Director',
    'Phone': '555-0107',
    'Industry': 'Logistics',
    'Revenue': 6000000,
    'Employee Count': 180,
    'City': 'Dallas',
    'State': 'TX',
    'Country': 'USA',
    'Website': 'https://www.logisticscorp.com',
    'LinkedIn URL': 'https://linkedin.com/in/roberttaylor',
    'Accounting System': 'Microsoft Dynamics',
    'Notes': 'Needs financial analysis support',
    'Tags': 'Enterprise',
    'Source': 'Cold Email'
  },
  {
    'Email': 'jennifer.martinez@foodservices.com',
    'Company Name': 'Food Services Inc',
    'First Name': 'Jennifer',
    'Last Name': 'Martinez',
    'Full Name': 'Jennifer Martinez',
    'Title': 'Owner',
    'Phone': '555-0108',
    'Industry': 'Food & Beverage',
    'Revenue': 2200000,
    'Employee Count': 60,
    'City': 'Los Angeles',
    'State': 'CA',
    'Country': 'USA',
    'Website': 'https://www.foodservices.com',
    'LinkedIn URL': 'https://linkedin.com/in/jennifermartinez',
    'Accounting System': 'QuickBooks Online',
    'Notes': 'Restaurant chain - multiple locations',
    'Tags': 'Small Business',
    'Source': 'Referral'
  },
  {
    'Email': 'william.anderson@constructionco.com',
    'Company Name': 'Construction Co',
    'First Name': 'William',
    'Last Name': 'Anderson',
    'Full Name': 'William Anderson',
    'Title': 'CFO',
    'Phone': '555-0109',
    'Industry': 'Construction',
    'Revenue': 4500000,
    'Employee Count': 120,
    'City': 'Denver',
    'State': 'CO',
    'Country': 'USA',
    'Website': 'https://www.constructionco.com',
    'LinkedIn URL': 'https://linkedin.com/in/williamanderson',
    'Accounting System': 'QuickBooks Desktop',
    'Notes': 'Commercial construction company',
    'Tags': 'Mid-Market',
    'Source': 'LinkedIn DMs'
  },
  {
    'Email': 'patricia.thomas@consultingfirm.com',
    'Company Name': 'Consulting Firm',
    'First Name': 'Patricia',
    'Last Name': 'Thomas',
    'Full Name': 'Patricia Thomas',
    'Title': 'Partner',
    'Phone': '555-0110',
    'Industry': 'Consulting',
    'Revenue': 1800000,
    'Employee Count': 50,
    'City': 'Atlanta',
    'State': 'GA',
    'Country': 'USA',
    'Website': 'https://www.consultingfirm.com',
    'LinkedIn URL': 'https://linkedin.com/in/patriciathomas',
    'Accounting System': 'Xero',
    'Notes': 'Management consulting firm',
    'Tags': 'Small Business',
    'Source': 'Cold Calling'
  }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(sampleData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Leads');

// Write file
const outputPath = join(__dirname, 'sample_leads.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`✅ Sample XLSX file created: ${outputPath}`);
console.log(`   Contains ${sampleData.length} sample leads`);

