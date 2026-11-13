"""Generates the sample documents the Help Center screenshot tours upload (HC3).

Run: python3 make-files.py   (needs reportlab, python-docx, openpyxl). Output is committed.
All text is original filler written for the demo — no real client or firm material.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from docx import Document
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

GREEN = colors.HexColor('#14532d')

PARAS = [
    "This document summarises the approach the firm takes and the decisions an engagement team needs to make. "
    "It is written for practitioners and assumes familiarity with the underlying standard.",
    "Each section sets out the requirement, the practical steps, and the evidence a reviewer will expect to see on file. "
    "Where judgement is needed, the factors to weigh are listed with worked examples.",
    "Teams should agree the plan with the engagement lead before fieldwork starts, record key decisions as they are made, "
    "and raise questions early with the technical desk.",
    "Common pitfalls are highlighted at the end of each section, together with the reviewer's checklist.",
]


def pdf(name, title, subtitle, sections, landscape=False):
    size = (A4[1], A4[0]) if landscape else A4
    c = canvas.Canvas(name, pagesize=size)
    w, h = size
    c.setTitle(title)
    c.setAuthor('ABDC demo content')
    # Cover
    c.setFillColor(GREEN)
    c.rect(0, h - 90 * mm, w, 90 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 26)
    c.drawString(20 * mm, h - 45 * mm, title)
    c.setFont('Helvetica', 13)
    c.drawString(20 * mm, h - 57 * mm, subtitle)
    c.setFillColor(colors.HexColor('#334155'))
    c.setFont('Helvetica', 10)
    c.drawString(20 * mm, 20 * mm, 'Demo material for the Help Center — not real guidance.')
    c.showPage()
    for i, s in enumerate(sections, 1):
        c.setFillColor(GREEN)
        c.setFont('Helvetica-Bold', 17)
        c.drawString(20 * mm, h - 25 * mm, f'{i}. {s}')
        c.setFillColor(colors.HexColor('#1f2937'))
        y = h - 40 * mm
        for p in PARAS:
            text = c.beginText(20 * mm, y)
            text.setFont('Helvetica', 11)
            words, line = p.split(), ''
            for word in words:
                if c.stringWidth(line + ' ' + word, 'Helvetica', 11) > w - 40 * mm:
                    text.textLine(line)
                    line = word
                    y -= 15
                else:
                    line = (line + ' ' + word).strip()
            text.textLine(line)
            y -= 30
            c.drawText(text)
        c.setFont('Helvetica', 9)
        c.drawRightString(w - 20 * mm, 12 * mm, f'{title} · page {i + 1}')
        c.showPage()
    c.save()


pdf('ifrs-17-implementation-guide.pdf', 'IFRS 17 Implementation Guide', 'Insurance contracts — a practitioner\'s walkthrough',
    ['Scope and contract boundaries', 'Measurement models', 'Transition approaches', 'Disclosures', 'Audit considerations', 'Checklist'])
pdf('audit-sampling-masterclass.pdf', 'Audit Sampling Masterclass', 'Training slides — Assurance academy',
    ['Why we sample', 'Statistical vs non-statistical', 'Sample sizes', 'Evaluating misstatements'], landscape=True)
pdf('finance-act-2025-highlights.pdf', 'Finance Act 2025 — Highlights', 'What changed and who it affects',
    ['Company income tax', 'VAT changes', 'Withholding tax', 'Effective dates'])
pdf('quality-management-manual.pdf', 'Quality Management Manual', 'ISQM 1 — how the firm meets it',
    ['Governance and leadership', 'Acceptance and continuance', 'Engagement performance', 'Monitoring and remediation'])
pdf('esg-reporting-research.pdf', 'ESG Reporting in West Africa', 'Research paper — readiness survey 2026',
    ['Method', 'Findings', 'Sector comparison', 'Recommendations'])
for n, t in [(1, 'Firm methodology'), (2, 'Working papers and evidence'), (3, 'Using the portal with clients')]:
    pdf(f'onboarding-module-{n}.pdf', f'Onboarding — Module {n}', t, ['Overview', 'Key points', 'Exercise'], landscape=True)

d = Document()
d.add_heading('Engagement Letter Template', 0)
d.add_paragraph('Replace the bracketed text before sending. Demo template for the Help Center.')
for h in ['Scope of the engagement', 'Responsibilities', 'Fees and billing', 'Confidentiality', 'Acceptance']:
    d.add_heading(h, 1)
    d.add_paragraph('[Describe ' + h.lower() + ' here.] ' + PARAS[0])
d.save('engagement-letter-template.docx')

wb = Workbook()
ws = wb.active
ws.title = 'Checklist'
ws.append(['#', 'Area', 'Question', 'Done', 'Reviewer'])
for c in ws[1]:
    c.font = Font(bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', fgColor='14532D')
rows = ['Group structure documented', 'Functional analysis complete', 'Benchmarking study attached', 'Intercompany agreements on file',
        'Local file prepared', 'Master file reviewed']
for i, r in enumerate(rows, 1):
    ws.append([i, 'Transfer pricing', r, '', ''])
ws.column_dimensions['C'].width = 42
wb.save('transfer-pricing-checklist.xlsx')
print('ok')
