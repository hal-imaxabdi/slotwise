import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PublicHeader } from '../components/PublicHeader.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { APP_NAME, AUTHOR_HANDLE, GITHUB_ISSUES_URL, GITHUB_URL } from '../lib/site.ts';

export const LEGAL_UPDATED = '3 November 2026';

function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} - ${APP_NAME}`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="landing">
      <PublicHeader />
      <main id="main-content" className="legal">
        <article>
          <header className="legal__head">
            <p className="eyebrow">Legal</p>
            <h1>{title}</h1>
            <p className="legal__intro">{intro}</p>
            <p className="legal__updated">Last updated: {LEGAL_UPDATED}</p>
          </header>
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function Contact() {
  return (
    <p>
      Questions or requests: open an issue at <a href={GITHUB_ISSUES_URL}>{GITHUB_ISSUES_URL}</a>.
      Please don’t post personal data in a public issue; say what you need and we will reply there.
    </p>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`${APP_NAME} is a portfolio project. The barbershop is fictional, and we collect as little as the app needs to work.`}
    >
      <h2>Who runs this site</h2>
      <p>
        {APP_NAME} is an open-source portfolio project by{' '}
        <a href={`https://github.com/${AUTHOR_HANDLE}`}>{AUTHOR_HANDLE}</a>, published at{' '}
        <a href={GITHUB_URL}>{GITHUB_URL}</a>. It is not a real business and takes no real bookings.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> when you register: your name, your email address and your
          password, which is stored only as an argon2id hash and never in readable form.
        </li>
        <li>
          <strong>Bookings</strong> you make: the service, the time, its status and any note you
          add.
        </li>
        <li>
          <strong>Security data</strong>: a session cookie while you are signed in (see the{' '}
          <Link to="/cookies">Cookie Policy</Link>), and short-lived counters of failed sign-in
          attempts, stored against a one-way hash of the email address and against your IP address.
        </li>
        <li>
          <strong>Hosting logs</strong>: our hosting providers may record your IP address and basic
          request details to operate and secure their platforms.
        </li>
      </ul>

      <h2>What we don’t do</h2>
      <ul>
        <li>No analytics, advertising, tracking pixels or third-party scripts.</li>
        <li>No requests to font or asset CDNs: fonts and images are served from this site.</li>
        <li>No emails or newsletters, so there is nothing to unsubscribe from.</li>
        <li>No payments: we never ask for card or bank details.</li>
        <li>We never sell or share your data.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To provide the service you asked for (your account and bookings), and to keep it secure
        (sessions and sign-in throttling, which protect accounts from password guessing).
      </p>

      <h2>Who processes it</h2>
      <p>
        The website is hosted by Vercel and the API and database by Render. They process data only
        to run the infrastructure.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          This is a demo: registered accounts and all bookings are deleted whenever the demo data
          resets, which happens regularly.
        </li>
        <li>Sessions end after 7 days at most, or when you sign out.</li>
        <li>
          Failed sign-in counters stop counting after 15 minutes and are deleted at the next
          clean-up or demo reset.
        </li>
      </ul>

      <h2>Your rights and choices</h2>
      <p>
        You can see your details and bookings in the app at any time. You can delete your account
        yourself from <Link to="/account">Account</Link>: this erases your name, email, password and
        booking notes and cancels your upcoming bookings straight away. For anything else (access,
        correction, objection), contact us below.
      </p>

      <h2>Children</h2>
      <p>
        Accounts are for people aged 16 and over. A parent or guardian should book services for
        children, such as the Kids Haircut, from their own account.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date at the top changes too. Material changes will be noted on
        this page.
      </p>
      <Contact />
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={`The rules for using ${APP_NAME}, a portfolio demo of an appointment booking system.`}
    >
      <h2>What this is</h2>
      <p>
        {APP_NAME} demonstrates a booking system for a fictional Jakarta barbershop. Bookings made
        here are not real appointments, and nobody will be waiting for you at the shop.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must be 16 or older to create an account.</li>
        <li>Please use a made-up name and email address. Don’t enter sensitive information.</li>
        <li>Keep your password to yourself. You are responsible for activity on your account.</li>
        <li>
          Accounts and bookings are deleted whenever the demo resets. You can also delete your
          account at any time from <Link to="/account">Account</Link>.
        </li>
      </ul>

      <h2>Shared demo accounts</h2>
      <p>
        The customer, staff and admin demo accounts are shared by every visitor and their passwords
        are public. Anything you do with them is visible to others until the next reset. Their
        passwords cannot be changed and the accounts cannot be deleted.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don’t attack, overload, scrape or try to break into the service or other accounts.</li>
        <li>Don’t use the service to store or send anything unlawful or offensive.</li>
        <li>
          Found a security problem? Please report it privately through{' '}
          <a href={GITHUB_ISSUES_URL}>GitHub</a> rather than exploiting it.
        </li>
      </ul>

      <h2>Prices, payments and refunds</h2>
      <p>
        Prices are shown in full, in Indonesian rupiah, next to every service, with no extra fees
        added later. They are fictional: {APP_NAME} takes no payments, so there is never anything to
        refund.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The service is provided free and “as is”, without guarantees of availability or accuracy. It
        runs on free hosting that sleeps when idle, so the first request can take up to a minute. To
        the extent the law allows, we are not liable for any loss from using it.
      </p>

      <h2>Changes and contact</h2>
      <p>We may update these terms; the date at the top shows the latest version.</p>
      <Contact />
    </LegalLayout>
  );
}

export function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      intro={`${APP_NAME} uses one strictly necessary cookie and nothing else.`}
    >
      <h2>The one cookie we set</h2>
      <div className="legal__table-wrap">
        <table className="legal__table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Purpose</th>
              <th scope="col">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>slotwise_session</code>
              </td>
              <td>
                Keeps you signed in. Set only when you sign in or register. HttpOnly (scripts can’t
                read it), Secure, SameSite=Lax.
              </td>
              <td>Until you sign out, or 7 days at most</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>What we don’t use</h2>
      <p>
        No analytics, advertising or social media cookies, no third-party cookies, and nothing in
        local storage. Fonts and images are self-hosted, so loading a page contacts no other
        company.
      </p>

      <h2>Why there is no cookie banner</h2>
      <p>
        Cookies that are strictly necessary for a service you ask for, like staying signed in, don’t
        need consent. As we set no other cookies, there is nothing to accept or reject. If we ever
        add optional cookies, we will ask first.
      </p>

      <h2>Your control</h2>
      <p>
        You can block or delete cookies in your browser settings. Without the session cookie you can
        still read the public pages, but you can’t sign in.
      </p>
      <Contact />
    </LegalLayout>
  );
}
