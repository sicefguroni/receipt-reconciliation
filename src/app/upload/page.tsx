import Link from "next/link";
import { uploadReceipt } from "../actions";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>Upload</h1>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <form action={uploadReceipt} className="stack">
        <label>
          Receipt (PDF, JPEG, or PNG)
          <input
            type="file"
            name="receipt"
            accept="application/pdf,image/jpeg,image/png"
            required
          />
        </label>
        <label>
          Statement export (CSV: Date, Account, Description, Amount, Foreign Amount, Foreign
          Currency)
          <input type="file" name="statement" accept=".csv,text/csv" required />
        </label>
        <label>
          Month
          <input type="month" name="monthKey" defaultValue="2026-10" required />
        </label>
        <label>
          Submitted by
          <input type="text" name="submitterId" defaultValue="staff-a" required />
        </label>
        <label>
          Paid with
          <select name="paymentSource" defaultValue="company_card">
            <option value="company_card">Company card</option>
            <option value="personal_card">Personal card</option>
            <option value="bank">Bank account</option>
            <option value="unknown">Not sure</option>
          </select>
        </label>
        <label>
          Business purpose
          <input type="text" name="businessPurpose" maxLength={500} />
        </label>
        <button type="submit">Process</button>
      </form>
    </main>
  );
}
