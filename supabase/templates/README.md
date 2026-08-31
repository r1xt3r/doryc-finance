# Doryc authentication email

In Supabase, open **Authentication → Email Templates → Confirm signup**.

- Subject: `Confirm your Doryc account | Confirma tu cuenta`
- Paste the contents of `confirm-signup.html` into the message body.
- Keep `{{ .ConfirmationURL }}` unchanged; Supabase replaces it with the secure confirmation link.

The template is intentionally bilingual because Supabase's standard confirmation template does not receive Doryc's saved interface language.

For **Authentication → Email Templates → Reset password**:

- Subject: `Reset your Doryc password | Cambia tu contraseña`
- Paste `reset-password.html` into the message body.
- Keep `{{ .ConfirmationURL }}` unchanged.
