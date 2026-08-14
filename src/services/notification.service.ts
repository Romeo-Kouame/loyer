import { sendEmail } from '../utils/email';

export async function notifyPaymentConfirmed(params: {
  tenantEmail: string;
  landlordEmail: string;
  propertyAddress: string;
  amount: string;
}): Promise<void> {
  const subject = `Paiement de loyer confirmé - ${params.propertyAddress}`;
  await Promise.all([
    sendEmail({
      to: params.tenantEmail,
      subject,
      html: `<p>Votre paiement de <strong>${params.amount} XOF</strong> pour <strong>${params.propertyAddress}</strong> a été confirmé.</p>`,
    }),
    sendEmail({
      to: params.landlordEmail,
      subject,
      html: `<p>Un paiement de <strong>${params.amount} XOF</strong> a été confirmé pour <strong>${params.propertyAddress}</strong>.</p>`,
    }),
  ]);
}

export async function notifyPayoutCompleted(params: {
  landlordEmail: string;
  payoutAmount: string;
}): Promise<void> {
  await sendEmail({
    to: params.landlordEmail,
    subject: 'Reversement effectué',
    html: `<p>Un reversement de <strong>${params.payoutAmount} XOF</strong> a été envoyé vers votre compte Mobile Money.</p>`,
  });
}

export async function notifyKycRejected(params: { email: string; rejectionReason: string }): Promise<void> {
  await sendEmail({
    to: params.email,
    subject: 'Vérification d\'identité refusée',
    html: `<p>Votre soumission de vérification d'identité a été refusée.</p><p>Motif : ${params.rejectionReason}</p><p>Vous pouvez soumettre un nouveau document.</p>`,
  });
}

export async function notifyPropertyVerificationRejected(params: {
  landlordEmail: string;
  propertyAddress: string;
  rejectionReason: string;
}): Promise<void> {
  await sendEmail({
    to: params.landlordEmail,
    subject: `Vérification de propriété refusée - ${params.propertyAddress}`,
    html: `<p>La vérification de <strong>${params.propertyAddress}</strong> a été refusée.</p><p>Motif : ${params.rejectionReason}</p>`,
  });
}

export async function notifyDisputeResolved(params: {
  tenantEmail: string;
  landlordEmail: string;
  propertyAddress: string;
  resolution: 'confirmed' | 'refunded';
  notes?: string;
}): Promise<void> {
  const resolutionLabel = params.resolution === 'confirmed' ? 'validé' : 'remboursé';
  const subject = `Litige résolu - ${params.propertyAddress}`;
  const html = `<p>Le litige concernant le paiement pour <strong>${params.propertyAddress}</strong> a été résolu : le paiement a été <strong>${resolutionLabel}</strong>.</p>${
    params.notes ? `<p>Note : ${params.notes}</p>` : ''
  }`;

  await Promise.all([
    sendEmail({ to: params.tenantEmail, subject, html }),
    sendEmail({ to: params.landlordEmail, subject, html }),
  ]);
}
