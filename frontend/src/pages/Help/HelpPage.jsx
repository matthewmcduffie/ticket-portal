import React, { useEffect, useState } from 'react';
import './HelpPage.css';

const SECTIONS = [
  { id: 'overview',         label: 'Overview' },
  { id: 'roles',            label: 'Roles' },
  { id: 'logging-in',       label: 'Logging In' },
  { id: 'first-login',      label: 'First Login' },
  { id: 'change-password',  label: 'Changing Your Password' },
  { id: 'forgot-password',  label: 'Forgot Password' },
  { id: 'dashboard',        label: 'Dashboard' },
  { id: 'tickets',          label: 'Tickets' },
  { id: 'bug-tracker',      label: 'Bug Tracker' },
  { id: 'projects',         label: 'Projects' },
  { id: 'analytics',        label: 'Analytics' },
  { id: 'equipment',        label: 'Equipment Requests' },
  { id: 'settings',         label: 'Settings' },
  { id: 'user-management',  label: '↳ User Management' },
  { id: 'notifications',    label: '↳ Notifications' },
  { id: 'backups',          label: '↳ Backups & Restore' },
  { id: 'quick-ref',        label: 'Quick Reference' },
];

function Section({ id, title, children }) {
  return (
    <section className="help-section" id={id}>
      <h2 className="help-section__title">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }) {
  return (
    <div className="help-sub">
      <h3 className="help-sub__title">{title}</h3>
      {children}
    </div>
  );
}

function Note({ children }) {
  return <div className="help-note">{children}</div>;
}

function Table({ heads, rows }) {
  return (
    <div className="help-table-wrap">
      <table className="help-table">
        <thead><tr>{heads.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function HelpPage() {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    document.title = 'Help — Support Portal';
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="help-page">
      <header className="help-header">
        <div className="help-header__inner">
          <span className="material-symbols-outlined help-header__icon">help</span>
          <div>
            <div className="help-header__title">Help Center</div>
            <div className="help-header__sub">Support Portal — User Guide</div>
          </div>
        </div>
      </header>

      <div className="help-body">
        {/* Sticky TOC */}
        <nav className="help-toc" aria-label="Table of contents">
          <div className="help-toc__label">Contents</div>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`help-toc__item${active === s.id ? ' help-toc__item--active' : ''}${s.label.startsWith('↳') ? ' help-toc__item--sub' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              {s.label.replace('↳ ', '')}
            </button>
          ))}
        </nav>

        {/* Article */}
        <article className="help-article">

          <Section id="overview" title="Overview">
            <p>The Support Portal is a centralized place to submit, track, and resolve support tickets and bug reports, collaborate on team projects, and handle new hire equipment provisioning. Everyone on the team has an account. What you can see and do depends on your role.</p>
          </Section>

          <Section id="roles" title="Roles">
            <p>There are three roles in the portal. Your role is shown at the bottom of the sidebar.</p>
            <Table
              heads={['Role', 'What they can do']}
              rows={[
                ['User', 'Submit and manage their own tickets. Can be granted access to Bug Tracker and Projects individually.'],
                ['Technician', 'Everything a user can do, plus: view all tickets, manage ticket status, access Bug Tracker, Projects, Analytics, Equipment Requests, and a read-only view of the user list. No access to Settings.'],
                ['Admin', 'Full access to everything, including all Settings and User Management.'],
              ]}
            />
          </Section>

          <Section id="logging-in" title="Logging In">
            <ol>
              <li>Open the portal in your browser.</li>
              <li>Enter your <strong>email address</strong> and <strong>password</strong>.</li>
              <li>Click <strong>Sign in</strong>.</li>
            </ol>
            <p>After 10 minutes of inactivity you will see a warning. After 2 more minutes with no response you are logged out automatically for security.</p>
            <Note>If your account is locked after too many failed login attempts, contact an admin to unlock it from User Management.</Note>
          </Section>

          <Section id="first-login" title="Your First Login">
            <p>If an admin created your account without setting a password, you will receive an email with a <strong>Set your password</strong> link. Click the link, choose a new password, and sign in.</p>
            <p><strong>Password requirements:</strong></p>
            <ul>
              <li>At least 8 characters</li>
              <li>At least one uppercase letter</li>
              <li>At least one number</li>
              <li>At least one special character (e.g. <code>!</code>, <code>@</code>, <code>#</code>, <code>$</code>)</li>
            </ul>
            <Note>The invite link expires after one hour. If it has expired, ask an admin to send a new reset email from User Management.</Note>
          </Section>

          <Section id="change-password" title="Changing Your Password">
            <ol>
              <li>Click your name or avatar at the bottom of the sidebar.</li>
              <li>Navigate to <strong>Change Password</strong>.</li>
              <li>Enter your current password, then your new password twice.</li>
              <li>Click <strong>Update Password</strong>.</li>
            </ol>
          </Section>

          <Section id="forgot-password" title="Forgot Your Password">
            <ol>
              <li>On the login page, click <strong>Forgot your password?</strong></li>
              <li>Enter the email address on your account and click <strong>Send reset link</strong>.</li>
              <li>Check your inbox and follow the link.</li>
              <li>Choose a new password and sign in.</li>
            </ol>
            <Note>Reset links expire after one hour.</Note>
          </Section>

          <Section id="dashboard" title="Dashboard">
            <p>The Dashboard is the first page you see after signing in.</p>
            <p><strong>All users</strong> see a summary of their own open and recent tickets, plus recent activity on anything they are involved in.</p>
            <p><strong>Admins and Technicians</strong> see a broader view:</p>
            <ul>
              <li>A summary of all open tickets across the team broken down by status and priority.</li>
              <li>A live activity feed showing recent events across all tickets.</li>
              <li>A snapshot of open Equipment Requests (when the module is enabled).</li>
            </ul>
            <p>The dashboard refreshes automatically every 15 seconds.</p>
          </Section>

          <Section id="tickets" title="Tickets">
            <Sub title="Viewing the Ticket List">
              <p>Navigate to <strong>Tickets</strong> in the sidebar. Use the search bar to find tickets by title, username, or ID (e.g. <code>#ABC123</code>). Use the Status and Priority dropdowns to filter.</p>
            </Sub>

            <Sub title="Opening a New Ticket">
              <ol>
                <li>Click <strong>New Ticket</strong> in the sidebar or the <strong>+ New</strong> button on the Tickets page.</li>
                <li>Choose the type: <strong>Support Ticket</strong> or <strong>Bug Report</strong> (if you have Bug Tracker access).</li>
                <li>Fill in the title and describe the issue.</li>
                <li>Set the priority that best reflects the urgency.</li>
                <li>Click <strong>Submit</strong>.</li>
              </ol>
            </Sub>

            <Sub title="Ticket Statuses">
              <Table
                heads={['Status', 'Meaning']}
                rows={[
                  ['Open', 'Newly submitted. No one has started working on it yet.'],
                  ['In Progress', 'Someone is actively working on it.'],
                  ['Waiting for User', 'Work is paused. A response or action is needed from the person who submitted the ticket before it can move forward.'],
                  ['Solved', 'Resolved and closed.'],
                  ['Merged', 'Consolidated into another ticket. All further updates happen on the target ticket.'],
                ]}
              />
            </Sub>

            <Sub title="Ticket Priorities">
              <Table
                heads={['Priority', 'SLA Target', 'Use when…']}
                rows={[
                  ['Critical', '4 hours', 'A complete outage or issue blocking all work.'],
                  ['High', '24 hours', 'A significant problem affecting multiple people.'],
                  ['Medium', '72 hours', 'An issue with a workaround, or affecting a small group.'],
                  ['Low', '7 days', 'A minor inconvenience or improvement request.'],
                ]}
              />
            </Sub>

            <Sub title="Updating a Ticket">
              <p>Open a ticket by clicking its row. Edit the status, priority, or assignee and click <strong>Save</strong>. Every change is recorded in the ticket's activity history. When marking a ticket as Solved you can add a resolution note explaining what was done.</p>
            </Sub>

            <Sub title="Adding a Comment">
              <p>Open the ticket, scroll to the bottom, type your message, and click <strong>Post</strong>. Comments are visible to everyone with access to the ticket.</p>
            </Sub>

            <Sub title="Attaching Files">
              <p>Inside a ticket, click the <strong>paperclip</strong> icon or the <strong>Attach files</strong> button and select a file. Admins and technicians can delete attachments.</p>
            </Sub>

            <Sub title="Sharing a Ticket">
              <p>Use the Share tab inside a ticket to give a specific user access to a ticket they would not normally see. Search for the user by name, click Add, and they can now view and comment on it. Remove their access by clicking the × next to their name.</p>
            </Sub>

            <Sub title="Merging Tickets">
              <p>If two tickets describe the same issue, open the one you want to consolidate, go to the <strong>Merge</strong> tab, search for the target ticket, and confirm. The original is marked Merged and all future activity continues on the target ticket. Only admins and technicians can merge.</p>
            </Sub>
          </Section>

          <Section id="bug-tracker" title="Bug Tracker">
            <p>The Bug Tracker works exactly like the Tickets list but is dedicated to bug reports. Access is granted individually by an admin; admins and technicians always have access.</p>
            <p>When filing a bug report, choose <strong>Bug Report</strong> as the type and select the affected <strong>software</strong> from the dropdown. The software catalog is managed by admins under Settings → Bug Tracker.</p>
            <p>All ticket features — comments, attachments, sharing, merging — work the same way in the Bug Tracker.</p>
          </Section>

          <Section id="projects" title="Projects">
            <p>Projects let you group related tickets and bug reports under a named initiative and collaborate with a defined team. The Projects feature must be enabled by an admin under Settings.</p>
            <Sub title="Creating a Project">
              <ol>
                <li>Navigate to <strong>Projects</strong> in the sidebar.</li>
                <li>Click <strong>New Project</strong>.</li>
                <li>Enter a name and optional description.</li>
                <li>Click <strong>Create</strong>.</li>
              </ol>
            </Sub>
            <Sub title="Adding Members">
              <p>Open the project and go to the <strong>Members</strong> section. Search for a team member by name and click <strong>Add</strong>. Remove them by clicking the × next to their name. Members can view and interact with all tickets and bugs linked to the project.</p>
            </Sub>
            <Sub title="Linking Tickets to a Project">
              <p>Select the project in the project field when creating a ticket, or edit an existing ticket and choose the project there.</p>
            </Sub>
          </Section>

          <Section id="analytics" title="Analytics">
            <p>Available to <strong>admins and technicians</strong>. Navigate to <strong>Analytics</strong> in the sidebar.</p>
            <Table
              heads={['Metric', 'What it means']}
              rows={[
                ['Total Issues', 'Every ticket and bug report in the system. The sub-line shows how many were opened today and this week.'],
                ['Open', 'Unresolved issues (Open + In Progress + Waiting for User). Sub-line shows how many are actively in progress.'],
                ['Avg Resolution', 'Average time from submission to Solved, weighted across all resolved issues.'],
                ['SLA Compliance', 'Percentage of resolved tickets that were closed within the SLA target time for their priority level. 80%+ is good. Below 60% needs attention.'],
              ]}
            />
            <p>The <strong>Ticket Volume</strong> bar chart shows daily issue volume for the last 14 days. The <strong>Ticket Age</strong> panel groups open issues by how long they have been waiting — click any bar to see which specific issues are in that range. The <strong>Resolution by Priority</strong> table shows SLA performance for each priority level.</p>
          </Section>

          <Section id="equipment" title="Equipment Requests">
            <p>Available to <strong>admins and technicians</strong> when the module is enabled under Settings.</p>
            <Sub title="Submitting a Request">
              <ol>
                <li>Click <strong>Equipment</strong> in the sidebar, then <strong>New Request</strong>.</li>
                <li>Fill in the new hire's <strong>Full Name</strong>, <strong>Department</strong>, and <strong>Start Date</strong>.</li>
                <li>Enter your name as <strong>Requestor</strong>.</li>
                <li>Select the items needed: Laptop, Monitor, Keyboard, Mouse.</li>
                <li>Set the <strong>Due Date</strong> — when the equipment must be ready.</li>
                <li>Add any optional notes for special requirements.</li>
                <li>Click <strong>Submit Request</strong>.</li>
              </ol>
              <p>A notification is sent to Discord or Slack automatically if those integrations are configured.</p>
            </Sub>
            <Sub title="Request Statuses">
              <Table
                heads={['Status', 'Meaning']}
                rows={[
                  ['Pending', 'Request submitted. No action taken yet.'],
                  ['Approved', 'Request has been reviewed and approved for fulfillment.'],
                  ['Fulfilled', 'Equipment has been delivered to the new hire.'],
                ]}
              />
            </Sub>
            <Sub title="Managing a Request">
              <p>Click any request to open it. From the detail page you can update the status, edit request details, add comments to the audit trail, or delete the request.</p>
            </Sub>
          </Section>

          <Section id="settings" title="Settings">
            <p>Available to <strong>admins only</strong>. Click <strong>Settings</strong> at the bottom of the sidebar. Each card opens a panel where you can make and save changes.</p>
          </Section>

          <Section id="user-management" title="User Management">
            <Sub title="Creating a User">
              <ol>
                <li>Go to <strong>Settings → User Management</strong>.</li>
                <li>Fill in the name, email, and role.</li>
                <li>By default the user receives an email invite to set their own password. Check <strong>Set a password for this user</strong> to assign one yourself instead.</li>
                <li>For <strong>User</strong>-role accounts you can also grant Bug Tracker and Projects access.</li>
                <li>Click <strong>Create User</strong>.</li>
              </ol>
            </Sub>
            <Sub title="Importing Users from a Spreadsheet">
              <ol>
                <li>Prepare a CSV or Excel file with <strong>Name in column A</strong> and <strong>Email in column B</strong>.</li>
                <li>In the <strong>Import Users</strong> section, click <strong>Choose file…</strong> and select your file.</li>
                <li>Click <strong>Import users</strong>. Each new user receives an invite email. Rows with existing emails are skipped.</li>
              </ol>
            </Sub>
            <Sub title="Row Actions (⋮ menu)">
              <Table
                heads={['Action', 'What it does']}
                rows={[
                  ['Edit', 'Change the user\'s name, email, role, or individual permissions.'],
                  ['Deactivate / Activate', 'Disable or re-enable the account. A deactivated user cannot sign in.'],
                  ['Unlock account', 'Remove the lockout applied after too many failed login attempts.'],
                  ['Send reset email', 'Email the user a new password reset link (expires in 1 hour).'],
                  ['Delete user', 'Permanently removes the account and logs the event to the audit log. Cannot be undone.'],
                ]}
              />
            </Sub>
          </Section>

          <Section id="notifications" title="Notifications">
            <Sub title="Discord">
              <ol>
                <li>Create an incoming webhook in your Discord server settings.</li>
                <li>Paste the webhook URL into <strong>Settings → Discord</strong>.</li>
                <li>Toggle the events you want notifications for: new ticket, status update, equipment request.</li>
                <li>Click <strong>Save changes</strong>, then <strong>Send test message</strong> to verify.</li>
              </ol>
            </Sub>
            <Sub title="Slack">
              <p>Works the same way as Discord. Create an incoming webhook in Slack, paste the URL under <strong>Settings → Slack</strong>, toggle events, save, and test.</p>
            </Sub>
            <Sub title="Email">
              <p>Connect an AgentMail inbox under <strong>Settings → Email</strong>. Once configured, emails sent to that inbox are automatically converted into tickets. Users also receive outbound notifications through this address.</p>
            </Sub>
          </Section>

          <Section id="backups" title="Backups & Restore">
            <Sub title="Scheduled Backups">
              <p>Under <strong>Settings → Backups</strong>, configure an Amazon S3 or Cloudflare R2 bucket and set how often backups run. You can also click <strong>Run backup now</strong> to trigger one immediately. Backups include the full database and all uploaded files.</p>
            </Sub>
            <Sub title="Restoring Data">
              <p>Under <strong>Settings → Restore</strong>, choose one of three methods:</p>
              <ul>
                <li><strong>Cloud backup</strong> — Select a backup from your configured cloud storage.</li>
                <li><strong>Uploaded file</strong> — Upload a backup file from your computer.</li>
                <li><strong>SQL dump</strong> — Upload a raw SQL file exported from the database.</li>
              </ul>
              <Note>⚠ Restoring replaces the entire current database. Take a fresh backup first if you want to preserve current data. This cannot be undone.</Note>
            </Sub>
          </Section>

          <Section id="quick-ref" title="Quick Reference">
            <Sub title="Ticket Priorities & SLA">
              <Table
                heads={['Priority', 'SLA Target']}
                rows={[
                  ['Critical', '4 hours'],
                  ['High', '24 hours'],
                  ['Medium', '72 hours'],
                  ['Low', '7 days'],
                ]}
              />
            </Sub>
            <Sub title="Ticket Statuses">
              <Table
                heads={['Status', 'Description']}
                rows={[
                  ['Open', 'Newly submitted, awaiting attention'],
                  ['In Progress', 'Actively being worked on'],
                  ['Waiting for User', 'Awaiting input from the submitter'],
                  ['Solved', 'Resolved and closed'],
                  ['Merged', 'Consolidated into another ticket'],
                ]}
              />
            </Sub>
            <Sub title="Equipment Statuses">
              <Table
                heads={['Status', 'Description']}
                rows={[
                  ['Pending', 'Submitted, not yet acted on'],
                  ['Approved', 'Reviewed and approved'],
                  ['Fulfilled', 'Equipment delivered'],
                ]}
              />
            </Sub>
            <Sub title="User Roles">
              <Table
                heads={['Role', 'Access summary']}
                rows={[
                  ['User', 'Own tickets only, plus any individually granted features'],
                  ['Technician', 'All tickets, bugs, projects, analytics, equipment, read-only users'],
                  ['Admin', 'Everything, including all settings and user management'],
                ]}
              />
            </Sub>
          </Section>

        </article>
      </div>
    </div>
  );
}
