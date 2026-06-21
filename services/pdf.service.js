const PDFDocument = require('pdfkit');

const QUESTIONS = [
  // Privacy
  { num: 1, domain: 'Privacy', text: 'Does the AI system collect or process personal data?' },
  { num: 2, domain: 'Privacy', text: 'Is user consent obtained before data collection?' },
  { num: 3, domain: 'Privacy', text: 'Is the data anonymized or encrypted during storage?' },
  { num: 4, domain: 'Privacy', text: 'Does the system comply with data protection regulations?' },
  // Fairness
  { num: 5, domain: 'Fairness', text: 'Has the model been tested for bias across demographic groups?' },
  { num: 6, domain: 'Fairness', text: 'Does the system make decisions that affect human lives?' },
  { num: 7, domain: 'Fairness', text: 'Are there mechanisms to appeal or override AI decisions?' },
  { num: 8, domain: 'Fairness', text: 'Was the training data diverse and representative?' },
  // Security
  { num: 9, domain: 'Security', text: 'Has a cybersecurity risk assessment been conducted?' },
  { num: 10, domain: 'Security', text: 'Are there access controls limiting who can use the system?' },
  { num: 11, domain: 'Security', text: 'Is the system protected against adversarial attacks?' },
  { num: 12, domain: 'Security', text: 'Are there incident response procedures if the system is compromised?' },
  // Transparency
  { num: 13, domain: 'Transparency', text: 'Is model documentation publicly available?' },
  { num: 14, domain: 'Transparency', text: 'Can the AI explain why it made a specific decision?' },
  { num: 15, domain: 'Transparency', text: 'Are users informed that they are interacting with an AI?' },
  { num: 16, domain: 'Transparency', text: 'Is there a model card or data sheet for this system?' },
  // Accountability
  { num: 17, domain: 'Accountability', text: 'Is there a designated person responsible for AI outcomes?' },
  { num: 18, domain: 'Accountability', text: 'Are audit logs maintained for all AI decisions?' },
  { num: 19, domain: 'Accountability', text: 'Is there a process for reporting AI-related harms?' },
  { num: 20, domain: 'Accountability', text: 'Has the system undergone independent review before deployment?' },
];

function generateReport(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { project, developer, assessment, review } = data;

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#0d6efd');
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('ACEAS', 50, 20);
    doc.fontSize(11).font('Helvetica').text('AI Compliance and Ethics Assessment System', 50, 48);
    doc.fillColor('black');

    doc.moveDown(3);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#212529')
      .text('Compliance Assessment Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').fillColor('#6c757d')
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.moveDown(1.5);

    // Project Info box
    const infoY = doc.y;
    doc.rect(50, infoY, doc.page.width - 100, 120).fillAndStroke('#f8f9fa', '#dee2e6');
    doc.fillColor('#212529').fontSize(13).font('Helvetica-Bold').text('Project Information', 65, infoY + 10);
    doc.fontSize(10).font('Helvetica');
    const lines = [
      ['Project Title', project.title],
      ['Developer', developer.full_name],
      ['Email', developer.email],
      ['AI Type', project.ai_type || 'N/A'],
      ['Submission Date', new Date(project.submitted_at).toLocaleDateString()],
      ['Assessment Date', new Date(assessment.assessed_at).toLocaleDateString()],
    ];
    let lineY = infoY + 30;
    lines.forEach(([label, value]) => {
      doc.fillColor('#6c757d').text(label + ':', 65, lineY);
      doc.fillColor('#212529').text(value, 200, lineY);
      lineY += 16;
    });
    doc.moveDown(7);

    // Overall Score
    doc.moveDown(0.5);
    const scoreColor = assessment.risk_level === 'Low Risk' ? '#198754'
      : assessment.risk_level === 'Medium Risk' ? '#fd7e14'
      : assessment.risk_level === 'High Risk' ? '#dc3545'
      : '#7a0030';

    const scoreBoxY = doc.y;
    doc.rect(50, scoreBoxY, doc.page.width - 100, 65).fillAndStroke('#f8f9fa', '#dee2e6');
    doc.fillColor('#212529').fontSize(13).font('Helvetica-Bold').text('Overall Compliance Score', 65, scoreBoxY + 10);
    doc.fontSize(28).font('Helvetica-Bold').fillColor(scoreColor)
      .text(`${parseFloat(assessment.overall_score).toFixed(1)}%`, 65, scoreBoxY + 28);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(scoreColor)
      .text(assessment.risk_level, 200, scoreBoxY + 38);
    doc.moveDown(4.5);

    // Domain Scores Table
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#212529').text('Domain Scores');
    doc.moveDown(0.4);

    const tableHeaders = ['Domain', 'Score', 'Weight', 'Status'];
    const colWidths = [160, 80, 80, 120];
    const tableX = 50;
    let tableY = doc.y;
    const rowHeight = 22;

    // Header row
    doc.rect(tableX, tableY, doc.page.width - 100, rowHeight).fill('#0d6efd');
    let colX = tableX + 8;
    tableHeaders.forEach((h, i) => {
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text(h, colX, tableY + 6, { width: colWidths[i] - 8 });
      colX += colWidths[i];
    });
    tableY += rowHeight;

    const domainRows = [
      ['Privacy', assessment.privacy_score, '25%'],
      ['Fairness', assessment.fairness_score, '25%'],
      ['Security', assessment.security_score, '20%'],
      ['Transparency', assessment.transparency_score, '15%'],
      ['Accountability', assessment.accountability_score, '15%'],
    ];

    domainRows.forEach((row, idx) => {
      const bg = idx % 2 === 0 ? 'white' : '#f8f9fa';
      doc.rect(tableX, tableY, doc.page.width - 100, rowHeight).fill(bg).stroke('#dee2e6');
      colX = tableX + 8;
      const score = parseFloat(row[1]);
      const status = score >= 80 ? 'Good' : score >= 60 ? 'Needs Attention' : 'Critical';
      const statusColor = score >= 80 ? '#198754' : score >= 60 ? '#fd7e14' : '#dc3545';
      [row[0], `${score.toFixed(1)}%`, row[2]].forEach((val, i) => {
        doc.fillColor('#212529').fontSize(10).font('Helvetica').text(val, colX, tableY + 6, { width: colWidths[i] - 8 });
        colX += colWidths[i];
      });
      doc.fillColor(statusColor).fontSize(10).font('Helvetica-Bold').text(status, colX, tableY + 6, { width: colWidths[3] - 8 });
      tableY += rowHeight;
    });

    doc.y = tableY + 10;
    doc.moveDown(1);

    // Q&A Section
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#212529').text('Assessment Questionnaire Responses');
    doc.moveDown(0.5);

    let currentDomain = '';
    QUESTIONS.forEach((q) => {
      if (q.domain !== currentDomain) {
        currentDomain = q.domain;
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0d6efd').text(q.domain);
        doc.moveDown(0.2);
      }
      const answer = assessment[`q${q.num}`];
      const answerStr = answer === true ? 'Yes ✓' : answer === false ? 'No ✗' : 'N/A';
      const answerColor = answer === true ? '#198754' : '#dc3545';
      const currentY = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#495057')
        .text(`Q${q.num}. ${q.text}`, 60, currentY, { width: 380 });
      doc.fillColor(answerColor).font('Helvetica-Bold').text(answerStr, 455, currentY, { width: 60 });
      doc.moveDown(0.3);
    });

    // AI Recommendations
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#212529').text('AI-Powered Recommendations');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#495057')
      .text(assessment.ai_recommendations || 'No recommendations available.', {
        paragraphGap: 5,
        lineGap: 2,
      });

    // Officer Review
    if (review) {
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#212529').text('Officer Review');
      doc.moveDown(0.5);
      const reviewBoxY = doc.y;
      doc.rect(50, reviewBoxY, doc.page.width - 100, 80).fillAndStroke('#f8f9fa', '#dee2e6');
      const decisionColor = review.decision === 'approved' ? '#198754'
        : review.decision === 'rejected' ? '#dc3545' : '#fd7e14';
      doc.fillColor('#212529').fontSize(11).font('Helvetica-Bold')
        .text(`Decision: `, 65, reviewBoxY + 12, { continued: true });
      doc.fillColor(decisionColor).font('Helvetica-Bold')
        .text(review.decision.replace('_', ' ').toUpperCase());
      doc.fontSize(10).font('Helvetica').fillColor('#495057')
        .text(`Reviewed by: ${review.officer_name || 'Compliance Officer'}`, 65, reviewBoxY + 32);
      doc.text(`Date: ${new Date(review.reviewed_at).toLocaleDateString()}`, 65, reviewBoxY + 48);
      if (review.comments) {
        doc.text(`Comments: ${review.comments}`, 65, reviewBoxY + 64, { width: doc.page.width - 130 });
      }
      doc.moveDown(5);
    }

    // Footer on each page
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').fillColor('#adb5bd')
        .text(
          `ACEAS Compliance Report — ${project.title} — Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 40,
          { align: 'center', width: doc.page.width - 100 }
        );
    }

    doc.end();
  });
}

module.exports = { generateReport };
