# Sample Lead Import Files

This directory contains sample CSV and XLSX files for testing the Lead Database import functionality.

## Available Sample Files

### 1. `sample_leads.csv`
- **20 valid leads** with complete data
- Includes all standard fields (email, company, contact info, industry, revenue, etc.)
- Tests various industries, company sizes, and lead sources
- **Use this for:** Testing successful imports with full data

### 2. `sample_leads_with_duplicates.csv`
- **10 leads** including duplicates and errors
- Contains duplicate entries (same email/domain combinations)
- Includes invalid email formats and missing emails (should trigger errors)
- **Use this for:** Testing deduplication logic and error handling

### 3. `sample_leads_minimal.csv`
- **6 leads** with minimal required fields only
- Only includes: Email, Company Name, Industry, City, State
- **Use this for:** Testing imports with minimal data

### 4. `sample_leads.xlsx` (Generate with script)
- Excel format version of sample_leads.csv
- **To generate:** Run `node generate_sample_xlsx.js` from this directory

## Field Mapping

The import system automatically maps various column name variations to standard fields:

| Standard Field | Accepted Column Names |
|---------------|----------------------|
| Email | email, e-mail, email address |
| Company Name | company, company name, companyname, organization, org |
| First Name | first name, firstname, fname |
| Last Name | last name, lastname, lname |
| Full Name | full name, fullname, name |
| Title | title, job title, position |
| Phone | phone, phone number, telephone |
| Industry | industry |
| Revenue | revenue, annual revenue |
| Employee Count | employees, employee count, headcount |
| City | city |
| State | state, province |
| Country | country |
| Website | website, web, url |
| LinkedIn URL | linkedin, linkedin url, linkedinurl |
| Accounting System | accounting system, accounting, erp |
| Notes | notes, note |
| Tags | tags, tag |
| Source | source, lead source |

## Testing Scenarios

### Scenario 1: Successful Import
1. Use `sample_leads.csv` or `sample_leads.xlsx`
2. Expected: 20 leads imported successfully
3. Check: All leads appear in the database with correct field mapping

### Scenario 2: Duplicate Detection
1. Import `sample_leads.csv` first (20 leads)
2. Import `sample_leads_with_duplicates.csv` (contains duplicates)
3. Expected: Duplicates are detected and marked
4. Check: Use "Review Duplicates" button to see duplicate groups

### Scenario 3: Error Handling
1. Use `sample_leads_with_duplicates.csv`
2. Expected: Rows with invalid/missing emails show as errors
3. Check: Import dialog shows error details for invalid rows

### Scenario 4: Minimal Data
1. Use `sample_leads_minimal.csv`
2. Expected: Leads imported with only basic fields
3. Check: Other fields are null/empty but import succeeds

## Notes

- **Email is required** - Rows without valid emails will be rejected
- **Deduplication** is based on Domain + Email combination
- **Field mapping** is case-insensitive and handles common variations
- **Revenue** can be formatted with currency symbols (e.g., "$5,000,000")
- **Employee Count** should be numeric

## Generating XLSX File

To generate the Excel version:

```bash
cd server/uploads/leads
node generate_sample_xlsx.js
```

This will create `sample_leads.xlsx` with the same data as `sample_leads.csv`.

