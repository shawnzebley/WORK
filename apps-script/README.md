This is the updated live Index source supplied for the Sobieski proposal app.

The inspection agreement button now asks whether to include the two-page new
customer form. OK includes it; Cancel produces all populated agreement pages
without that form. The bottom internal notes also appear on the printed turnover,
with line breaks preserved. Empty notes are omitted and long notes can continue
across pages.

To install, download the complete `Index.html` file from GitHub and open it in a
text editor. Copy its entire contents into the existing Apps Script Index HTML
file, save the project, and update the existing web-app deployment to a new
version. Keep the full live backend unchanged. The supplied Code.txt contained
only doGet and constants; it omitted the conversion and account-library functions
that the original live Index already calls.

The complete file is 1,499,343 bytes and ends with </html>. Avoid copying a
truncated file preview.

Local Chromium checks passed for both customer-form choices, repeat generation,
preservation of all four populated agreement pages, 56 fillable customer-form
fields, and printed multiline, empty, and 120-line turnover notes. Local tests
used LibreOffice for DOCX-to-PDF conversion in place of the Google Apps Script
conversion service. The live deployment has not been accessed or updated.
