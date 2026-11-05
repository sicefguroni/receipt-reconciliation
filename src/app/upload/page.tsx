import { FileText, ReceiptText, Sparkles, UploadCloud } from "lucide-react";
import { STATEMENT_FORMATS } from "@/adapters/statement/read-statement";
import { PEOPLE } from "@/config/people";
import { uploadMonth } from "../actions";
import { SubmitButton } from "../submit-button";
import { PageHeader, StatusBadge } from "../ui";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="upload-page">
      <PageHeader
        eyebrow="New reconciliation"
        title="Upload receipts and a statement"
        icon={<UploadCloud aria-hidden="true" size={24} />}
        description="Add one submitter's receipts. The app reads them, finds statement matches, and creates a focused review queue."
      />
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <form action={uploadMonth} className="stack form-card upload-form">
        <div className="form-section-head">
          <span className="step-number">1</span>
          <div>
            <h2>Add source files</h2>
            <p>PDF, JPEG, PNG, and CSV files stay grouped in this run.</p>
          </div>
        </div>
        <div className="upload-grid">
          <label className="file-field">
            <span className="file-field-icon">
              <ReceiptText aria-hidden="true" size={22} />
            </span>
            <strong>Receipt files</strong>
            <small>PDF, JPEG, or PNG · select several</small>
            <input
              type="file"
              name="receipts"
              accept="application/pdf,image/jpeg,image/png"
              multiple
              required
            />
          </label>
          <label className="file-field">
            <span className="file-field-icon">
              <FileText aria-hidden="true" size={22} />
            </span>
            <strong>Statement export</strong>
            <small>CSV · required</small>
            <input type="file" name="statement" accept=".csv,text/csv" required />
            <span className="hint">
              Accepted layouts: {STATEMENT_FORMATS.map((format) => format.name).join("; ")}.
            </span>
          </label>
        </div>

        <div className="form-divider" />
        <div className="form-section-head">
          <span className="step-number">2</span>
          <div>
            <h2>Add context</h2>
            <p>These details apply to every receipt in this upload.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            Month
            <input type="month" name="monthKey" defaultValue="2026-10" required />
          </label>
          <label className="field">
            Submitted by
            <select name="submitterId" defaultValue="staff-a">
              {PEOPLE.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Paid with
            <select name="paymentSource" defaultValue="company_card">
              <option value="company_card">Company card</option>
              <option value="personal_card">Personal card</option>
              <option value="bank">Bank account</option>
              <option value="unknown">Not known yet</option>
            </select>
          </label>
          <label className="field span-2">
            Business purpose
            <input
              type="text"
              name="businessPurpose"
              maxLength={500}
              placeholder="e.g. October customer workshop"
            />
            <span className="hint">You can change this for individual receipts later.</span>
          </label>
        </div>

        <div className="form-submit">
          <div>
            <StatusBadge tone="info">
              <Sparkles aria-hidden="true" size={14} /> Automated matching
            </StatusBadge>
            <p>Ambiguous items always go to a person.</p>
          </div>
          <SubmitButton
            type="submit"
            className="primary icon-button"
            pendingText="Reading the receipts…"
          >
            Read and match <Sparkles aria-hidden="true" size={16} />
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
