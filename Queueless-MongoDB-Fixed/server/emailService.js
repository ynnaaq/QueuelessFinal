const resendApiUrl = 'https://api.resend.com/emails'

export async function sendEmailOtp(email, code, purpose) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    throw Object.assign(new Error('Email delivery is not configured.'), { status: 503 })
  }

  const subject = purpose === 'verify'
    ? 'Verify your Queueless email'
    : 'Reset your Queueless password'
  const action = purpose === 'verify' ? 'verification' : 'password reset'

  const response = await fetch(resendApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text: `Your Queueless ${action} code is: ${code}\n\nIt expires in 10 minutes. Do not share this code with anyone.`,
    }),
  })

  if (!response.ok) {
    const details = await response.json().catch(() => ({}))
    console.error('RESEND DELIVERY ERROR:', details)
    throw Object.assign(new Error('We could not send the code. Please try again later.'), { status: 502 })
  }
}
