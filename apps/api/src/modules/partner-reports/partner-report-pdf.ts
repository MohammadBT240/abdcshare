import PDFDocument from "pdfkit";
import type { PartnerReportEntity } from "./infrastructure/persistence/partner-report.entity";
import type { PartnerReportEngagementUpdateEntity } from "./infrastructure/persistence/partner-report-engagement-update.entity";
import type { PartnerReportDecisionEntity } from "./infrastructure/persistence/partner-report-decision.entity";

const INK = "#0f172a";
const MUTED = "#64748b";
const RULE = "#e2e8f0";
const ACCENT = "#0f766e"; // deep teal — professional, not purple
const BAND = "#f0fdfa";
const DANGER = "#b91c1c"; // red for over-collected / negative balances

function titleCaseEnum(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

/** Display symbol; Helvetica lacks ₦ so NGN uses a readable "N" prefix in PDF. */
function currencySymbol(code: string | null | undefined): string {
  if (code === "USD") return "$";
  if (code === "NGN") return "N";
  return "";
}

function money(
  currency: string | null | undefined,
  amount: string | null | undefined,
): string {
  if (amount == null || amount === "") return "—";
  const n = Number(String(amount).replace(/,/g, ""));
  const formatted = Number.isFinite(n)
    ? n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  const symbol = currencySymbol(currency);
  return symbol ? `${symbol}${formatted}` : formatted;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Renders a polished single-partner-report PDF for download by the Principal (or owner).
 */
export async function buildPartnerReportPdf(
  report: PartnerReportEntity,
  firmName = "Abdulkadeer & Co. (Chartered Accountants)",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      bufferPages: true,
      info: {
        Title: `${report.department} — ${report.reportingOfficerName}`,
        Author: firmName,
        Subject: "Principal report",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = doc.page.margins.top;

    const ensureSpace = (needed: number) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (y + needed > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    };

    // ---- Header ----
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text("CONFIDENTIAL — For the Principal", doc.page.margins.left, y, {
        width: pageWidth,
      });
    y = doc.y + 10;

    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.margins.left + pageWidth, y)
      .strokeColor(RULE)
      .lineWidth(1)
      .stroke();
    y += 16;

    // ---- Title: company/department + submitter ----
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(report.department, doc.page.margins.left, y, { width: pageWidth });
    y = doc.y + 4;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(report.reportingOfficerName, { width: pageWidth });
    y = doc.y + 4;

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(
        [
          titleCaseEnum(report.periodType),
          report.periodLabel || null,
          `Status: ${report.status}`,
        ]
          .filter(Boolean)
          .join("  ·  "),
        { width: pageWidth },
      );
    y = doc.y + 14;

    // Soft band with dates
    ensureSpace(48);
    doc.save();
    doc.roundedRect(doc.page.margins.left, y, pageWidth, 40, 6).fill(BAND);
    doc.restore();

    const bandPad = 12;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text("Submitted", doc.page.margins.left + bandPad, y + bandPad, {
        width: pageWidth / 2 - bandPad,
      });
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(fmtDate(report.submittedAt), doc.page.margins.left + bandPad, doc.y + 1, {
        width: pageWidth / 2 - bandPad,
      });

    const rightX = doc.page.margins.left + pageWidth / 2;
    if (report.reviewedAt) {
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(8)
        .text("Reviewed", rightX, y + bandPad, {
          width: pageWidth / 2 - bandPad,
        });
      doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(fmtDate(report.reviewedAt), rightX, doc.y + 1, {
          width: pageWidth / 2 - bandPad,
        });
    }
    y += 40 + 18;

    const section = (heading: string) => {
      ensureSpace(36);
      doc
        .fillColor(ACCENT)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(heading.toUpperCase(), doc.page.margins.left, y, {
          characterSpacing: 0.6,
        });
      y = doc.y + 4;
      doc
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + pageWidth, y)
        .strokeColor(RULE)
        .lineWidth(0.75)
        .stroke();
      y += 10;
    };

    const body = (
      text: string | null | undefined,
      empty = "No content provided.",
    ) => {
      ensureSpace(40);
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(10)
        .text(text?.trim() || empty, doc.page.margins.left, y, {
          width: pageWidth,
          lineGap: 2,
          align: "left",
        });
      y = doc.y + 14;
    };

    const kv = (label: string, value: string) => {
      ensureSpace(18);
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(8)
        .text(label, doc.page.margins.left, y, {
          width: 130,
          continued: false,
        });
      doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(value, doc.page.margins.left + 130, y, {
          width: pageWidth - 130,
        });
      y = Math.max(doc.y, y + 14);
    };

    // ---- Sections ----
    section("Executive summary");
    body(report.executiveSummary);

    const billingItems = report.billingItems
      .getItems()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const hasFinancials =
      Boolean(report.currency) ||
      billingItems.length > 0 ||
      Boolean(report.feeRevenue) ||
      Boolean(report.collectionsReceived) ||
      Boolean(report.outstanding) ||
      Boolean(report.remark?.trim());
    if (hasFinancials) {
      section("Financials");
      kv(
        "Currency",
        report.currency === "NGN"
          ? "Naira (NGN)"
          : report.currency === "USD"
            ? "US Dollar (USD)"
            : (report.currency ?? "—"),
      );
      if (billingItems.length) {
        ensureSpace(22);
        const colDesc = pageWidth * 0.4;
        const colAmt = pageWidth * 0.2;
        const x0 = doc.page.margins.left;
        doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
        doc.text("Description", x0, y, { width: colDesc });
        doc.text("Bill amount", x0 + colDesc, y, {
          width: colAmt,
          align: "right",
        });
        doc.text("Received", x0 + colDesc + colAmt, y, {
          width: colAmt,
          align: "right",
        });
        doc.text("Balance", x0 + colDesc + colAmt * 2, y, {
          width: colAmt,
          align: "right",
        });
        y += 12;
        for (const item of billingItems) {
          ensureSpace(16);
          const bill = Number(item.amount) || 0;
          const received = Number(item.amountReceived) || 0;
          const balanceNum = bill - received;
          const balance = balanceNum.toFixed(2);
          const over = balanceNum < 0;
          const rowY = y;
          doc.fillColor(INK).font("Helvetica").fontSize(9);
          doc.text(item.description, x0, rowY, { width: colDesc });
          doc.fillColor(INK).font("Helvetica-Bold");
          doc.text(money(report.currency, item.amount), x0 + colDesc, rowY, {
            width: colAmt,
            align: "right",
          });
          doc.fillColor(over ? DANGER : INK);
          doc.text(
            money(report.currency, item.amountReceived ?? "0"),
            x0 + colDesc + colAmt,
            rowY,
            {
              width: colAmt,
              align: "right",
            },
          );
          doc.fillColor(over ? DANGER : INK);
          doc.text(
            money(report.currency, balance),
            x0 + colDesc + colAmt * 2,
            rowY,
            {
              width: colAmt,
              align: "right",
            },
          );
          y = Math.max(doc.y, rowY + 14);
        }
        y += 4;
        doc
          .moveTo(x0, y)
          .lineTo(x0 + pageWidth, y)
          .strokeColor(RULE)
          .lineWidth(0.5)
          .stroke();
        y += 8;
        const totalsY = y;
        const outstandingNum = Number(report.outstanding) || 0;
        doc
          .fillColor(MUTED)
          .font("Helvetica")
          .fontSize(8)
          .text("Totals", x0, totalsY, { width: colDesc });
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
        doc.text(money(report.currency, report.feeRevenue), x0 + colDesc, totalsY, {
          width: colAmt,
          align: "right",
        });
        doc.text(
          money(report.currency, report.collectionsReceived),
          x0 + colDesc + colAmt,
          totalsY,
          {
            width: colAmt,
            align: "right",
          },
        );
        doc.fillColor(outstandingNum < 0 ? DANGER : INK);
        doc.text(
          money(report.currency, report.outstanding),
          x0 + colDesc + colAmt * 2,
          totalsY,
          {
            width: colAmt,
            align: "right",
          },
        );
        y += 16;
      } else {
        kv("Fee revenue", money(report.currency, report.feeRevenue));
        kv("Collections", money(report.currency, report.collectionsReceived));
        kv("Outstanding", money(report.currency, report.outstanding));
      }
      if (report.remark?.trim()) kv("Remark", report.remark.trim());
      y += 6;
    }

    const updates = report.engagementUpdates
      .getItems()
      .sort(
        (
          a: PartnerReportEngagementUpdateEntity,
          b: PartnerReportEngagementUpdateEntity,
        ) => a.sortOrder - b.sortOrder,
      );
    section("Client / engagement updates");
    if (!updates.length) {
      body(null, "No engagement updates listed.");
    } else {
      for (const u of updates) {
        ensureSpace(42);
        doc
          .fillColor(INK)
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(u.clientEngagement, doc.page.margins.left, y, {
            width: pageWidth * 0.7,
          });
        doc
          .fillColor(ACCENT)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(
            titleCaseEnum(u.status),
            doc.page.margins.left + pageWidth * 0.7,
            y,
            {
              width: pageWidth * 0.3,
              align: "right",
            },
          );
        y = doc.y + 2;
        doc
          .fillColor(MUTED)
          .font("Helvetica")
          .fontSize(9)
          .text(u.update, doc.page.margins.left, y, {
            width: pageWidth,
            lineGap: 1.5,
          });
        y = doc.y + 10;
      }
      y += 4;
    }

    const decisions = report.decisions
      .getItems()
      .sort(
        (a: PartnerReportDecisionEntity, b: PartnerReportDecisionEntity) =>
          a.sortOrder - b.sortOrder,
      );
    section("Matters requiring decision");
    if (!decisions.length) {
      body(null, "No decisions requested.");
    } else {
      for (const d of decisions) {
        ensureSpace(36);
        doc
          .fillColor(ACCENT)
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(
            titleCaseEnum(d.priority).toUpperCase(),
            doc.page.margins.left,
            y,
          );
        y = doc.y + 2;
        doc
          .fillColor(INK)
          .font("Helvetica")
          .fontSize(10)
          .text(d.decision, doc.page.margins.left, y, {
            width: pageWidth,
            lineGap: 1.5,
          });
        y = doc.y + 10;
      }
      y += 4;
    }

    section("People & capacity");
    body(report.peopleCapacity);

    section("Outlook");
    body(report.outlook);

    if (report.reviewNotes?.trim()) {
      section("Principal notes");
      body(report.reviewNotes);
    }

    // ---- Footer on each page ----
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 36;
      doc
        .moveTo(doc.page.margins.left, footerY - 8)
        .lineTo(doc.page.margins.left + pageWidth, footerY - 8)
        .strokeColor(RULE)
        .lineWidth(0.5)
        .stroke();
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(7)
        .text(
          `${firmName}  ·  Report  ·  Page ${i - range.start + 1} of ${range.count}`,
          doc.page.margins.left,
          footerY,
          { width: pageWidth, align: "center" },
        );
    }

    doc.end();
  });
}
