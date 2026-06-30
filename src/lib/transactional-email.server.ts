// Server-only transactional email sender — bypasses HTTP auth so internal
// server functions (e.g., magic-link login) can enqueue emails directly.
import * as React from 'react'
import { render } from 'react-email'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'valley-news-hub'
const SENDER_DOMAIN = 'notify.wkna49.com'
const FROM_DOMAIN = 'wkna49.com'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface SendTxEmailInput {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, any>
}

export type SendTxEmailResult =
  | { success: true; queued: true; messageId: string }
  | { success: false; reason: string; messageId?: string }

export async function sendTransactionalEmailInternal(
  input: SendTxEmailInput,
): Promise<SendTxEmailResult> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const supabase = supabaseAdmin as any

  const template = TEMPLATES[input.templateName]
  if (!template) {
    console.error('[email] template not found', { templateName: input.templateName })
    return { success: false, reason: 'template_not_found' }
  }

  const effectiveRecipient = template.to || input.recipientEmail
  if (!effectiveRecipient) {
    return { success: false, reason: 'missing_recipient' }
  }

  const messageId = crypto.randomUUID()
  const idempotencyKey = input.idempotencyKey || messageId
  const templateData = input.templateData ?? {}
  const normalizedEmail = effectiveRecipient.toLowerCase()

  // Suppression check
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })
    return { success: false, reason: 'email_suppressed', messageId }
  }

  // Unsubscribe token (one per address)
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: storedToken } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    unsubscribeToken = storedToken?.token ?? unsubscribeToken
  } else {
    return { success: false, reason: 'email_suppressed', messageId }
  }

  // Render
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const plainText = await render(element, { plainText: true })
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // Log pending then enqueue
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: input.templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: input.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('[email] enqueue failed', {
      error: enqueueError,
      templateName: input.templateName,
      recipient_redacted: redactEmail(effectiveRecipient),
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { success: false, reason: 'enqueue_failed', messageId }
  }

  console.log('[email] transactional enqueued', {
    templateName: input.templateName,
    recipient_redacted: redactEmail(effectiveRecipient),
  })

  return { success: true, queued: true, messageId }
}
