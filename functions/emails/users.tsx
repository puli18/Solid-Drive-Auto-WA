/** User invite email (password setup link from Firebase Auth). Password resets use Firebase's default email. */
import { type BaseEmailProps, Cta, Layout, P, Title } from './components';

export function UserInviteEmail(p: BaseEmailProps & { name: string; roleLabel: string; link: string; invitedBy?: string }) {
  return (
    <Layout preview={`You've been invited to the ${p.business.name} dashboard`} siteUrl={p.siteUrl} business={p.business}>
      <Title>Welcome to the team</Title>
      <P>
        Hi {p.name}, {p.invitedBy ? `${p.invitedBy} has invited you` : 'you have been invited'} to the {p.business.name} dealership
        dashboard as{' '}
        <strong>{p.roleLabel}</strong>.
      </P>
      <P>Set your password to get started. The link expires after a while – ask an admin for a new invite if it does.</P>
      <Cta href={p.link}>Set your password</Cta>
      <P muted>
        After signing in you can manage stock, bookings and enquiries from {p.siteUrl}/admin. Admin accounts must set up two-factor
        authentication on first login.
      </P>
    </Layout>
  );
}
