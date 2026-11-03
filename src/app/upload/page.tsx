import { STATEMENT_FORMATS } from "@/adapters/statement/read-statement";
import { PEOPLE } from "@/config/people";
import { uploadMonth } from "../actions";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>Upload receipts and a statement</h1>
      <p className="muted">
        One submitter's receipts at a time. They are read, matched to the statement, and put in the
        review queue.
      </p>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <form action={uploadMonth} className="stack">
        <label>
          Receipts (PDF, JPEG, or PNG; choose several at once)
          <input
            type="file"
            name="receipts"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            required
          />
        </label>
        <label>
          Statement export (CSV)
          <input type="file" name="statement" accept=".csv,text/csv" required />
          <span className="hint">
            Accepted layouts: {STATEMENT_FORMATS.map((f) => f.name).join("; ")}.
          </span>
        </label>
        <label>
          Month
          <input type="month" name="monthKey" defaultValue="2026-10" required />
        </label>
        <label>
          Submitted by
          <select name="submitterId" defaultValue="staff-a">
            {PEOPLE.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paid with
          <select name="paymentSource" defaultValue="company_card">
            <option value="company_card">Company card</option>
            <option value="personal_card">Personal card</option>
            <option value="bank">Bank account</option>
            <option value="unknown">Not known yet</option>
          </select>
        </label>
        <label>
          Business purpose (applies to every receipt in this upload; you can change it per receipt
          later)
          <input type="text" name="businessPurpose" maxLength={500} />
        </label>
        <div>
          <button type="submit" className="primary">
            Read and match
          </button>
        </div>
      </form>
    </main>
  );
}
